import { describe, expect, it } from "vitest";
import { collinearOpenSegmentsOverlap } from "./collinearOverlap.ts";

describe("collinearOpenSegmentsOverlap", () => {
  const horizontal = (start: number, end: number, y = 0) => [
    { x: start, y },
    { x: end, y },
  ] as const;

  it("accepts partial, contained, identical, and reversed overlap", () => {
    expect(collinearOpenSegmentsOverlap(...horizontal(0, 3), ...horizontal(1, 4))).toBe(true);
    expect(collinearOpenSegmentsOverlap(...horizontal(0, 5), ...horizontal(1, 2))).toBe(true);
    expect(collinearOpenSegmentsOverlap(...horizontal(0, 3), ...horizontal(0, 3))).toBe(true);
    expect(collinearOpenSegmentsOverlap(...horizontal(0, 3), ...horizontal(3, 0))).toBe(true);
  });

  it("rejects endpoint contact, disjoint, parallel, crossing, and degenerate cases", () => {
    expect(collinearOpenSegmentsOverlap(...horizontal(0, 2), ...horizontal(2, 4))).toBe(false);
    expect(collinearOpenSegmentsOverlap(...horizontal(0, 1), ...horizontal(2, 3))).toBe(false);
    expect(collinearOpenSegmentsOverlap(...horizontal(0, 3), ...horizontal(1, 2, 1))).toBe(false);
    expect(
      collinearOpenSegmentsOverlap(
        { x: 0, y: 0 },
        { x: 3, y: 3 },
        { x: 0, y: 3 },
        { x: 3, y: 0 },
      ),
    ).toBe(false);
    expect(collinearOpenSegmentsOverlap(...horizontal(1, 1), ...horizontal(0, 2))).toBe(false);
  });

  it("supports vertical segments", () => {
    expect(
      collinearOpenSegmentsOverlap(
        { x: 2, y: -2 },
        { x: 2, y: 4 },
        { x: 2, y: 1 },
        { x: 2, y: 6 },
      ),
    ).toBe(true);
  });
});
