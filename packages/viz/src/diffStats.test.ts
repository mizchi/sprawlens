import { describe, expect, it } from "vitest";
import {
  buildSymbolDiffStats,
  diffForegroundStrokeWidth,
  diffOutlineOpacity,
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
    expect(diffForegroundStrokeWidth(stat, 0.8)).toBeGreaterThan(2.4);
    expect(diffOutlineOpacity(stat)).toBeGreaterThan(0.8);
  });

  it("omits foreground outline values for unchanged nodes", () => {
    expect(diffForegroundStrokeWidth(undefined, 0.8)).toBeUndefined();
    expect(diffOutlineOpacity(undefined)).toBeUndefined();
  });
});
