import type { AstSymbolLike } from "./astSymbolDiff.ts";
import type { DiffHunk, NodeDiffStat } from "./diffStats.ts";

export type AstDiffProjectionSymbol = {
  id: string;
  metrics: { loc: number };
  sourceRange: { startLine: number; endLine: number };
  parentId?: string;
};

export type AstDiffScalingMeasurement = {
  schemaVersion: 1;
  kernel: "hunk-projection" | "symbol-tree";
  condition: "indexed" | "naive" | "parent-aware";
  symbolCount: number;
  hunkCount: number;
  maxDepth: number;
  seed: number;
  repetition: number;
  warmupIterations: number;
  status: "ok" | "timeout" | "error";
  durationMs: number | null;
  maxRssKb: number | null;
  outputDigest: string | null;
  outputItems: number | null;
  error: string | null;
};

export type AstDiffScalingDistribution = {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
};

export type AstDiffScalingGroup = {
  kernel: AstDiffScalingMeasurement["kernel"];
  condition: AstDiffScalingMeasurement["condition"];
  symbolCount: number;
  hunkCount: number;
  maxDepth: number;
  repetitions: number;
  successfulRepetitions: number;
  failures: number;
  timeouts: number;
  durationMs: AstDiffScalingDistribution | null;
  maxRssKb: AstDiffScalingDistribution | null;
  outputDigest: string | null;
  outputItems: number | null;
};

export type AstDiffScalingSummary = {
  groups: AstDiffScalingGroup[];
  projectionComparisons: Array<{
    symbolCount: number;
    hunkCount: number;
    repetitions: number;
    indexedP50Ms: number;
    naiveP50Ms: number;
    speedup: number;
    indexedP50MaxRssKb: number;
    naiveP50MaxRssKb: number;
    memoryRatio: number;
  }>;
};

/**
 * Reference implementation for the pre-index projection path. Each symbol
 * scans every hunk, making the intended comparison O(SH) time / O(S) output.
 */
export function buildSymbolDiffStatsNaive(
  symbols: readonly AstDiffProjectionSymbol[],
  hunks: readonly DiffHunk[],
): Map<string, NodeDiffStat> {
  const output = new Map<string, NodeDiffStat>();
  for (const symbol of symbols) {
    const start = Math.max(1, symbol.sourceRange.startLine);
    const end = Math.max(start, symbol.sourceRange.endLine);
    let added = 0;
    let replacementDeleted = 0;
    let replacementTouched = 0;
    let pureDeleted = 0;
    for (const hunk of hunks) {
      if (hunk.newLines > 0) {
        const hunkStart = hunk.newStart;
        const hunkEnd = hunk.newStart + hunk.newLines - 1;
        const overlap = Math.max(0, Math.min(end, hunkEnd) - Math.max(start, hunkStart) + 1);
        if (overlap === 0) continue;
        added += overlap;
        replacementDeleted += overlap * (hunk.oldLines / hunk.newLines);
        replacementTouched += overlap;
      } else if (
        hunk.oldLines > 0 &&
        Math.max(1, hunk.newStart) >= start &&
        Math.max(1, hunk.newStart) <= end
      ) {
        pureDeleted += hunk.oldLines;
      }
    }
    const touched = Math.round(replacementTouched) + pureDeleted;
    if (touched <= 0) continue;
    const deleted =
      (replacementDeleted > 0 ? Math.max(1, Math.round(replacementDeleted)) : 0) + pureDeleted;
    const total = Math.max(1, end - start + 1);
    output.set(symbol.id, {
      added: Math.round(added),
      deleted,
      touched,
      total,
      ratio: Math.max(0, Math.min(1, touched / total)),
    });
  }
  return output;
}

export function createAstDiffProjectionFixture(options: {
  symbolCount: number;
  hunkCount: number;
  seed: number;
}): { symbols: AstDiffProjectionSymbol[]; hunks: DiffHunk[] } {
  assertPositiveInteger(options.symbolCount, "symbolCount");
  assertPositiveInteger(options.hunkCount, "hunkCount");
  assertSafeInteger(options.seed, "seed");
  const random = seededRandom(options.seed);
  const totalLines = Math.max(100, options.symbolCount * 6, options.hunkCount * 8);
  const symbols = Array.from({ length: options.symbolCount }, (_, index) => {
    const startLine = 1 + Math.floor((index * totalLines) / options.symbolCount);
    const endLine = Math.min(totalLines, startLine + 1 + Math.floor(random() * 18));
    return {
      id: `symbol:synthetic.ts:function:s${index}:${startLine}`,
      metrics: { loc: endLine - startLine + 1 },
      sourceRange: { startLine, endLine },
    };
  });
  const hunks = Array.from({ length: options.hunkCount }, (_, index) => {
    const deletionOnly = index % 11 === 0;
    const newStart = 1 + Math.floor(random() * totalLines);
    const newLines = deletionOnly ? 0 : 1 + Math.floor(random() * 6);
    const oldLines = deletionOnly ? 1 + Math.floor(random() * 8) : Math.floor(random() * 7);
    return {
      oldStart: Math.max(1, newStart + Math.floor(random() * 5) - 2),
      oldLines,
      newStart,
      newLines,
    };
  });
  return { symbols, hunks };
}

export function createAstDiffTreeFixture(options: {
  symbolCount: number;
  maxDepth: number;
  seed: number;
}): { before: AstSymbolLike[]; after: AstSymbolLike[] } {
  assertPositiveInteger(options.symbolCount, "symbolCount");
  assertPositiveInteger(options.maxDepth, "maxDepth");
  assertSafeInteger(options.seed, "seed");
  if (options.maxDepth > options.symbolCount) {
    throw new Error("maxDepth must not exceed symbolCount");
  }
  const random = seededRandom(options.seed);
  const beforeIds: string[] = [];
  const afterIds: string[] = [];
  for (let index = 0; index < options.symbolCount; index += 1) {
    const beforeLine = index * 3 + 1;
    const afterLine = beforeLine + 2;
    beforeIds.push(`symbol:synthetic.ts:class:N${index}:${beforeLine}`);
    afterIds.push(`symbol:synthetic.ts:class:N${index}:${afterLine}`);
  }
  const before: AstSymbolLike[] = [];
  const after: AstSymbolLike[] = [];
  for (let index = 0; index < options.symbolCount; index += 1) {
    const depth = index % options.maxDepth;
    const hasParent = depth > 0;
    const fingerprint = `fp-${Math.floor(random() * 1_000_000)}`;
    const changed = index % 17 === 0;
    before.push({
      id: beforeIds[index]!,
      name: `N${index}`,
      kind: "class",
      startLine: index * 3 + 1,
      endLine: index * 3 + 2,
      loc: 2,
      complexity: 1,
      fingerprint,
      ...(hasParent ? { parentClass: beforeIds[index - 1] } : {}),
    });
    after.push({
      id: afterIds[index]!,
      name: `N${index}`,
      kind: "class",
      startLine: index * 3 + 3,
      endLine: index * 3 + 4,
      loc: 2,
      complexity: 1,
      fingerprint: changed ? `${fingerprint}-changed` : fingerprint,
      ...(hasParent ? { parentClass: afterIds[index - 1] } : {}),
    });
  }
  return { before, after };
}

export function summarizeAstDiffScalingMeasurements(
  measurements: readonly AstDiffScalingMeasurement[],
): AstDiffScalingSummary {
  if (measurements.length === 0) throw new Error("scaling measurements must not be empty");
  const grouped = new Map<string, AstDiffScalingMeasurement[]>();
  for (const measurement of measurements) {
    validateMeasurement(measurement);
    const key = groupKey(measurement);
    const group = grouped.get(key) ?? [];
    group.push(measurement);
    grouped.set(key, group);
  }
  const groups = [...grouped.values()].map(summarizeGroup).sort(compareGroups);
  const projectionByScenario = new Map<string, AstDiffScalingGroup[]>();
  for (const group of groups) {
    if (group.kernel !== "hunk-projection") continue;
    const key = `${group.symbolCount}:${group.hunkCount}`;
    const scenario = projectionByScenario.get(key) ?? [];
    scenario.push(group);
    projectionByScenario.set(key, scenario);
  }
  const projectionComparisons: AstDiffScalingSummary["projectionComparisons"] = [];
  for (const scenario of projectionByScenario.values()) {
    const indexed = scenario.find((group) => group.condition === "indexed");
    const naive = scenario.find((group) => group.condition === "naive");
    if (!indexed || !naive || !indexed.durationMs || !naive.durationMs) continue;
    if (indexed.outputDigest !== naive.outputDigest) {
      throw new Error(
        `projection output digest mismatch for S=${indexed.symbolCount}, H=${indexed.hunkCount}`,
      );
    }
    projectionComparisons.push({
      symbolCount: indexed.symbolCount,
      hunkCount: indexed.hunkCount,
      repetitions: Math.min(indexed.successfulRepetitions, naive.successfulRepetitions),
      indexedP50Ms: indexed.durationMs.p50,
      naiveP50Ms: naive.durationMs.p50,
      speedup: naive.durationMs.p50 / indexed.durationMs.p50,
      indexedP50MaxRssKb: indexed.maxRssKb!.p50,
      naiveP50MaxRssKb: naive.maxRssKb!.p50,
      memoryRatio: naive.maxRssKb!.p50 / indexed.maxRssKb!.p50,
    });
  }
  projectionComparisons.sort((a, b) => a.symbolCount - b.symbolCount || a.hunkCount - b.hunkCount);
  return { groups, projectionComparisons };
}

function summarizeGroup(measurements: readonly AstDiffScalingMeasurement[]): AstDiffScalingGroup {
  const first = measurements[0]!;
  const successful = measurements.filter(
    (
      item,
    ): item is AstDiffScalingMeasurement & {
      durationMs: number;
      maxRssKb: number;
      outputDigest: string;
      outputItems: number;
    } => item.status === "ok",
  );
  const digests = new Set(successful.map((item) => item.outputDigest));
  const outputItems = new Set(successful.map((item) => item.outputItems));
  if (digests.size > 1 || outputItems.size > 1) {
    throw new Error(`non-deterministic output in scaling group ${groupKey(first)}`);
  }
  return {
    kernel: first.kernel,
    condition: first.condition,
    symbolCount: first.symbolCount,
    hunkCount: first.hunkCount,
    maxDepth: first.maxDepth,
    repetitions: measurements.length,
    successfulRepetitions: successful.length,
    failures: measurements.length - successful.length,
    timeouts: measurements.filter((item) => item.status === "timeout").length,
    durationMs: successful.length ? distribution(successful.map((item) => item.durationMs)) : null,
    maxRssKb: successful.length ? distribution(successful.map((item) => item.maxRssKb)) : null,
    outputDigest: successful[0]?.outputDigest ?? null,
    outputItems: successful[0]?.outputItems ?? null,
  };
}

function validateMeasurement(measurement: AstDiffScalingMeasurement): void {
  if (measurement.schemaVersion !== 1) throw new Error("measurement schemaVersion must be 1");
  assertPositiveInteger(measurement.symbolCount, "measurement symbolCount");
  assertPositiveInteger(measurement.repetition, "measurement repetition");
  if (measurement.hunkCount < 0 || !Number.isInteger(measurement.hunkCount)) {
    throw new Error("measurement hunkCount must be a non-negative integer");
  }
  if (measurement.maxDepth < 0 || !Number.isInteger(measurement.maxDepth)) {
    throw new Error("measurement maxDepth must be a non-negative integer");
  }
  if (measurement.status === "ok") {
    if (
      measurement.durationMs === null ||
      measurement.durationMs <= 0 ||
      measurement.maxRssKb === null ||
      measurement.maxRssKb <= 0 ||
      !measurement.outputDigest ||
      measurement.outputItems === null ||
      measurement.outputItems < 0
    ) {
      throw new Error("successful scaling measurement is incomplete");
    }
  }
}

function distribution(values: readonly number[]): AstDiffScalingDistribution {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    min: sorted[0]!,
    max: sorted.at(-1)!,
  };
}

function quantile(sorted: readonly number[], value: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const position = (sorted.length - 1) * value;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function compareGroups(a: AstDiffScalingGroup, b: AstDiffScalingGroup): number {
  const kernelOrder = { "hunk-projection": 0, "symbol-tree": 1 } as const;
  const conditionOrder = { indexed: 0, naive: 1, "parent-aware": 2 } as const;
  return (
    kernelOrder[a.kernel] - kernelOrder[b.kernel] ||
    a.symbolCount - b.symbolCount ||
    a.hunkCount - b.hunkCount ||
    a.maxDepth - b.maxDepth ||
    conditionOrder[a.condition] - conditionOrder[b.condition]
  );
}

function groupKey(measurement: AstDiffScalingMeasurement): string {
  return [
    measurement.kernel,
    measurement.condition,
    measurement.symbolCount,
    measurement.hunkCount,
    measurement.maxDepth,
  ].join(":");
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe integer`);
}
