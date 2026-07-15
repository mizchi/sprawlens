import type { AstSymbolLike } from "./astSymbolDiff.ts";
import { chooseSymbolDiffProjectionStrategy, type DiffHunk } from "./diffStats.ts";

export type AstDiffProjectionSymbol = {
  id: string;
  metrics: { loc: number };
  sourceRange: { startLine: number; endLine: number };
  parentId?: string;
};

export type AstDiffScalingMeasurement = {
  schemaVersion: 2;
  kernel: "hunk-projection" | "symbol-tree";
  condition: "indexed" | "naive" | "adaptive" | "parent-aware";
  symbolCount: number;
  hunkCount: number;
  maxDepth: number;
  seed: number;
  repetition: number;
  warmupIterations: number;
  batchIterations: number;
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
  batchIterations: number;
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
    batchIterations: number;
    repetitions: number;
    indexedP50Ms: number;
    naiveP50Ms: number;
    speedup: number;
    indexedP50MaxRssKb: number;
    naiveP50MaxRssKb: number;
    memoryRatio: number;
    adaptiveP50Ms: number;
    adaptiveOverBest: number;
    adaptiveStrategy: "indexed" | "naive";
  }>;
};

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
    const key = `${group.symbolCount}:${group.hunkCount}:${group.batchIterations}`;
    const scenario = projectionByScenario.get(key) ?? [];
    scenario.push(group);
    projectionByScenario.set(key, scenario);
  }
  const projectionComparisons: AstDiffScalingSummary["projectionComparisons"] = [];
  for (const scenario of projectionByScenario.values()) {
    const indexed = scenario.find((group) => group.condition === "indexed");
    const naive = scenario.find((group) => group.condition === "naive");
    const adaptive = scenario.find((group) => group.condition === "adaptive");
    if (
      indexed &&
      naive &&
      indexed.durationMs &&
      naive.durationMs &&
      indexed.outputDigest !== naive.outputDigest
    ) {
      throw new Error(
        `projection output digest mismatch for S=${indexed.symbolCount}, H=${indexed.hunkCount}`,
      );
    }
    if (
      !indexed ||
      !naive ||
      !adaptive ||
      !indexed.durationMs ||
      !naive.durationMs ||
      !adaptive.durationMs
    ) {
      continue;
    }
    if (
      indexed.outputDigest !== adaptive.outputDigest ||
      indexed.outputItems !== adaptive.outputItems
    ) {
      throw new Error(
        `adaptive projection output digest mismatch for S=${indexed.symbolCount}, H=${indexed.hunkCount}`,
      );
    }
    projectionComparisons.push({
      symbolCount: indexed.symbolCount,
      hunkCount: indexed.hunkCount,
      batchIterations: indexed.batchIterations,
      repetitions: Math.min(
        indexed.successfulRepetitions,
        naive.successfulRepetitions,
        adaptive.successfulRepetitions,
      ),
      indexedP50Ms: indexed.durationMs.p50,
      naiveP50Ms: naive.durationMs.p50,
      speedup: naive.durationMs.p50 / indexed.durationMs.p50,
      indexedP50MaxRssKb: indexed.maxRssKb!.p50,
      naiveP50MaxRssKb: naive.maxRssKb!.p50,
      memoryRatio: naive.maxRssKb!.p50 / indexed.maxRssKb!.p50,
      adaptiveP50Ms: adaptive.durationMs.p50,
      adaptiveOverBest:
        adaptive.durationMs.p50 / Math.min(indexed.durationMs.p50, naive.durationMs.p50),
      adaptiveStrategy: chooseSymbolDiffProjectionStrategy(indexed.symbolCount, indexed.hunkCount),
    });
  }
  projectionComparisons.sort(
    (a, b) =>
      a.symbolCount - b.symbolCount ||
      a.hunkCount - b.hunkCount ||
      a.batchIterations - b.batchIterations,
  );
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
    batchIterations: first.batchIterations,
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
  if (measurement.schemaVersion !== 2) throw new Error("measurement schemaVersion must be 2");
  assertPositiveInteger(measurement.symbolCount, "measurement symbolCount");
  assertPositiveInteger(measurement.repetition, "measurement repetition");
  assertPositiveInteger(measurement.batchIterations, "measurement batchIterations");
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
  const conditionOrder = { indexed: 0, naive: 1, adaptive: 2, "parent-aware": 3 } as const;
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
    measurement.batchIterations,
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
