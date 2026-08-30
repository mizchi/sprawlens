import { describe, expect, it } from "vitest";
import { halfPlaneBoundaryParameter } from "./halfPlaneIntersection.ts";

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
