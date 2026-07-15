export type RawDiffLineStat = {
  added: number;
  deleted: number;
  touched?: number;
};

export type DiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
};

export type NodeDiffStat = {
  added: number;
  deleted: number;
  touched: number;
  total: number;
  ratio: number;
  estimated?: boolean;
};

type SymbolLike = {
  id: string;
  metrics: { loc: number };
  sourceRange?: { startLine: number; endLine: number };
  parentId?: string;
  [key: string]: unknown;
};

type Measure = { added: number; deleted: number; touched: number };

/** Piecewise line-change prefix index. Build O(H log H), query O(log H). */
class LineChangeIndex {
  private readonly xs: number[];
  private readonly addedPrefix: number[];
  private readonly deletedPrefix: number[];
  private readonly touchedPrefix: number[];
  private readonly deletionLines: number[];
  private readonly deletionPrefix: number[];

  constructor(hunks: readonly DiffHunk[]) {
    const events = new Map<number, Measure>();
    const addEvent = (x: number, added: number, deleted: number, touched: number) => {
      const event = events.get(x) ?? { added: 0, deleted: 0, touched: 0 };
      event.added += added;
      event.deleted += deleted;
      event.touched += touched;
      events.set(x, event);
    };
    const deletionPoints: { line: number; deleted: number }[] = [];
    for (const hunk of hunks) {
      if (hunk.newLines > 0) {
        const end = hunk.newStart + hunk.newLines;
        const deletedDensity = hunk.oldLines / hunk.newLines;
        addEvent(hunk.newStart, 1, deletedDensity, 1);
        addEvent(end, -1, -deletedDensity, -1);
      } else if (hunk.oldLines > 0) {
        deletionPoints.push({ line: Math.max(1, hunk.newStart), deleted: hunk.oldLines });
      }
    }
    deletionPoints.sort((a, b) => a.line - b.line);
    this.deletionLines = deletionPoints.map((point) => point.line);
    this.deletionPrefix = [0];
    for (const point of deletionPoints) {
      this.deletionPrefix.push(
        this.deletionPrefix[this.deletionPrefix.length - 1]! + point.deleted,
      );
    }
    this.xs = [...events.keys()].sort((a, b) => a - b);
    this.addedPrefix = [];
    this.deletedPrefix = [];
    this.touchedPrefix = [];
    let added = 0;
    let deleted = 0;
    let touched = 0;
    let addedArea = 0;
    let deletedArea = 0;
    let touchedArea = 0;
    let previous = this.xs[0] ?? 0;
    for (let i = 0; i < this.xs.length; i++) {
      const x = this.xs[i]!;
      const width = x - previous;
      addedArea += added * width;
      deletedArea += deleted * width;
      touchedArea += touched * width;
      this.addedPrefix[i] = addedArea;
      this.deletedPrefix[i] = deletedArea;
      this.touchedPrefix[i] = touchedArea;
      const event = events.get(x)!;
      added += event.added;
      deleted += event.deleted;
      touched += event.touched;
      previous = x;
    }
  }

  query(startLine: number, endLine: number): Measure {
    const from = Math.max(1, startLine);
    const to = Math.max(from, endLine) + 1;
    const added = this.areaAt(to, this.addedPrefix) - this.areaAt(from, this.addedPrefix);
    const replacementDeleted =
      this.areaAt(to, this.deletedPrefix) - this.areaAt(from, this.deletedPrefix);
    const replacementTouched =
      this.areaAt(to, this.touchedPrefix) - this.areaAt(from, this.touchedPrefix);
    const deletionStart = lowerBound(this.deletionLines, from);
    const deletionEnd = upperBound(this.deletionLines, endLine);
    const pureDeleted = this.deletionPrefix[deletionEnd]! - this.deletionPrefix[deletionStart]!;
    // Prefix areas accumulate fractional replacement density across unrelated
    // events. Stabilize exact half values (for example 2.5 - ε) before applying
    // the same round-half-up rule as the direct hunk scan.
    const deleted = replacementDeleted > 0 ? Math.max(1, stableRound(replacementDeleted)) : 0;
    return {
      added: stableRound(added),
      deleted: deleted + pureDeleted,
      touched: stableRound(replacementTouched) + pureDeleted,
    };
  }

  private areaAt(x: number, prefix: readonly number[]): number {
    const index = upperBound(this.xs, x) - 1;
    if (index < 0) return 0;
    const start = this.xs[index]!;
    const base = prefix[index]!;
    if (index + 1 >= this.xs.length) return base;
    const next = this.xs[index + 1]!;
    if (x >= next) return prefix[index + 1]!;
    const width = next - start;
    if (width <= 0) return base;
    return base + ((prefix[index + 1]! - base) * (x - start)) / width;
  }
}

function stableRound(value: number): number {
  return Math.round(value + 1e-9);
}

export function parseSymbolStartLine(id: string): number | null {
  if (!id.startsWith("symbol:")) return null;
  const last = id.slice(id.lastIndexOf(":") + 1);
  if (!/^\d+$/.test(last)) return null;
  return Number.parseInt(last, 10);
}

export function normalizeFileDiffStats(
  raw: Record<string, RawDiffLineStat> | undefined,
  loc: Record<string, number> | undefined,
  graphLoc: ReadonlyMap<string, number>,
  changed: ReadonlyMap<string, "added" | "modified">,
): Map<string, NodeDiffStat> {
  const out = new Map<string, NodeDiffStat>();
  const paths = new Set([...Object.keys(raw ?? {}), ...changed.keys()]);
  for (const path of paths) {
    const kind = changed.get(path);
    const stat = raw?.[path];
    if (!kind && !stat) continue;
    const fallbackTotal = kind === "added" ? stat?.added : undefined;
    const total = Math.max(1, loc?.[path] ?? graphLoc.get(path) ?? fallbackTotal ?? 1);
    const added = stat?.added ?? (kind === "added" ? total : 0);
    const deleted = stat?.deleted ?? 0;
    const touched = stat?.touched ?? (kind === "added" ? total : added + deleted);
    const ratio = kind === "added" ? 1 : clamp01(touched / total);
    out.set(path, { added, deleted, touched, total, ratio });
  }
  return out;
}

export function buildSymbolDiffStats(
  symbols: readonly SymbolLike[],
  hunks: readonly DiffHunk[] | undefined,
): Map<string, NodeDiffStat> {
  const out = new Map<string, NodeDiffStat>();
  if (!hunks?.length) return out;
  const index = new LineChangeIndex(hunks);
  const legacyEnds = legacyExpandedEnds(symbols);
  for (const symbol of symbols) {
    const start = symbol.sourceRange?.startLine ?? parseSymbolStartLine(symbol.id);
    if (start === null) continue;
    const end =
      symbol.sourceRange?.endLine ??
      legacyEnds.get(symbol.id) ??
      start + Math.max(1, symbol.metrics.loc) - 1;
    const total = Math.max(1, end - start + 1);
    const { added, deleted, touched } = index.query(start, end);
    if (touched <= 0) continue;
    out.set(symbol.id, { added, deleted, touched, total, ratio: clamp01(touched / total) });
  }
  return out;
}

/** Recover the class span in snapshots predating explicit AST ranges. */
function legacyExpandedEnds(symbols: readonly SymbolLike[]): Map<string, number> {
  const classes = new Map<string, SymbolLike>();
  const ends = new Map<string, number>();
  for (const symbol of symbols) {
    const parts = symbol.id.split(":");
    if (parts.at(-3) !== "class") continue;
    const name = parts.at(-2);
    const start = parseSymbolStartLine(symbol.id);
    if (!name || start === null) continue;
    classes.set(name, symbol);
    ends.set(symbol.id, start + Math.max(1, symbol.metrics.loc) - 1);
  }
  for (const symbol of symbols) {
    const parts = symbol.id.split(":");
    const kind = parts.at(-3) ?? "";
    if (!kind.includes("method") && !kind.includes("property")) continue;
    const declaration = parts.at(-2) ?? "";
    const dot = declaration.lastIndexOf(".");
    const start = symbol.sourceRange?.startLine ?? parseSymbolStartLine(symbol.id);
    if (dot <= 0 || start === null) continue;
    const parent = classes.get(declaration.slice(0, dot));
    if (!parent) continue;
    const childEnd = symbol.sourceRange?.endLine ?? start + Math.max(1, symbol.metrics.loc) - 1;
    ends.set(parent.id, Math.max(ends.get(parent.id) ?? childEnd, childEnd));
  }
  return ends;
}

export function formatDiffPercent(stat: NodeDiffStat | undefined): string {
  if (!stat) return "";
  if (stat.estimated) return "";
  if (stat.ratio >= 0.995) return "100%";
  return `${Math.max(1, Math.round(stat.ratio * 100))}%`;
}

function subdueRange(value: number, base: number): number {
  return base + (value - base) * 0.62;
}

export function diffStrokeWidth(
  stat: NodeDiffStat | undefined,
  base: number,
  subdued = false,
): number {
  if (!stat) return base;
  const width = Math.max(base, 0.6 + 1.7 * Math.sqrt(stat.ratio));
  return subdued ? subdueRange(width, base) : width;
}

export function diffForegroundStrokeWidth(
  stat: NodeDiffStat | undefined,
  base: number,
  subdued = false,
  changedPreviewActive = false,
): number | undefined {
  if (!stat) return undefined;
  const width = diffStrokeWidth(stat, base) + (changedPreviewActive ? 0.15 : 0.4);
  const out = subdued ? subdueRange(width, base) : width;
  return changedPreviewActive ? Math.min(out, base + 0.8) : out;
}

export function diffOutlineOpacity(
  stat: NodeDiffStat | undefined,
  subdued = false,
  changedPreviewActive = false,
): number | undefined {
  if (!stat) return undefined;
  const opacity = 0.46 + 0.22 * Math.sqrt(stat.ratio);
  const out = subdued ? opacity * 0.62 : opacity;
  return changedPreviewActive ? Math.min(out, 0.38) : out;
}

export function diffBaseStrokeActive(
  stat: NodeDiffStat | undefined,
  changedPreviewActive: boolean,
): boolean {
  return stat !== undefined && !changedPreviewActive;
}

export function diffForegroundOutlineVisible(
  stat: NodeDiffStat | undefined,
  args: {
    changedPreviewActive: boolean;
    selected: boolean;
    screenPx: number;
  },
): boolean {
  if (!stat || args.selected) return false;
  return true;
}

export function fallbackChangedDiffStat(
  kind: "added" | "modified",
  total: number | undefined,
): NodeDiffStat {
  const safeTotal = Math.max(1, Math.round(total ?? 1));
  const ratio = kind === "added" ? 1 : 0.18;
  const touched = kind === "added" ? safeTotal : Math.max(1, Math.round(safeTotal * ratio));
  return {
    added: kind === "added" ? safeTotal : 0,
    deleted: 0,
    touched,
    total: safeTotal,
    ratio,
    estimated: true,
  };
}

function lowerBound(items: readonly number[], value: number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (items[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(items: readonly number[], value: number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (items[mid]! <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
