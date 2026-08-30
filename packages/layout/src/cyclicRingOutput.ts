import type { Vec2 } from "./vec.ts";

export const samePoint = (left: Vec2, right: Vec2): boolean =>
  left.x === right.x && left.y === right.y;

/** Append a point unless it repeats the immediately preceding output point. */
export function appendDistinctPoint(output: Vec2[], point: Vec2): void {
  const previous = output[output.length - 1];
  if (previous === undefined || !samePoint(previous, point)) output.push(point);
}

export function appendDistinctPoints(output: Vec2[], points: readonly Vec2[]): void {
  for (const point of points) appendDistinctPoint(output, point);
}

/** Remove the explicit closing point from an open-ring representation. */
export function removeCyclicDuplicate(output: Vec2[]): void {
  if (output.length > 1 && samePoint(output[0]!, output[output.length - 1]!)) output.pop();
}
