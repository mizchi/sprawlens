import type {
  CallHierarchyResult,
  LanguageDetail,
  Snapshot,
  SymbolRef,
} from "@sprawlens/contracts";

/**
 * Static call hierarchy from a snapshot's symbol references. The analyzers
 * already resolve symbol→symbol references (the `symbolImports` on import
 * edges); this answers "who references this symbol" (incoming) and "what does
 * it reference" (outgoing) by querying them — no language server needed, so a
 * tree-sitter provider can serve `detail.callHierarchy` from its own parse.
 *
 * `file` is repo-relative; `symbol` is the bare name. Refs are deduped.
 */
export function callHierarchyFromSnapshot(
  snapshot: Snapshot,
  file: string,
  symbol: string,
): CallHierarchyResult {
  const incoming = new Map<string, SymbolRef>();
  const outgoing = new Map<string, SymbolRef>();
  const key = (r: SymbolRef) => `${r.file}:${r.name}:${r.line}`;

  for (const edge of snapshot.edges) {
    if (edge.type !== "imports" || !edge.symbolImports) continue;
    const fromFile = fileOfId(edge.from);
    const toFile = fileOfId(edge.to);
    for (const si of edge.symbolImports) {
      // toSymbol is defined in `toFile`, used by fromSymbol in `fromFile`
      if (
        si.toSymbolName === symbol &&
        toFile === file &&
        si.fromSymbolName &&
        fromFile
      ) {
        const ref: SymbolRef = {
          file: fromFile,
          name: si.fromSymbolName,
          line: lineOfId(si.fromSymbolId),
        };
        incoming.set(key(ref), ref);
      }
      if (
        si.fromSymbolName === symbol &&
        fromFile === file &&
        si.toSymbolName &&
        toFile
      ) {
        const ref: SymbolRef = {
          file: toFile,
          name: si.toSymbolName,
          line: lineOfId(si.toSymbolId),
        };
        outgoing.set(key(ref), ref);
      }
    }
  }
  return { incoming: [...incoming.values()], outgoing: [...outgoing.values()] };
}

/**
 * A `detail` provider backed by static analysis: re-snapshot the repo (cached
 * per root for the session) and answer call hierarchy from its symbol
 * references. No CFG — tree-sitter parses give structure + references, not
 * control flow. This is how a non-LSP analyzer (Go, Rust) serves `detail`.
 */
export function createStaticDetail(
  analyze: (repoRoot: string) => Promise<Snapshot>,
): LanguageDetail {
  const cache = new Map<string, Promise<Snapshot>>();
  const snapshotOf = (root: string) => {
    let pending = cache.get(root);
    if (!pending) cache.set(root, (pending = analyze(root)));
    return pending;
  };
  return {
    cfg: () => null,
    async callHierarchy(repoRoot, file, symbol) {
      try {
        return callHierarchyFromSnapshot(
          await snapshotOf(repoRoot),
          file,
          symbol,
        );
      } catch {
        return { incoming: [], outgoing: [] };
      }
    },
  };
}

/** `file:<path>` → `<path>`, else null. */
function fileOfId(id: string): string | null {
  return id.startsWith("file:") ? id.slice("file:".length) : null;
}

/** Line from a `symbol:<path>:<kind>:<name>:<line>` id (1 if unparseable). */
function lineOfId(id: string | undefined): number {
  if (!id) return 1;
  const line = Number(id.slice(id.lastIndexOf(":") + 1));
  return Number.isFinite(line) && line > 0 ? line : 1;
}
