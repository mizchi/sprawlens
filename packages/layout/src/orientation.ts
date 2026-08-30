import type { Vec2 } from "./vec.ts";

/** Signed twice-area determinant: positive means a strict left turn. */
export function orientationDeterminant(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
