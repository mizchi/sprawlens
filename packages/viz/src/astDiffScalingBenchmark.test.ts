import { describe, expect, it } from "vitest";
import { buildSymbolDiffStats } from "./diffStats.ts";
import {
  buildSymbolDiffStatsNaive,
  createAstDiffProjectionFixture,
  createAstDiffTreeFixture,
  summarizeAstDiffScalingMeasurements,
  type AstDiffScalingMeasurement,
} from "./astDiffScalingBenchmark.ts";

describe("AST diff scaling fixtures", () => {
  it("keeps the naive all-hunk scan equivalent to the indexed production projection", () => {
    const symbols = [
      symbol("alpha", 1, 10),
      symbol("beta", 11, 20),
      symbol("gamma", 30, 35),
      symbol("unchanged", 50, 55),
    ];
    const hunks = [
      { oldStart: 3, oldLines: 2, newStart: 3, newLines: 4 },
      { oldStart: 8, oldLines: 1, newStart: 8, newLines: 2 },
      { oldStart: 15, oldLines: 5, newStart: 15, newLines: 0 },
      { oldStart: 31, oldLines: 0, newStart: 31, newLines: 3 },
    ];

    expect([...buildSymbolDiffStatsNaive(symbols, hunks)]).toEqual([
      ...buildSymbolDiffStats(symbols, hunks),
    ]);
  });

  it("keeps equivalence when many disjoint events accumulate in the prefix index", () => {
    const fixture = createAstDiffProjectionFixture({
      symbolCount: 500,
      hunkCount: 100,
      seed: 1729,
    });

    expect([...buildSymbolDiffStats(fixture.symbols, fixture.hunks)]).toEqual([
      ...buildSymbolDiffStatsNaive(fixture.symbols, fixture.hunks),
    ]);
  });

  it("generates deterministic fixtures with independently controlled scale dimensions", () => {
    const projection = createAstDiffProjectionFixture({
      symbolCount: 50,
      hunkCount: 20,
      seed: 1729,
    });
    expect(projection.symbols).toHaveLength(50);
    expect(projection.hunks).toHaveLength(20);
    expect(createAstDiffProjectionFixture({ symbolCount: 50, hunkCount: 20, seed: 1729 })).toEqual(
      projection,
    );

    const tree = createAstDiffTreeFixture({ symbolCount: 100, maxDepth: 4, seed: 2027 });
    expect(tree.before).toHaveLength(100);
    expect(tree.after).toHaveLength(100);
    expect(maxObservedDepth(tree.after)).toBe(4);
    expect(createAstDiffTreeFixture({ symbolCount: 100, maxDepth: 4, seed: 2027 })).toEqual(tree);
  });
});

describe("summarizeAstDiffScalingMeasurements", () => {
  it("reports distributions, failures, and paired indexed speedup", () => {
    const measurements: AstDiffScalingMeasurement[] = [
      measurement("hunk-projection", "indexed", 1, 10, 100),
      measurement("hunk-projection", "indexed", 2, 12, 110),
      measurement("hunk-projection", "indexed", 3, 14, 120),
      measurement("hunk-projection", "naive", 1, 100, 130),
      measurement("hunk-projection", "naive", 2, 110, 140),
      measurement("hunk-projection", "naive", 3, 120, 150),
      measurement("symbol-tree", "parent-aware", 1, 20, 200, {
        hunkCount: 0,
        maxDepth: 8,
      }),
      measurement("symbol-tree", "parent-aware", 2, 24, 210, {
        hunkCount: 0,
        maxDepth: 8,
      }),
      {
        ...measurement("symbol-tree", "parent-aware", 3, 0, 0, {
          hunkCount: 0,
          maxDepth: 8,
        }),
        status: "timeout",
        durationMs: null,
        maxRssKb: null,
        outputDigest: null,
        outputItems: null,
        error: "timed out after 30000 ms",
      },
    ];

    const summary = summarizeAstDiffScalingMeasurements(measurements);
    expect(summary.groups).toEqual([
      expect.objectContaining({
        kernel: "hunk-projection",
        condition: "indexed",
        successfulRepetitions: 3,
        failures: 0,
        durationMs: expect.objectContaining({
          p50: 12,
          p95: expect.closeTo(13.8, 10),
          p99: expect.closeTo(13.96, 10),
        }),
        maxRssKb: expect.objectContaining({ p50: 110 }),
      }),
      expect.objectContaining({
        kernel: "hunk-projection",
        condition: "naive",
        durationMs: expect.objectContaining({ p50: 110 }),
      }),
      expect.objectContaining({
        kernel: "symbol-tree",
        condition: "parent-aware",
        successfulRepetitions: 2,
        failures: 1,
      }),
    ]);
    expect(summary.projectionComparisons).toEqual([
      expect.objectContaining({
        symbolCount: 1_000,
        hunkCount: 100,
        indexedP50Ms: 12,
        naiveP50Ms: 110,
        speedup: 110 / 12,
      }),
    ]);
  });

  it("rejects projection conditions that did not produce identical outputs", () => {
    expect(() =>
      summarizeAstDiffScalingMeasurements([
        measurement("hunk-projection", "indexed", 1, 10, 100),
        { ...measurement("hunk-projection", "naive", 1, 20, 100), outputDigest: "different" },
      ]),
    ).toThrow(/digest/i);
  });
});

function symbol(name: string, startLine: number, endLine: number) {
  return {
    id: `symbol:fixture.ts:function:${name}:${startLine}`,
    metrics: { loc: endLine - startLine + 1 },
    sourceRange: { startLine, endLine },
  };
}

function measurement(
  kernel: "hunk-projection" | "symbol-tree",
  condition: "indexed" | "naive" | "parent-aware",
  repetition: number,
  durationMs: number,
  maxRssKb: number,
  dimensions: { hunkCount: number; maxDepth: number } = { hunkCount: 100, maxDepth: 0 },
): AstDiffScalingMeasurement {
  return {
    schemaVersion: 1,
    kernel,
    condition,
    symbolCount: 1_000,
    hunkCount: dimensions.hunkCount,
    maxDepth: dimensions.maxDepth,
    seed: 1729,
    repetition,
    warmupIterations: 2,
    status: "ok",
    durationMs,
    maxRssKb,
    outputDigest: "same",
    outputItems: 500,
    error: null,
  };
}

function maxObservedDepth(symbols: Array<{ id: string; parentClass?: string }>): number {
  const parentById = new Map(symbols.map((item) => [item.id, item.parentClass]));
  let maximum = 0;
  for (const item of symbols) {
    let depth = 1;
    let parent = item.parentClass;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      depth += 1;
      parent = parentById.get(parent);
    }
    maximum = Math.max(maximum, depth);
  }
  return maximum;
}
