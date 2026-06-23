import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import fg from "fast-glob";
import type { LanguageProvider, SnapshotCommit } from "@sprawlens/schema";
import { SOURCE_EXTENSIONS, createSnapshotFromWorkingTree, type ParseCache } from "./snapshot.js";
import { tsDetail } from "./detail.js";

/** Synthetic commit for an uncommitted working-tree snapshot. */
function worktreeCommit(): SnapshotCommit {
  return {
    hash: "WORKTREE",
    shortHash: "worktree",
    timestamp: new Date().toISOString(),
    authorName: "Working Tree",
    message: "Uncommitted working tree",
    aiIndicators: [],
  };
}

/** TypeScript / JavaScript provider, backed by the TS compiler API. */
export const tsProvider: LanguageProvider = {
  id: "typescript",
  matchesManifest(repoPath) {
    return (
      existsSync(join(repoPath, "tsconfig.json")) || existsSync(join(repoPath, "package.json"))
    );
  },
  async match(repoPath) {
    if (existsSync(join(repoPath, "tsconfig.json")) || existsSync(join(repoPath, "package.json")))
      return true;
    const hits = await fg(
      SOURCE_EXTENSIONS.map((ext) => `**/*${ext}`),
      {
        cwd: repoPath,
        ignore: ["**/node_modules/**"],
        onlyFiles: true,
        deep: 4,
        suppressErrors: true,
      },
    );
    return hits.length > 0;
  },
  analyze(repoPath, options) {
    return createSnapshotFromWorkingTree(repoPath, options?.commit ?? worktreeCommit(), {
      repoPath,
      repoName: basename(repoPath),
    });
  },
  createIncrementalAnalyzer(repoPath) {
    // one cache per analyzer instance: re-runs re-parse only changed files
    const cache: ParseCache = new Map();
    return {
      analyze() {
        return createSnapshotFromWorkingTree(repoPath, worktreeCommit(), {
          repoPath,
          repoName: basename(repoPath),
          cache,
        });
      },
    };
  },
  detail: tsDetail,
};
