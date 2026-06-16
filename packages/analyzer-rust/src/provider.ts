import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import fg from "fast-glob";
import type { LanguageProvider } from "@sprawlens/schema";
import { createStaticDetail } from "@sprawlens/schema";
import { snapshotRustWorkingTree } from "./extract.js";

const worktreeCommit = (timestamp: string) => ({
  hash: "WORKTREE",
  shortHash: "worktree",
  timestamp,
  authorName: "Working Tree",
  message: "Uncommitted working tree",
  aiIndicators: [],
});

/** Rust provider, backed by tree-sitter. */
export const rustProvider: LanguageProvider = {
  id: "rust",
  matchesManifest(repoPath) {
    return existsSync(join(repoPath, "Cargo.toml"));
  },
  async match(repoPath) {
    if (existsSync(join(repoPath, "Cargo.toml"))) return true;
    const hits = await fg("**/*.rs", {
      cwd: repoPath,
      ignore: ["**/target/**", "**/node_modules/**"],
      onlyFiles: true,
      deep: 4,
      suppressErrors: true,
    });
    return hits.length > 0;
  },
  analyze(repoPath, options) {
    const commit = options?.commit ?? worktreeCommit(new Date().toISOString());
    return snapshotRustWorkingTree(repoPath, commit, basename(repoPath));
  },
  // static call hierarchy from the tree-sitter symbol references (no LSP)
  detail: createStaticDetail((repoPath) =>
    snapshotRustWorkingTree(
      repoPath,
      worktreeCommit("1970-01-01T00:00:00.000Z"),
      basename(repoPath),
    ),
  ),
};
