import { diffAstSymbols, type AstSymbolLike } from "./astSymbolDiff.ts";
import type {
  AstDiffGoldCase,
  AstDiffPredictor,
  AstDiffStatus,
} from "./astSymbolDiffEvaluation.ts";

export const AST_DIFF_BASELINES = [
  "file-all-symbols",
  "range-overlap",
  "structural-flat",
  "parent-aware",
] as const;

export type AstDiffBaseline = (typeof AST_DIFF_BASELINES)[number];

export function predictAstDiffBaseline(
  baseline: AstDiffBaseline,
  testCase: AstDiffGoldCase,
  changedAfterLines: readonly number[],
): ReadonlyMap<string, AstDiffStatus> {
  if (baseline === "parent-aware") return diffAstSymbols(testCase.before, testCase.after);
  const indexedBefore = indexFlat(testCase.before);
  const indexedAfter = indexFlat(testCase.after);
  const beforeByKey = new Map(indexedBefore.map((entry) => [entry.key, entry.symbol]));
  const result = new Map<string, AstDiffStatus>();
  for (const entry of indexedAfter) {
    const previous = beforeByKey.get(entry.key);
    const status: AstDiffStatus = previous ? "modified" : "added";
    if (baseline === "file-all-symbols") {
      result.set(entry.symbol.id, status);
    } else if (baseline === "range-overlap") {
      if (overlapsChangedLine(entry.symbol, changedAfterLines)) result.set(entry.symbol.id, status);
    } else if (!previous || metricsChanged(previous, entry.symbol)) {
      result.set(entry.symbol.id, status);
    }
  }
  return result;
}

export function astDiffBaselinePredictor(baseline: AstDiffBaseline): AstDiffPredictor {
  return (testCase, changedAfterLines) =>
    predictAstDiffBaseline(baseline, testCase, changedAfterLines);
}

function indexFlat(
  symbols: readonly AstSymbolLike[],
): Array<{ symbol: AstSymbolLike; key: string }> {
  const sorted = [...symbols].sort(
    (a, b) => lineOf(a) - lineOf(b) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
  );
  const occurrence = new Map<string, number>();
  return sorted.map((symbol) => {
    const base = `${symbol.kind}\0${symbol.name}`;
    const ordinal = occurrence.get(base) ?? 0;
    occurrence.set(base, ordinal + 1);
    return { symbol, key: `${base}\0#${ordinal}` };
  });
}

function overlapsChangedLine(symbol: AstSymbolLike, changedAfterLines: readonly number[]): boolean {
  const start = lineOf(symbol);
  const end = symbol.endLine ?? start + Math.max(1, symbol.loc) - 1;
  return changedAfterLines.some((line) => start <= line && line <= end);
}

function lineOf(symbol: AstSymbolLike): number {
  if (symbol.startLine !== undefined) return symbol.startLine;
  const value = Number.parseInt(symbol.id.slice(symbol.id.lastIndexOf(":") + 1), 10);
  return Number.isFinite(value) ? value : 0;
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
