import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import fg from "fast-glob";
import type { LanguageProvider } from "@sprawlens/schema";
import { snapshotGoWorkingTree } from "./extract.js";

/** Go provider, backed by tree-sitter. */
export const goProvider: LanguageProvider = {
  id: "go",
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
    const commit = options?.commit ?? {
      hash: "WORKTREE",
      shortHash: "worktree",
      timestamp: new Date().toISOString(),
      authorName: "Working Tree",
      message: "Uncommitted working tree",
      aiIndicators: [],
    };
    return snapshotGoWorkingTree(repoPath, commit, basename(repoPath));
  },
};
