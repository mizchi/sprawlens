import { describe, expect, it } from "vitest";
import { pointInOpenSegment } from "./pointOnSegment.ts";

describe("pointInOpenSegment", () => {
  it("accepts interior points on horizontal, vertical, and diagonal segments", () => {
    expect(pointInOpenSegment({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 })).toBe(true);
    expect(pointInOpenSegment({ x: 2, y: -2 }, { x: 2, y: 4 }, { x: 2, y: 1 })).toBe(true);
    expect(pointInOpenSegment({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 1, y: 1 })).toBe(true);
  });

  it("rejects endpoints, outside points, off-line points, and degenerate segments", () => {
    expect(pointInOpenSegment({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 0 })).toBe(false);
    expect(pointInOpenSegment({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 })).toBe(false);
    expect(pointInOpenSegment({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 1, y: 2 })).toBe(false);
    expect(pointInOpenSegment({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it("is invariant under endpoint reversal, translation, and non-zero uniform scale", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 4 };
    const point = { x: 1, y: 1 };
    expect(pointInOpenSegment(b, a, point)).toBe(true);
    expect(
      pointInOpenSegment(
        { x: 10, y: -3 },
        { x: 14, y: 1 },
        { x: 11, y: -2 },
      ),
    ).toBe(true);
    expect(
      pointInOpenSegment(
        { x: 0, y: 0 },
        { x: -8, y: -8 },
        { x: -2, y: -2 },
      ),
    ).toBe(true);
  });

  it("keeps area and length tolerances separate", () => {
    expect(
      pointInOpenSegment(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 1e-8 },
        1e-6,
        1e-12,
      ),
    ).toBe(true);
    expect(
      pointInOpenSegment(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 1e-8 },
        1e-10,
        1e-12,
      ),
    ).toBe(false);
  });

  it("rejects invalid tolerances", () => {
    expect(() =>
      pointInOpenSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0 }, -1),
    ).toThrow(/tolerance/);
  });
});
