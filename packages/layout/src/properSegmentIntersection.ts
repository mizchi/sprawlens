import type { Vec2 } from "./vec.ts";
import { orientationDeterminant } from "./orientation.ts";

const strictlyOpposite = (left: number, right: number, tolerance: number) =>
  (left > tolerance && right < -tolerance) || (left < -tolerance && right > tolerance);

/**
 * True only when both open segment interiors cross.
 * Endpoint contact and collinear overlap deliberately belong to separate predicates.
 */
export function properSegmentsIntersect(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
  tolerance = 0,
): boolean {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error("proper segment intersection tolerance must be finite and non-negative");
  }
  return (
    strictlyOpposite(orientationDeterminant(a, b, c), orientationDeterminant(a, b, d), tolerance) &&
    strictlyOpposite(orientationDeterminant(c, d, a), orientationDeterminant(c, d, b), tolerance)
  );
}
