import type { DetailGraph } from "./detail.js";
import type { Snapshot, SnapshotCommit } from "./types.js";

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
 * A stateful analyzer that re-snapshots a single repo cheaply. `analyze()`
 * returns the current snapshot; it keeps a per-file parse cache keyed by
 * mtime/size, so on a re-run only the files that actually changed on disk are
 * re-parsed (the edge resolution, which is cheap, runs over the full set). A
 * file watcher calls `analyze()` again on each change to drive live updates.
 */
export interface IncrementalAnalyzer {
  analyze(): Promise<Snapshot>;
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
  /**
   * Optional incremental analyzer for live updates: re-parses only changed
   * files across calls. Providers that omit it get full re-analysis instead.
   */
  createIncrementalAnalyzer?(repoPath: string): IncrementalAnalyzer;
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
