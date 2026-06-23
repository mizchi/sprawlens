import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import fg from "fast-glob";
import type { LanguageProvider } from "@sprawlens/schema";
import { createStaticDetail } from "@sprawlens/schema";
import { snapshotGoWorkingTree } from "./extract.ts";

const worktreeCommit = (timestamp: string) => ({
  hash: "WORKTREE",
  shortHash: "worktree",
  timestamp,
  authorName: "Working Tree",
  message: "Uncommitted working tree",
  aiIndicators: [],
});

/** Go provider, backed by tree-sitter. */
export const goProvider: LanguageProvider = {
  id: "go",
  matchesManifest(repoPath) {
    return existsSync(join(repoPath, "go.mod"));
  },
  async match(repoPath) {
    if (existsSync(join(repoPath, "go.mod"))) return true;
    const hits = await fg("**/*.go", {
      cwd: repoPath,
      ignore: ["**/vendor/**", "**/node_modules/**"],
      onlyFiles: true,
      deep: 4,
      suppressErrors: true,
    });
    return hits.length > 0;
  },
  analyze(repoPath, options) {
    const commit = options?.commit ?? worktreeCommit(new Date().toISOString());
    return snapshotGoWorkingTree(repoPath, commit, basename(repoPath));
  },
  // static call hierarchy from the tree-sitter symbol references (no LSP)
  detail: createStaticDetail((repoPath) =>
    snapshotGoWorkingTree(repoPath, worktreeCommit("1970-01-01T00:00:00.000Z"), basename(repoPath)),
  ),
};
