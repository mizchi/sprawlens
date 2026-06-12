import { describe, expect, it } from "vitest";
import {
  centroid,
  circleToPolygon,
  clipHalfPlane,
  convexHull,
  nearestPointInRing,
  signedArea,
} from "./polygon.js";

const unitSquare = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe("signedArea", () => {
  it("is positive for CCW rings", () => {
    expect(signedArea(unitSquare)).toBeCloseTo(1, 10);
  });

  it("is negative for CW rings", () => {
    const cw = [...unitSquare].reverse();
    expect(signedArea(cw)).toBeCloseTo(-1, 10);
  });

  it("is zero for degenerate rings", () => {
    expect(signedArea([])).toBe(0);
    expect(signedArea([{ x: 1, y: 1 }])).toBe(0);
    expect(signedArea([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBe(0);
  });
});

describe("centroid", () => {
  it("returns the center of a square", () => {
    const c = centroid(unitSquare);
    expect(c.x).toBeCloseTo(0.5, 10);
    expect(c.y).toBeCloseTo(0.5, 10);
  });

  it("returns the analytic centroid of a triangle", () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 3 },
    ];
    const c = centroid(tri);
    expect(c.x).toBeCloseTo(1, 10);
    expect(c.y).toBeCloseTo(1, 10);
  });
});

describe("clipHalfPlane", () => {
  // half-plane: keep points where nx*x + ny*y <= c
  it("keeps the whole ring when nothing is clipped", () => {
    const out = clipHalfPlane(unitSquare, 1, 0, 2);
    expect(signedArea(out)).toBeCloseTo(1, 10);
  });

  it("returns an empty ring when everything is clipped", () => {
    const out = clipHalfPlane(unitSquare, 1, 0, -1);
    expect(out).toEqual([]);
  });

  it("cuts a square in half", () => {
    const out = clipHalfPlane(unitSquare, 1, 0, 0.5);
    expect(signedArea(out)).toBeCloseTo(0.5, 10);
    for (const p of out) {
      expect(p.x).toBeLessThanOrEqual(0.5 + 1e-12);
    }
  });

  it("preserves CCW orientation", () => {
    const out = clipHalfPlane(unitSquare, 1, 1, 1.2);
    expect(signedArea(out)).toBeGreaterThan(0);
  });
});

describe("circleToPolygon", () => {
  it("approximates the circle area within 1% at 64 segments", () => {
    const ring = circleToPolygon({ cx: 2, cy: 3, r: 5 }, 64);
    expect(ring).toHaveLength(64);
    const area = signedArea(ring);
    const exact = Math.PI * 25;
    expect(Math.abs(area - exact) / exact).toBeLessThan(0.01);
  });

  it("is CCW and centered", () => {
    const ring = circleToPolygon({ cx: 1, cy: 1, r: 2 }, 32);
    expect(signedArea(ring)).toBeGreaterThan(0);
    const c = centroid(ring);
    expect(c.x).toBeCloseTo(1, 6);
    expect(c.y).toBeCloseTo(1, 6);
  });
});

describe("convexHull", () => {
  it("recovers the corners of a square despite interior points", () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 1, y: 1 },
      { x: 0.5, y: 1.5 },
    ]);
    expect(hull).toHaveLength(4);
    expect(Math.abs(signedArea(hull))).toBeCloseTo(4, 9);
  });

  it("collapses collinear points to the segment extremes", () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(hull.length).toBeLessThan(3);
  });

  it("passes tiny inputs through", () => {
    expect(convexHull([{ x: 3, y: 4 }])).toEqual([{ x: 3, y: 4 }]);
  });
});

describe("nearestPointInRing", () => {
  it("returns interior points unchanged", () => {
    const p = { x: 0.3, y: 0.7 };
    expect(nearestPointInRing(unitSquare, p)).toEqual(p);
  });

  it("projects onto the closest edge", () => {
    expect(nearestPointInRing(unitSquare, { x: 2, y: 0.5 })).toEqual({
      x: 1,
      y: 0.5,
    });
    expect(nearestPointInRing(unitSquare, { x: 0.25, y: -3 })).toEqual({
      x: 0.25,
      y: 0,
    });
  });

  it("projects onto the closest corner when beyond both edges", () => {
    const projected = nearestPointInRing(unitSquare, { x: 4, y: 5 });
    expect(projected.x).toBeCloseTo(1, 12);
    expect(projected.y).toBeCloseTo(1, 12);
  });

  it("handles degenerate rings by averaging", () => {
    expect(nearestPointInRing([{ x: 2, y: 3 }], { x: 9, y: 9 })).toEqual({
      x: 2,
      y: 3,
    });
  });
});
