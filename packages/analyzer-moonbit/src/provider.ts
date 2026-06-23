import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import fg from "fast-glob";
import type { LanguageProvider } from "@sprawlens/schema";
import { snapshotMoonbitWorkingTree } from "./extract.ts";
import { moonbitDetail } from "./detail.ts";

/** MoonBit provider (heuristic; tree-sitter when a grammar ships). */
export const moonbitProvider: LanguageProvider = {
  id: "moonbit",
  matchesManifest(repoPath) {
    return existsSync(join(repoPath, "moon.mod.json")) || existsSync(join(repoPath, "moon.mod"));
  },
  async match(repoPath) {
    if (existsSync(join(repoPath, "moon.mod.json")) || existsSync(join(repoPath, "moon.mod")))
      return true;
    const hits = await fg("**/*.mbt", {
      cwd: repoPath,
      ignore: ["**/target/**", "**/.mooncakes/**"],
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
    return snapshotMoonbitWorkingTree(repoPath, commit, basename(repoPath));
  },
  // compiler-aware detail via `moon ide`; no-ops when the toolchain is absent
  detail: moonbitDetail,
};
