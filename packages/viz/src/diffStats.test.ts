import { describe, expect, it } from "vitest";
import {
  buildSymbolDiffStats,
  diffBaseStrokeActive,
  diffForegroundStrokeWidth,
  diffOutlineOpacity,
  diffForegroundOutlineVisible,
  fallbackChangedDiffStat,
  formatDiffPercent,
  normalizeFileDiffStats,
  parseSymbolStartLine,
} from "./diffStats.ts";

describe("parseSymbolStartLine", () => {
  it("reads the final line segment from symbol ids", () => {
    expect(parseSymbolStartLine("symbol:src/a.ts:function:run:42")).toBe(42);
    expect(parseSymbolStartLine("src/a.ts#rest")).toBeNull();
  });
});

describe("normalizeFileDiffStats", () => {
  it("turns raw numstat counts into clamped file ratios", () => {
    const stats = normalizeFileDiffStats(
      {
        "src/a.ts": { added: 8, deleted: 2 },
        "src/new.ts": { added: 12, deleted: 0 },
      },
      { "src/a.ts": 50, "src/new.ts": 12 },
      new Map([["src/a.ts", 40]]),
      new Map([
        ["src/a.ts", "modified"],
        ["src/new.ts", "added"],
      ]),
    );
    expect(stats.get("src/a.ts")).toEqual({
      added: 8,
      deleted: 2,
      touched: 10,
      total: 50,
      ratio: 0.2,
    });
    expect(stats.get("src/new.ts")?.ratio).toBe(1);
  });
});

describe("buildSymbolDiffStats", () => {
  it("projects hunk ranges onto symbol line spans", () => {
    const stats = buildSymbolDiffStats(
      [
        {
          id: "symbol:src/a.ts:function:alpha:10",
          kind: "symbol",
          label: "alpha",
          metrics: { loc: 10 },
        },
        {
          id: "symbol:src/a.ts:function:beta:25",
          kind: "symbol",
          label: "beta",
          metrics: { loc: 20 },
        },
      ],
      [
        { oldStart: 12, oldLines: 1, newStart: 12, newLines: 3 },
        { oldStart: 30, oldLines: 4, newStart: 30, newLines: 0 },
      ],
    );

    expect(stats.get("symbol:src/a.ts:function:alpha:10")).toMatchObject({
      added: 3,
      deleted: 1,
      touched: 3,
      total: 10,
      ratio: 0.3,
    });
    expect(stats.get("symbol:src/a.ts:function:beta:25")).toMatchObject({
      deleted: 4,
      touched: 4,
      total: 20,
      ratio: 0.2,
    });
  });

  it("uses exact AST ranges and aggregates a member hunk into its parent class", () => {
    const stats = buildSymbolDiffStats(
      [
        {
          id: "symbol:src/a.ts:class:Service:1",
          metrics: { loc: 2 },
          sourceRange: { startLine: 1, endLine: 20 },
        },
        {
          id: "symbol:src/a.ts:method:Service.run:8",
          metrics: { loc: 5 },
          sourceRange: { startLine: 8, endLine: 12 },
          parentId: "symbol:src/a.ts:class:Service:1",
        },
      ],
      [{ oldStart: 9, oldLines: 1, newStart: 9, newLines: 2 }],
    );

    expect(stats.get("symbol:src/a.ts:method:Service.run:8")).toMatchObject({
      touched: 2,
      total: 5,
      ratio: 0.4,
    });
    expect(stats.get("symbol:src/a.ts:class:Service:1")).toMatchObject({
      touched: 2,
      total: 20,
      ratio: 0.1,
    });
  });

  it("recovers parent aggregation from legacy qualified symbol ids", () => {
    const stats = buildSymbolDiffStats(
      [
        { id: "symbol:src/a.ts:class:Service:1", metrics: { loc: 2 } },
        { id: "symbol:src/a.ts:method:Service.run:8", metrics: { loc: 5 } },
      ],
      [{ oldStart: 9, oldLines: 1, newStart: 9, newLines: 2 }],
    );

    expect(stats.get("symbol:src/a.ts:class:Service:1")).toMatchObject({ touched: 2, total: 12 });
  });

  it("rounds exact half-line replacement density without prefix floating-point drift", () => {
    const stats = buildSymbolDiffStats(
      [
        {
          id: "symbol:fixture.ts:function:target:331",
          metrics: { loc: 9 },
          sourceRange: { startLine: 331, endLine: 339 },
        },
      ],
      [{ oldStart: 330, oldLines: 5, newStart: 329, newLines: 4 }],
    );

    expect(stats.get("symbol:fixture.ts:function:target:331")).toMatchObject({
      added: 2,
      deleted: 3,
      touched: 2,
    });
  });
});

describe("fallbackChangedDiffStat", () => {
  it("keeps changed nodes visible without pretending to know an exact percent", () => {
    const stat = fallbackChangedDiffStat("modified", 100);
    expect(stat.estimated).toBe(true);
    expect(stat.ratio).toBeGreaterThan(0);
    expect(formatDiffPercent(stat)).toBe("");
  });
});

describe("diff outline visuals", () => {
  it("draws changed-node outlines above structural boundaries", () => {
    const stat = { added: 5, deleted: 0, touched: 5, total: 20, ratio: 0.25 };
    expect(diffForegroundStrokeWidth(stat, 0.8)).toBeGreaterThan(1.6);
    expect(diffForegroundStrokeWidth(stat, 0.8)).toBeLessThan(2.2);
    expect(diffOutlineOpacity(stat)).toBeGreaterThan(0.5);
    expect(diffOutlineOpacity(stat)).toBeLessThan(0.65);
  });

  it("subdues changed-node outlines while a focus/extract overlay is active", () => {
    const stat = { added: 5, deleted: 0, touched: 5, total: 20, ratio: 0.25 };
    expect(diffForegroundStrokeWidth(stat, 0.8, true)).toBeLessThan(
      diffForegroundStrokeWidth(stat, 0.8)!,
    );
    expect(diffOutlineOpacity(stat, true)).toBeLessThan(diffOutlineOpacity(stat)!);
  });

  it("omits foreground outline values for unchanged nodes", () => {
    expect(diffForegroundStrokeWidth(undefined, 0.8)).toBeUndefined();
    expect(diffOutlineOpacity(undefined)).toBeUndefined();
  });

  it("does not turn changed-preview base cells into an orange mesh", () => {
    const stat = { added: 5, deleted: 0, touched: 5, total: 20, ratio: 0.25 };
    expect(diffBaseStrokeActive(stat, false)).toBe(true);
    expect(diffBaseStrokeActive(stat, true)).toBe(false);
  });

  it("keeps exact foreground outlines visible during changed preview", () => {
    const stat = { added: 5, deleted: 0, touched: 5, total: 20, ratio: 0.25 };
    expect(
      diffForegroundOutlineVisible(stat, {
        changedPreviewActive: true,
        selected: false,
        screenPx: 4,
      }),
    ).toBe(true);
    expect(
      diffForegroundOutlineVisible(stat, {
        changedPreviewActive: true,
        selected: false,
        screenPx: 32,
      }),
    ).toBe(true);
    expect(
      diffForegroundOutlineVisible(stat, {
        changedPreviewActive: false,
        selected: false,
        screenPx: 4,
      }),
    ).toBe(true);
  });
});
