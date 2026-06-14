import type { DetailGraph } from "./contracts/detail.js";
import type { Snapshot, SnapshotCommit } from "./core/types.js";

/** A symbol referenced by a call-hierarchy result, repo-relative. */
export type SymbolRef = { file: string; name: string; line: number };
export type CallHierarchyResult = {
  incoming: SymbolRef[];
  outgoing: SymbolRef[];
};

/**
 * Deep, on-demand detail for a symbol — control-flow graph and call hierarchy.
 * Language-specific (LSP / native parser); a provider may omit it and the map
 * still shows structure. Paths are repo-relative; `repoRoot` is absolute.
 */
export interface LanguageDetail {
  cfg(
    repoRoot: string,
    file: string,
    line: number,
  ): Promise<DetailGraph | null> | DetailGraph | null;
  callHierarchy(
    repoRoot: string,
    file: string,
    symbol: string,
  ): Promise<CallHierarchyResult>;
}

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
  /** Optional deep detail (CFG, call hierarchy). */
  detail?: LanguageDetail;
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
