import type { CodeSymbol, CodeSymbolImport } from "@sprawlens/contracts";

/**
 * Symbol-level references (uses / used-by). An analyzer that resolves a file
 * import also knows which exported symbols of the target are actually used and
 * where; turning that into the neutral `symbolImports` contract lets the view
 * draw symbol→symbol edges (and, by reversing them, "referenced-by") for any
 * language — the same machinery TypeScript already drives. A language adapter
 * only has to find the usages; this resolves them against the symbol tables.
 */

/** The innermost declared symbol whose line range contains `line`, else null. */
export function enclosingSymbol(
  line: number,
  symbols: readonly CodeSymbol[],
): CodeSymbol | null {
  let best: CodeSymbol | null = null;
  for (const symbol of symbols) {
    if (symbol.startLine <= line && line <= symbol.endLine) {
      // prefer the most specific (latest-starting) enclosing symbol
      if (!best || symbol.startLine > best.startLine) best = symbol;
    }
  }
  return best;
}

/**
 * Resolve usages of imported names into `symbolImports`: each ref names a
 * target symbol used at a source line. The target must be an exported symbol of
 * the imported file (`targetExports` by name); the source end is the symbol
 * enclosing that line. Pairs are deduped by (from, to). Unmatched names (not
 * exported by this target, e.g. used from a different file of the package) are
 * dropped — call once per target file with that file's exports.
 */
export function resolveSymbolReferences(
  refs: readonly { line: number; name: string }[],
  sourceSymbols: readonly CodeSymbol[],
  targetExports: ReadonlyMap<string, CodeSymbol>,
): CodeSymbolImport[] {
  const out: CodeSymbolImport[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const target = targetExports.get(ref.name);
    if (!target) continue;
    const from = enclosingSymbol(ref.line, sourceSymbols);
    const key = `${from?.id ?? ""}->${target.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      imported: ref.name,
      local: ref.name,
      kind: "named",
      fromSymbolId: from?.id,
      fromSymbolName: from?.name,
      toSymbolId: target.id,
      toSymbolName: target.name,
    });
  }
  return out;
}
