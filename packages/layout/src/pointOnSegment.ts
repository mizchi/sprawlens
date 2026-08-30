import type { Vec2 } from "./vec.ts";
import { orientationDeterminant } from "./orientation.ts";

/** True when `point` lies inside the open segment `(a, b)`, excluding both endpoints. */
export function pointInOpenSegment(
  a: Vec2,
  b: Vec2,
  point: Vec2,
  crossTolerance = 0,
  lengthTolerance = 0,
): boolean {
  if (
    !Number.isFinite(crossTolerance) ||
    crossTolerance < 0 ||
    !Number.isFinite(lengthTolerance) ||
    lengthTolerance < 0
  ) {
    throw new Error("point-on-segment tolerances must be finite and non-negative");
  }
  if (Math.abs(orientationDeterminant(a, b, point)) > crossTolerance) return false;
  const useX = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const start = useX ? a.x : a.y;
  const end = useX ? b.x : b.y;
  const value = useX ? point.x : point.y;
  return (
    Math.min(start, end) + lengthTolerance < value &&
    value < Math.max(start, end) - lengthTolerance
  );
}
