import type { DetailGraph } from "./detail.ts";
import type { Snapshot, SnapshotCommit } from "./types.ts";

/** A symbol referenced by a call-hierarchy result, repo-relative. */
export type SymbolRef = { file: string; name: string; line: number };
export type CallHierarchyResult = {
  incoming: SymbolRef[];
  outgoing: SymbolRef[];
};

/** LSP hover for a symbol, flattened to one markdown string (signature/type/doc). */
export type HoverInfo = { markdown: string };

/**
 * Deep, on-demand detail for a symbol — control-flow graph and call hierarchy.
 * Language-specific (LSP / native parser); a provider may omit it and the map
 * still shows structure. Paths are repo-relative; `repoRoot` is absolute.
 */
export interface LanguageDetail {
  /** What backs this detail: a language server ("lsp") or static tree-sitter
   * analysis ("static"). Lets `doctor` report whether an LSP is actually wired
   * vs the tree-sitter baseline. */
  readonly backend?: "lsp" | "static";
  cfg(
    repoRoot: string,
    file: string,
    line: number,
  ): Promise<DetailGraph | null> | DetailGraph | null;
  callHierarchy(repoRoot: string, file: string, symbol: string): Promise<CallHierarchyResult>;
  /** Optional LSP hover (signature/type/doc) for a symbol; null when none. */
  hover?(repoRoot: string, file: string, symbol: string): Promise<HoverInfo | null>;
}

/**
 * A stateful analyzer that re-snapshots a single repo cheaply. `analyze()`
 * returns the current snapshot; it keeps a per-file parse cache keyed by
 * mtime/size, so on a re-run only the files that actually changed on disk are
 * re-parsed (the edge resolution, which is cheap, runs over the full set). A
 * file watcher calls `analyze()` again on each change to drive live updates.
 */
interface IncrementalAnalyzer {
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
  /** Could this provider handle the repo? (root manifest OR source files) */
  match(repoPath: string): boolean | Promise<boolean>;
  /**
   * Does the repo's ROOT name this language definitively? (go.mod, Cargo.toml,
   * package.json/tsconfig.json, moon.mod.json). A strong signal that wins over
   * a mere `match` on stray source files in a subdirectory.
   */
  matchesManifest?(repoPath: string): boolean | Promise<boolean>;
  /** Snapshot the current working tree. */
  analyze(repoPath: string, options?: { commit?: SnapshotCommit }): Promise<Snapshot>;
  /**
   * Optional incremental analyzer for live updates: re-parses only changed
   * files across calls. Providers that omit it get full re-analysis instead.
   */
  createIncrementalAnalyzer?(repoPath: string): IncrementalAnalyzer;
  /** Optional deep detail (CFG, call hierarchy). */
  detail?: LanguageDetail;
}

/**
 * All providers that claim the repo, split into `strong` (the root manifest
 * names the language) and the full `matched` set (manifest or stray source
 * files). The caller picks: one strong winner is unambiguous; several strong
 * (or none, with several weak matches) is a choice the user should make.
 */
export async function detectProviders(
  providers: readonly LanguageProvider[],
  repoPath: string,
): Promise<{ matched: LanguageProvider[]; strong: LanguageProvider[] }> {
  const matched: LanguageProvider[] = [];
  const strong: LanguageProvider[] = [];
  for (const provider of providers) {
    const isStrong = provider.matchesManifest ? await provider.matchesManifest(repoPath) : false;
    if (isStrong) {
      strong.push(provider);
      matched.push(provider);
    } else if (await provider.match(repoPath)) {
      matched.push(provider);
    }
  }
  return { matched, strong };
}
