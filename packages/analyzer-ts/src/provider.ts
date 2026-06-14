import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import fg from "fast-glob";
import type { LanguageProvider } from "@sprawlens/schema";
import { SOURCE_EXTENSIONS, createSnapshotFromWorkingTree } from "./snapshot.js";

/** TypeScript / JavaScript provider, backed by the TS compiler API. */
export const tsProvider: LanguageProvider = {
  id: "typescript",
  async match(repoPath) {
    if (
      existsSync(join(repoPath, "tsconfig.json")) ||
      existsSync(join(repoPath, "package.json"))
    )
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
    const commit = options?.commit ?? {
      hash: "WORKTREE",
      shortHash: "worktree",
      timestamp: new Date().toISOString(),
      authorName: "Working Tree",
      message: "Uncommitted working tree",
      aiIndicators: [],
    };
    return createSnapshotFromWorkingTree(repoPath, commit, {
      repoPath,
      repoName: basename(repoPath),
    });
  },
};
