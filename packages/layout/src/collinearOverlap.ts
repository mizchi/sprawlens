import type { Vec2 } from "./vec.ts";
import { orientationDeterminant } from "./orientation.ts";

/** True when two collinear segment interiors overlap by positive length. */
export function collinearOpenSegmentsOverlap(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
  crossTolerance = 0,
  lengthTolerance = 0,
): boolean {
  if (
    !Number.isFinite(crossTolerance) ||
    crossTolerance < 0 ||
    !Number.isFinite(lengthTolerance) ||
    lengthTolerance < 0
  ) {
    throw new Error("collinear-overlap tolerances must be finite and non-negative");
  }
  if (
    Math.abs(orientationDeterminant(a, b, c)) > crossTolerance ||
    Math.abs(orientationDeterminant(a, b, d)) > crossTolerance ||
    Math.abs(orientationDeterminant(c, d, a)) > crossTolerance ||
    Math.abs(orientationDeterminant(c, d, b)) > crossTolerance
  ) {
    return false;
  }
  const useX = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const firstStart = useX ? a.x : a.y;
  const firstEnd = useX ? b.x : b.y;
  const secondStart = useX ? c.x : c.y;
  const secondEnd = useX ? d.x : d.y;
  const overlap =
    Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd)) -
    Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd));
  return overlap > lengthTolerance;
}
