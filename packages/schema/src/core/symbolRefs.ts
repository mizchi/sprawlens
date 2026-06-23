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
export function enclosingSymbol(line: number, symbols: readonly CodeSymbol[]): CodeSymbol | null {
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

/**
 * Pick the exported symbol named `name`, preferring one whose `parentClass`
 * matches `preferClass` (a `Type::method` / receiver qualifier) — names alone
 * collide across types, so a qualifier disambiguates. Falls back to the first
 * symbol of that name; null when none has it.
 */
export function pickExported(
  symbols: readonly CodeSymbol[],
  name: string,
  preferClass: string | undefined,
): CodeSymbol | null {
  let fallback: CodeSymbol | null = null;
  for (const s of symbols) {
    if (s.name !== name) continue;
    if (preferClass && s.parentClass === preferClass) return s;
    fallback ??= s;
  }
  return fallback;
}

/** Append symbol refs not already present (deduped by from→to symbol pair). */
export function mergeSymbolImports(
  into: CodeSymbolImport[],
  add: readonly CodeSymbolImport[],
): void {
  for (const si of add) {
    const key = `${si.fromSymbolId ?? ""}->${si.toSymbolId}`;
    if (into.some((x) => `${x.fromSymbolId ?? ""}->${x.toSymbolId}` === key)) continue;
    into.push(si);
  }
}

/**
 * Resolve one reference into a `symbolImport`: the target is the exported
 * symbol named `ref.name` (preferring `ref.preferClass` for a typed member),
 * the source end is the symbol enclosing `ref.line`. Null when the target file
 * exports no such symbol. The qualified-path counterpart to
 * `resolveSymbolReferences` — call per resolved reference.
 */
export function symbolImportOf(
  ref: { line: number; name: string; preferClass?: string },
  sourceSymbols: readonly CodeSymbol[],
  targetSymbols: readonly CodeSymbol[],
): CodeSymbolImport | null {
  const target = pickExported(targetSymbols, ref.name, ref.preferClass);
  if (!target) return null;
  const from = enclosingSymbol(ref.line, sourceSymbols);
  return {
    imported: ref.name,
    local: ref.name,
    kind: "named",
    fromSymbolId: from?.id,
    fromSymbolName: from?.name,
    toSymbolId: target.id,
    toSymbolName: target.name,
  };
}
