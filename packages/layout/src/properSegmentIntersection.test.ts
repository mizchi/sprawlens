import { describe, expect, it } from "vitest";
import { properSegmentsIntersect } from "./properSegmentIntersection.ts";

describe("properSegmentsIntersect", () => {
  it("accepts an interior crossing", () => {
    expect(
      properSegmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 }),
    ).toBe(true);
  });

  it("rejects disjoint, endpoint-touching, and collinear segments", () => {
    expect(
      properSegmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 1 }),
    ).toBe(false);
    expect(
      properSegmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }),
    ).toBe(false);
    expect(
      properSegmentsIntersect({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 0 }, { x: 4, y: 0 }),
    ).toBe(false);
  });

  it("is invariant under segment exchange and endpoint reversal", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 4 };
    const c = { x: 0, y: 4 };
    const d = { x: 4, y: 0 };
    expect(properSegmentsIntersect(a, b, c, d)).toBe(true);
    expect(properSegmentsIntersect(c, d, a, b)).toBe(true);
    expect(properSegmentsIntersect(b, a, c, d)).toBe(true);
    expect(properSegmentsIntersect(a, b, d, c)).toBe(true);
  });

  it("uses a non-negative finite tolerance", () => {
    expect(() =>
      properSegmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, -1),
    ).toThrow(/tolerance/);
  });
});
