/**
 * Parameter of the zero crossing between two affine signed distances.
 *
 * Callers must provide distinct distances. When one distance is non-positive
 * and the other is non-negative, the result lies in [0, 1].
 */
export function halfPlaneBoundaryParameter(currentDistance: number, nextDistance: number): number {
  if (currentDistance === 0) return 0;
  return currentDistance / (currentDistance - nextDistance);
}

/** Affine interpolation along an oriented segment. */
export function interpolatePoint(start: Vec2, finish: Vec2, parameter: number): Vec2 {
  return {
    x: start.x + (finish.x - start.x) * parameter,
    y: start.y + (finish.y - start.y) * parameter,
  };
}
import type { Vec2 } from "./vec.ts";
