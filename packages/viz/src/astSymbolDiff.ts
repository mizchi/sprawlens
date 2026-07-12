export type AstSymbolLike = {
  id: string;
  name: string;
  kind: string;
  startLine?: number;
  endLine?: number;
  loc: number;
  complexity?: number;
  parentClass?: string;
  fingerprint?: string;
};

type IndexedSymbol = {
  symbol: AstSymbolLike;
  key: string;
  parentKey: string | null;
  parentId: string | null;
};

/**
 * Structural symbol-tree diff. Identity ignores declaration line shifts and
 * includes the parent path, so same-name methods in different classes do not
 * collide. Changed descendants propagate to their visible parent. Sorting is
 * the dominant cost: O(S log S) time and O(S) memory.
 */
export function diffAstSymbols(
  before: readonly AstSymbolLike[],
  after: readonly AstSymbolLike[],
): Map<string, "added" | "modified"> {
  const previous = indexSymbols(before);
  const next = indexSymbols(after);
  const previousByKey = new Map(previous.map((entry) => [entry.key, entry]));
  const nextByKey = new Map(next.map((entry) => [entry.key, entry]));
  const result = new Map<string, "added" | "modified">();

  for (const entry of next) {
    const old = previousByKey.get(entry.key);
    if (!old) result.set(entry.symbol.id, "added");
    else if (metricsChanged(old.symbol, entry.symbol)) result.set(entry.symbol.id, "modified");
  }

  // Removed children have no new id to paint, but their surviving parent does.
  for (const old of previous) {
    if (nextByKey.has(old.key) || old.parentKey === null) continue;
    const parent = nextByKey.get(old.parentKey);
    if (parent && !result.has(parent.symbol.id)) result.set(parent.symbol.id, "modified");
  }

  // Aggregate child edits through the AST containment chain.
  const nextById = new Map(next.map((entry) => [entry.symbol.id, entry]));
  for (const entry of next) {
    if (!result.has(entry.symbol.id)) continue;
    let parentId: string | null = entry.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = nextById.get(parentId);
      if (!parent) break;
      if (!result.has(parent.symbol.id)) result.set(parent.symbol.id, "modified");
      parentId = parent.parentId;
    }
  }
  return result;
}

function indexSymbols(symbols: readonly AstSymbolLike[]): IndexedSymbol[] {
  const byId = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const classesByName = new Map<string, AstSymbolLike[]>();
  for (const symbol of symbols) {
    if (symbol.kind !== "class") continue;
    const list = classesByName.get(symbol.name) ?? [];
    list.push(symbol);
    classesByName.set(symbol.name, list);
  }
  for (const list of classesByName.values()) list.sort((a, b) => lineOf(a) - lineOf(b));
  const parentIdById = new Map<string, string>();
  for (const symbol of symbols) {
    if (symbol.parentClass) {
      parentIdById.set(symbol.id, symbol.parentClass);
      continue;
    }
    if (!symbol.kind.includes("method") && !symbol.kind.includes("property")) continue;
    const declaration = symbol.id.split(":").at(-2) ?? "";
    const dot = declaration.lastIndexOf(".");
    if (dot <= 0) continue;
    const className = declaration.slice(0, dot);
    const line = lineOf(symbol);
    const parent = latestAtOrBefore(classesByName.get(className) ?? [], line);
    if (parent) parentIdById.set(symbol.id, parent.id);
  }
  const baseKeyMemo = new Map<string, string>();
  const baseKeyOf = (symbol: AstSymbolLike, seen = new Set<string>()): string => {
    const cached = baseKeyMemo.get(symbol.id);
    if (cached) return cached;
    const own = `${symbol.kind}\0${symbol.name}`;
    const parentId = parentIdById.get(symbol.id);
    if (!parentId || seen.has(symbol.id)) {
      baseKeyMemo.set(symbol.id, own);
      return own;
    }
    seen.add(symbol.id);
    const parent = byId.get(parentId);
    const key = parent ? `${baseKeyOf(parent, seen)}\0${own}` : `${parentId}\0${own}`;
    baseKeyMemo.set(symbol.id, key);
    return key;
  };
  const sorted = [...symbols].sort(
    (a, b) =>
      lineOf(a) - lineOf(b) ||
      (a.endLine ?? lineOf(a)) - (b.endLine ?? lineOf(b)) ||
      a.id.localeCompare(b.id),
  );
  const occurrence = new Map<string, number>();
  const keyById = new Map<string, string>();
  const out: IndexedSymbol[] = [];
  for (const symbol of sorted) {
    const base = baseKeyOf(symbol);
    const ordinal = occurrence.get(base) ?? 0;
    occurrence.set(base, ordinal + 1);
    const key = `${base}\0#${ordinal}`;
    keyById.set(symbol.id, key);
    out.push({ symbol, key, parentKey: null, parentId: parentIdById.get(symbol.id) ?? null });
  }
  for (const entry of out) {
    entry.parentKey = entry.parentId ? (keyById.get(entry.parentId) ?? null) : null;
  }
  return out;
}

function latestAtOrBefore(
  items: readonly AstSymbolLike[],
  line: number,
): AstSymbolLike | undefined {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (lineOf(items[mid]!) <= line) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? items[lo - 1] : undefined;
}

function lineOf(symbol: AstSymbolLike): number {
  if (symbol.startLine !== undefined) return symbol.startLine;
  const last = symbol.id.slice(symbol.id.lastIndexOf(":") + 1);
  const line = Number.parseInt(last, 10);
  return Number.isFinite(line) ? line : 0;
}

function metricsChanged(before: AstSymbolLike, after: AstSymbolLike): boolean {
  return (
    before.loc !== after.loc ||
    before.complexity !== after.complexity ||
    (before.fingerprint !== undefined &&
      after.fingerprint !== undefined &&
      before.fingerprint !== after.fingerprint)
  );
}
