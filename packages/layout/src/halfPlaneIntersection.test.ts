import { describe, expect, it } from "vitest";
import { halfPlaneBoundaryParameter, interpolatePoint } from "./halfPlaneIntersection.ts";
import { orientationDeterminant } from "./orientation.ts";

describe("halfPlaneBoundaryParameter", () => {
  it("locates an inside-to-outside boundary crossing", () => {
    expect(halfPlaneBoundaryParameter(-2, 3)).toBeCloseTo(0.4);
  });

  it("locates an outside-to-inside boundary crossing", () => {
    expect(halfPlaneBoundaryParameter(3, -2)).toBeCloseTo(0.6);
  });

  it("includes boundary endpoints", () => {
    expect(halfPlaneBoundaryParameter(0, 3)).toBe(0);
    expect(halfPlaneBoundaryParameter(3, 0)).toBe(1);
  });

  it("makes the interpolated signed distance zero", () => {
    for (const [current, next] of [
      [-7, 2],
      [5, -3],
      [0, 4],
      [4, 0],
    ] as const) {
      const parameter = halfPlaneBoundaryParameter(current, next);
      const interpolated = current + (next - current) * parameter;
      expect(interpolated).toBeCloseTo(0);
      expect(parameter).toBeGreaterThanOrEqual(0);
      expect(parameter).toBeLessThanOrEqual(1);
    }
  });
});

describe("interpolatePoint", () => {
  const start = { x: 1, y: 2 };
  const finish = { x: 5, y: 10 };

  it("has exact endpoints", () => {
    expect(interpolatePoint(start, finish, 0)).toEqual(start);
    expect(interpolatePoint(start, finish, 1)).toEqual(finish);
  });

  it("uses affine coordinates", () => {
    expect(interpolatePoint(start, finish, 0.25)).toEqual({ x: 2, y: 4 });
  });

  it("scales orientation when replacing an endpoint", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const c = { x: 4, y: 3 };
    const parameter = 0.25;
    expect(orientationDeterminant(a, b, interpolatePoint(b, c, parameter))).toBe(
      parameter * orientationDeterminant(a, b, c),
    );
    expect(orientationDeterminant(interpolatePoint(a, b, parameter), b, c)).toBe(
      (1 - parameter) * orientationDeterminant(a, b, c),
    );
  });
});
