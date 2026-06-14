import type { Snapshot, SnapshotCommit } from "./core/types.js";

/**
 * A language provider turns a repository's working tree into a neutral
 * Snapshot. Structure (files, symbols, imports) is the contract every language
 * fills via its own parser (TS compiler, tree-sitter, ...); deep detail (CFG,
 * call hierarchy) is optional and stays language-specific.
 */
export interface LanguageProvider {
  /** Stable id, e.g. "typescript", "go", "rust". */
  readonly id: string;
  /** Does this provider handle the repo? (extensions / config files) */
  match(repoPath: string): boolean | Promise<boolean>;
  /** Snapshot the current working tree. */
  analyze(
    repoPath: string,
    options?: { commit?: SnapshotCommit },
  ): Promise<Snapshot>;
}

/** First provider that claims the repo, or null if none match. */
export async function selectProvider(
  providers: readonly LanguageProvider[],
  repoPath: string,
): Promise<LanguageProvider | null> {
  for (const provider of providers) {
    if (await provider.match(repoPath)) return provider;
  }
  return null;
}
