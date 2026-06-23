import { describe, expect, it } from "vitest";
import type { WorkingDiff } from "@sprawlens/server";
import { formatDiffNote, toDiffOverlay } from "./diffRender.ts";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { workingDiff } from "@sprawlens/server";
import { tsProvider } from "@sprawlens/analyzer-ts";
import { snapshotToAtlasGraph } from "@sprawlens/schema";
import { renderAtlasSvg } from "@sprawlens/viz/headless";

const exec = promisify(execFile);
const git = (cwd: string, args: string[]) => exec("git", args, { cwd });

describe("formatDiffNote", () => {
  it("formats counts as +added ~modified -removed", () => {
    expect(formatDiffNote({ added: 2, modified: 5, removed: 0 })).toBe("+2 ~5 -0");
    expect(formatDiffNote({ added: 0, modified: 0, removed: 0 })).toBe("+0 ~0 -0");
  });
});

describe("toDiffOverlay", () => {
  it("splits changed entries into added/modified and counts removed", () => {
    const diff: WorkingDiff = {
      changed: { "src/a.ts": "modified", "src/b.ts": "added", "src/c.ts": "added" },
      removed: ["src/old.ts", "src/gone.ts"],
    };
    const { changed, diffSummary } = toDiffOverlay(diff);
    expect(changed.get("src/a.ts")).toBe("modified");
    expect(changed.get("src/b.ts")).toBe("added");
    expect(diffSummary).toEqual({ added: 2, modified: 1, removed: 2 });
  });

  it("handles an empty diff", () => {
    const { changed, diffSummary } = toDiffOverlay({ changed: {}, removed: [] });
    expect(changed.size).toBe(0);
    expect(diffSummary).toEqual({ added: 0, modified: 0, removed: 0 });
  });
});

describe("diff render end-to-end", () => {
  it("tints changed files and reports counts vs a base commit", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sprawlens-diff-"));
    try {
      await git(root, ["init"]);
      await git(root, ["config", "user.email", "test@example.com"]);
      await git(root, ["config", "user.name", "Test User"]);
      await mkdir(path.join(root, "src"), { recursive: true });
      await writeFile(path.join(root, "src", "a.ts"), "export const a = 1;\n");
      await writeFile(path.join(root, "src", "old.ts"), "export const old = 0;\n");
      await git(root, ["add", "."]);
      await git(root, ["commit", "-m", "base"]);
      const base = (await git(root, ["rev-parse", "HEAD"])).stdout.trim();

      // modify a.ts, add b.ts, remove old.ts
      await writeFile(path.join(root, "src", "a.ts"), "export const a = 2;\n");
      await writeFile(path.join(root, "src", "b.ts"), "export const b = 3;\n");
      await rm(path.join(root, "src", "old.ts"));
      await git(root, ["add", "-A"]);
      await git(root, ["commit", "-m", "change"]);

      const diff = await workingDiff(root, base);
      const { changed, diffSummary } = toDiffOverlay(diff);
      expect(diffSummary).toEqual({ added: 1, modified: 1, removed: 1 });

      const snapshot = await tsProvider.analyze(root);
      const graph = snapshotToAtlasGraph(snapshot as Parameters<typeof snapshotToAtlasGraph>[0]);
      const svg = renderAtlasSvg(graph, { layout: "treemap", seed: 1, changed, diffSummary });

      expect(svg).toContain("hsl(150 55% 80%)"); // ADDED_FILL — b.ts
      expect(svg).toContain("hsl(8 85% 78%)"); // MODIFIED_FILL — a.ts
      expect(svg).toContain("removed 1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
