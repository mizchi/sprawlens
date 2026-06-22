import { describe, expect, it } from "vitest";
import type { TraceTimeline } from "@sprawlens/schema";
import { projectTimelineCursor, stepClockUs, timelineDurationUs } from "./tracePlayer.ts";

const tl: TraceTimeline = {
  schemaVersion: 1,
  steps: [
    { t: 0, durUs: 100, plane: "server", symbolId: "A", depth: 1, stack: ["A"] },
    { t: 100, durUs: 100, plane: "server", symbolId: "B", depth: 2, stack: ["A", "B"] },
    { t: 200, durUs: 100, plane: "server", symbolId: "C", depth: 2, stack: ["A", "C"] },
    { t: 0, durUs: 50, plane: "browser", symbolId: "X", depth: 1, stack: ["X"] },
  ],
  planes: [
    { plane: "server", startUs: 0, durationUs: 300 },
    { plane: "browser", startUs: 300, durationUs: 50 },
  ],
};

describe("projectTimelineCursor", () => {
  it("burns the cursor step brightest and fades the trail", () => {
    const { traceHeat } = projectTimelineCursor(tl, 2);
    expect(traceHeat.get("C")).toBe(1); // active = full heat
    expect(traceHeat.get("B")!).toBeCloseTo(0.85, 5); // one step back
    expect(traceHeat.get("A")!).toBeCloseTo(0.85 ** 2, 5); // two back
  });

  it("lights the current call chain and the travelled transitions", () => {
    const { traceEdges } = projectTimelineCursor(tl, 2);
    const keys = new Set(traceEdges.map((e) => `${e.source}>${e.target}`));
    expect(keys.has("A>C")).toBe(true); // current stack A→C and transition B→C share A→C? stack gives A→C
    expect(keys.has("B>C")).toBe(true); // transition the cursor took
    expect(keys.has("A>B")).toBe(true); // earlier transition still in the trail window
  });

  it("returns empty for a null or empty timeline", () => {
    expect(projectTimelineCursor(null, 0).traceEdges).toEqual([]);
    expect(projectTimelineCursor({ ...tl, steps: [] }, 0).traceHeat.size).toBe(0);
  });

  it("clamps the cursor into range", () => {
    expect(projectTimelineCursor(tl, 999).traceHeat.get("X")).toBe(1);
    expect(projectTimelineCursor(tl, -5).traceHeat.get("A")).toBe(1);
  });
});

describe("clock helpers", () => {
  it("offsets a step by its plane start for a global wall-clock position", () => {
    expect(stepClockUs(tl, 0)).toBe(0); // server t=0
    expect(stepClockUs(tl, 3)).toBe(300); // browser plane starts at 300, step t=0
  });
  it("sums every plane's span", () => {
    expect(timelineDurationUs(tl)).toBe(350);
  });
});
