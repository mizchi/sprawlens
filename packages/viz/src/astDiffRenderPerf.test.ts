import { describe, expect, it } from "vitest";
import { summarizeAstDiffRenderTrials } from "./astDiffRenderPerf.ts";

describe("summarizeAstDiffRenderTrials", () => {
  it("summarizes render tails, pooled frames, long tasks, and DOM density", () => {
    const summary = summarizeAstDiffRenderTrials(
      [10, 20, 30, 40, 50].map((renderMs, index) => ({
        renderMs,
        frameIntervalsMs: [10, 20, 30],
        longTaskDurationsMs: index === 4 ? [60] : [],
        domNodes: 100 + index * 10,
        svgNodes: 50 + index * 5,
        polygons: 20 + index,
        paths: 5,
        texts: 10,
        heapBytes: 1_000 + index * 100,
      })),
      { slowFrameThresholdMs: 20 },
    );

    expect(summary.renderMs).toMatchObject({ p50: 30, p95: 48, p99: 49.6 });
    expect(summary.frames).toMatchObject({ count: 15, p95: 30, slowRate: 1 / 3 });
    expect(summary.longTasks).toMatchObject({ count: 1, totalMs: 60, maxMs: 60 });
    expect(summary.domNodes).toMatchObject({ p50: 120, min: 100, max: 140 });
    expect(summary.heapBytes.p50).toBe(1_200);
  });
});
