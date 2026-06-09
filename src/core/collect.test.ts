import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { analyzeRealtimeRepository, analyzeRepository, collectRepository } from "./collect.js";

const exec = promisify(execFile);

async function git(cwd: string, args: string[]) {
  await exec("git", args, { cwd });
}

async function withGitRepo(fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "codesprawl-git-"));
  try {
    await git(root, ["init"]);
    await git(root, ["config", "user.email", "test@example.com"]);
    await git(root, ["config", "user.name", "Test User"]);
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "a.ts"), "export const a = 1;\n");
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "initial"]);
    await writeFile(path.join(root, "src", "b.ts"), "import { a } from './a';\nexport const b = a + 1;\n");
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "Generated with Claude Code"]);
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("collectRepository", () => {
  it("collects recent git commits into .codesprawl and analyze writes adjacent diffs", async () => {
    await withGitRepo(async (root) => {
      const result = await collectRepository(root, { commits: 2 });

      expect(result.snapshots).toHaveLength(2);
      expect(result.commits[1]?.aiIndicators).toContain("claude-code");

      const commitsJson = JSON.parse(await readFile(path.join(root, ".codesprawl", "commits.json"), "utf8")) as unknown[];
      expect(commitsJson).toHaveLength(2);

      const metricsCsv = await readFile(path.join(root, ".codesprawl", "metrics.csv"), "utf8");
      expect(metricsCsv).toContain("commit,timestamp,likelyAI,loc,fileCount,importEdgeCount");
      expect(metricsCsv).toContain("true");

      const analysis = await analyzeRepository(root);
      expect(analysis.diffs).toHaveLength(1);
      expect(analysis.diffs[0]?.metricDelta.fileCount).toBe(1);

      const sinceResult = await collectRepository(root, { since: "6.months" });
      expect(sinceResult.snapshots).toHaveLength(2);
    });
  });

  it("compares uncommitted working tree changes against HEAD for realtime analysis", async () => {
    await withGitRepo(async (root) => {
      await writeFile(path.join(root, "src", "live.ts"), "import { a } from './a';\nexport const live = a + 2;\n");
      await writeFile(path.join(root, "src", "b.ts"), "import { a } from './a';\nimport { live } from './live';\nexport const b = a + live;\n");

      const result = await analyzeRealtimeRepository(root);

      expect(result.baseSnapshot.commit.hash).not.toBe("WORKTREE");
      expect(result.currentSnapshot.commit.hash).toBe("WORKTREE");
      expect(result.status.length).toBeGreaterThan(0);
      expect(result.status.some((line) => line.includes(".codesprawl"))).toBe(false);
      expect(result.diff.metricDelta.fileCount).toBe(1);
      expect(result.diff.addedNodes).toContain("file:src/live.ts");
      expect(result.diff.hotspots[0]?.path).toBe("src/live.ts");
    });
  });
});
