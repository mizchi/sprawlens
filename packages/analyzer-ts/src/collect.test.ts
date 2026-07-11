import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { analyzeRealtimeRepository, analyzeRepository, collectRepository } from "./collect.ts";
import { createSnapshotFromWorkingTree } from "./snapshot.ts";

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
    await writeFile(
      path.join(root, "src", "b.ts"),
      "import { a } from './a';\nexport const b = a + 1;\n",
    );
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

      const commitsJson = JSON.parse(
        await readFile(path.join(root, ".codesprawl", "commits.json"), "utf8"),
      ) as unknown[];
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

  it("can collect into an external directory without replacing repository data", async () => {
    await withGitRepo(async (root) => {
      const outputDir = await mkdtemp(path.join(tmpdir(), "codesprawl-output-"));
      try {
        await mkdir(path.join(root, ".codesprawl"), { recursive: true });
        await writeFile(path.join(root, ".codesprawl", "keep.txt"), "user data");

        const result = await collectRepository(root, { commits: 2, outputDir });

        expect(result.outputDir).toBe(outputDir);
        expect(
          JSON.parse(await readFile(path.join(outputDir, "commits.json"), "utf8")),
        ).toHaveLength(2);
        expect(await readFile(path.join(root, ".codesprawl", "keep.txt"), "utf8")).toBe(
          "user data",
        );
      } finally {
        await rm(outputDir, { recursive: true, force: true });
      }
    });
  });

  it("collects from a frozen revision and records first-parent provenance", async () => {
    await withGitRepo(async (root) => {
      const { stdout } = await exec("git", ["rev-list", "--max-parents=0", "HEAD"], {
        cwd: root,
      });
      const revision = stdout.trim();
      const outputDir = await mkdtemp(path.join(tmpdir(), "codesprawl-frozen-"));
      try {
        const result = await collectRepository(root, {
          commits: 1,
          revision,
          firstParent: true,
          outputDir,
        });

        expect(result.commits.map(({ hash }) => hash)).toEqual([revision]);
        expect(result.config.options).toMatchObject({ revision, firstParent: true, commits: 1 });
      } finally {
        await rm(outputDir, { recursive: true, force: true });
      }
    });
  });

  it("uses an injected language analyzer and normalizes temporary worktree identity", async () => {
    await withGitRepo(async (root) => {
      const analyzedPaths: string[] = [];
      const result = await collectRepository(root, {
        commits: 1,
        analyzeWorktree: async (worktreePath, commit) => {
          analyzedPaths.push(worktreePath);
          return createSnapshotFromWorkingTree(worktreePath, commit);
        },
      });

      expect(analyzedPaths).toHaveLength(1);
      expect(analyzedPaths[0]).not.toBe(root);
      expect(result.snapshots[0]?.repoPath).toBe(root);
      expect(result.snapshots[0]?.nodes.find(({ id }) => id === "repo")).toMatchObject({
        name: path.basename(root),
      });
    });
  });

  it("compares uncommitted working tree changes against HEAD for realtime analysis", async () => {
    await withGitRepo(async (root) => {
      await writeFile(
        path.join(root, "src", "live.ts"),
        "import { a } from './a';\nexport const live = a + 2;\n",
      );
      await writeFile(
        path.join(root, "src", "b.ts"),
        "import { a } from './a';\nimport { live } from './live';\nexport const b = a + live;\n",
      );

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
