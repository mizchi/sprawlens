import type { Vec2 } from "./vec.ts";
import { halfPlaneBoundaryParameter, interpolatePoint } from "./halfPlaneIntersection.ts";

export type HalfPlaneEdgeClass = "inside" | "leaving" | "entering" | "outside";

/** Classify an oriented edge against the closed half-plane distance <= 0. */
export function classifyHalfPlaneEdge(
  currentDistance: number,
  nextDistance: number,
): HalfPlaneEdgeClass {
  const currentInside = currentDistance <= 0;
  const nextInside = nextDistance <= 0;
  if (currentInside) return nextInside ? "inside" : "leaving";
  return nextInside ? "entering" : "outside";
}

const boundaryPoint = (
  current: Vec2,
  next: Vec2,
  currentDistance: number,
  nextDistance: number,
): Vec2 => {
  const parameter = halfPlaneBoundaryParameter(currentDistance, nextDistance);
  return interpolatePoint(current, next, parameter);
};

/**
 * Emit the normalized contribution of one oriented edge.
 * The cyclic caller remains responsible for deduplicating adjacent edge outputs.
 */
export function emitHalfPlaneClipStep(
  current: Vec2,
  next: Vec2,
  currentDistance: number,
  nextDistance: number,
): Vec2[] {
  switch (classifyHalfPlaneEdge(currentDistance, nextDistance)) {
    case "inside":
      return [current];
    case "leaving":
      if (currentDistance === 0) return [current];
      return [current, boundaryPoint(current, next, currentDistance, nextDistance)];
    case "entering":
      if (nextDistance === 0) return [next];
      return [boundaryPoint(current, next, currentDistance, nextDistance)];
    case "outside":
      return [];
  }
}
