import type { Vec2 } from "./vec.ts";
import { collinearOpenSegmentsOverlap } from "./collinearOverlap.ts";
import { pointInOpenSegment } from "./pointOnSegment.ts";
import { properSegmentsIntersect } from "./properSegmentIntersection.ts";

export type SimpleRingTopology = {
  duplicateVertex: boolean;
  zeroLengthEdge: boolean;
  selfIntersecting: boolean;
};

const pointsEqual = (a: Vec2, b: Vec2, tolerance: number) =>
  Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;

export function segmentsConflict(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
  crossTolerance = 0,
  lengthTolerance = 0,
): boolean {
  return (
    properSegmentsIntersect(a, b, c, d, crossTolerance) ||
    pointInOpenSegment(a, b, c, crossTolerance, lengthTolerance) ||
    pointInOpenSegment(a, b, d, crossTolerance, lengthTolerance) ||
    pointInOpenSegment(c, d, a, crossTolerance, lengthTolerance) ||
    pointInOpenSegment(c, d, b, crossTolerance, lengthTolerance) ||
    collinearOpenSegmentsOverlap(a, b, c, d, crossTolerance, lengthTolerance)
  );
}

export function assessSimpleRingTopology(
  ring: readonly Vec2[],
  crossTolerance = 0,
  lengthTolerance = 0,
): SimpleRingTopology {
  let duplicateVertex = false;
  for (let left = 0; left < ring.length; left++) {
    for (let right = left + 1; right < ring.length; right++) {
      if (pointsEqual(ring[left]!, ring[right]!, lengthTolerance)) duplicateVertex = true;
    }
  }
  const zeroLengthEdge = ring.some((point, index) =>
    pointsEqual(point, ring[(index + 1) % ring.length]!, lengthTolerance),
  );
  let selfIntersecting = false;
  for (let left = 0; left < ring.length; left++) {
    const leftNext = (left + 1) % ring.length;
    for (let right = left + 1; right < ring.length; right++) {
      const rightNext = (right + 1) % ring.length;
      const adjacent = left === right || leftNext === right || rightNext === left;
      if (adjacent) continue;
      if (
        segmentsConflict(
          ring[left]!,
          ring[leftNext]!,
          ring[right]!,
          ring[rightNext]!,
          crossTolerance,
          lengthTolerance,
        )
      ) {
        selfIntersecting = true;
      }
    }
  }
  return { duplicateVertex, zeroLengthEdge, selfIntersecting };
}

/** Topological simplicity only; convexity and winding direction are separate contracts. */
export function isSimpleOpenRing(ring: readonly Vec2[]): boolean {
  if (
    ring.length < 3 ||
    !ring.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
  ) {
    return false;
  }
  const topology = assessSimpleRingTopology(ring);
  return !topology.duplicateVertex && !topology.zeroLengthEdge && !topology.selfIntersecting;
}
