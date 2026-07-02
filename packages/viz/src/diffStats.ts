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
  [key: string]: unknown;
};

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
  for (const symbol of symbols) {
    const start = parseSymbolStartLine(symbol.id);
    if (start === null) continue;
    const total = Math.max(1, Math.round(symbol.metrics.loc));
    const end = start + total - 1;
    let added = 0;
    let deleted = 0;
    let touched = 0;
    for (const hunk of hunks) {
      if (hunk.newLines > 0) {
        const overlap = overlapLines(start, end, hunk.newStart, hunk.newStart + hunk.newLines - 1);
        if (overlap <= 0) continue;
        added += overlap;
        deleted += Math.min(overlap, hunk.oldLines);
        touched += overlap;
      } else if (hunk.oldLines > 0 && hunk.newStart >= start && hunk.newStart <= end) {
        deleted += hunk.oldLines;
        touched += hunk.oldLines;
      }
    }
    if (touched <= 0) continue;
    out.set(symbol.id, { added, deleted, touched, total, ratio: clamp01(touched / total) });
  }
  return out;
}

export function formatDiffPercent(stat: NodeDiffStat | undefined): string {
  if (!stat) return "";
  if (stat.estimated) return "";
  if (stat.ratio >= 0.995) return "100%";
  return `${Math.max(1, Math.round(stat.ratio * 100))}%`;
}

export function diffStrokeWidth(stat: NodeDiffStat | undefined, base: number): number {
  if (!stat) return base;
  return Math.max(base, 0.9 + 3.2 * Math.sqrt(stat.ratio));
}

export function diffForegroundStrokeWidth(
  stat: NodeDiffStat | undefined,
  base: number,
): number | undefined {
  if (!stat) return undefined;
  return diffStrokeWidth(stat, base) + 0.9;
}

export function diffOutlineOpacity(stat: NodeDiffStat | undefined): number | undefined {
  if (!stat) return undefined;
  return 0.74 + 0.24 * Math.sqrt(stat.ratio);
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

function overlapLines(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart) + 1);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
