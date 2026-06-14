import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import fg from "fast-glob";
import type { LanguageProvider } from "@sprawlens/schema";
import { snapshotRustWorkingTree } from "./extract.js";

/** Rust provider, backed by tree-sitter. */
export const rustProvider: LanguageProvider = {
  id: "rust",
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
    const commit = options?.commit ?? {
      hash: "WORKTREE",
      shortHash: "worktree",
      timestamp: new Date().toISOString(),
      authorName: "Working Tree",
      message: "Uncommitted working tree",
      aiIndicators: [],
    };
    return snapshotRustWorkingTree(repoPath, commit, basename(repoPath));
  },
};
