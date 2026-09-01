import type { Ring } from "./polygon.ts";
import type { Vec2 } from "./vec.ts";

const pointSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
};

const sampleBoundary = (ring: Ring, count = 32): Vec2[] => {
  if (ring.length === 0) return [];
  const segments = ring.map((start, index) => {
    const end = ring[(index + 1) % ring.length]!;
    return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y) };
  });
  const perimeter = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (perimeter === 0) return Array.from({ length: count }, () => ({ ...ring[0]! }));
  return Array.from({ length: count }, (_, sampleIndex) => {
    let distance = (sampleIndex * perimeter) / count;
    for (const segment of segments) {
      if (distance <= segment.length || segment === segments.at(-1)) {
        const ratio = segment.length === 0 ? 0 : distance / segment.length;
        return {
          x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
          y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
        };
      }
      distance -= segment.length;
    }
    return { ...ring[0]! };
  });
};

const directedBoundaryMean = (samples: readonly Vec2[], target: Ring) => {
  if (samples.length === 0 || target.length === 0) return 0;
  return (
    samples.reduce((sum, point) => {
      let nearest = Infinity;
      for (let index = 0; index < target.length; index++) {
        nearest = Math.min(
          nearest,
          pointSegmentDistance(point, target[index]!, target[(index + 1) % target.length]!),
        );
      }
      return sum + nearest;
    }, 0) / samples.length
  );
};

/**
 * Legacy evaluation discrepancy. It is not a metric: empty boundaries map to
 * zero and sampled means need not satisfy the triangle inequality.
 */
export const sampledMeanBoundaryDisplacement = (before: Ring, after: Ring) =>
  (directedBoundaryMean(sampleBoundary(before), after) +
    directedBoundaryMean(sampleBoundary(after), before)) /
  2;

const boundaryPerimeter = (ring: Ring) =>
  ring.reduce((perimeter, start, index) => {
    const end = ring[(index + 1) % ring.length]!;
    return perimeter + Math.hypot(end.x - start.x, end.y - start.y);
  }, 0);

const directedBoundaryMaximum = (samples: readonly Vec2[], target: Ring) =>
  samples.reduce((maximum, point) => {
    let nearest = Infinity;
    for (let index = 0; index < target.length; index++) {
      nearest = Math.min(
        nearest,
        pointSegmentDistance(point, target[index]!, target[(index + 1) % target.length]!),
      );
    }
    return Math.max(maximum, nearest);
  }, 0);

export type BoundaryHausdorffApproximation =
  | {
      status: "ok";
      estimate: number;
      additiveErrorBound: number;
      sampleCount: number;
    }
  | {
      status: "empty-boundary";
      sampleCount: number;
    };

/**
 * Lower approximation of continuous polygon-boundary Hausdorff distance.
 *
 * For exact real arithmetic, uniform arc-length samples form a
 * `max(perimeter(before), perimeter(after)) / sampleCount` net. Therefore the
 * true distance lies in `[estimate, estimate + additiveErrorBound]`. This
 * function reports that discretization bound; IEEE-754 roundoff is a separate
 * implementation error and is not included in it.
 */
export function approximateBoundaryHausdorff(
  before: Ring,
  after: Ring,
  sampleCount = 32,
): BoundaryHausdorffApproximation {
  if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) {
    throw new RangeError("sampleCount must be a positive safe integer");
  }
  if (before.length === 0 || after.length === 0) {
    return { status: "empty-boundary", sampleCount };
  }
  const estimate = Math.max(
    directedBoundaryMaximum(sampleBoundary(before, sampleCount), after),
    directedBoundaryMaximum(sampleBoundary(after, sampleCount), before),
  );
  return {
    status: "ok",
    estimate,
    additiveErrorBound: Math.max(boundaryPerimeter(before), boundaryPerimeter(after)) / sampleCount,
    sampleCount,
  };
}

const sampleBoundaryByEdge = (ring: Ring, subdivisionsPerEdge: number): Vec2[] =>
  ring.flatMap((start, index) => {
    const end = ring[(index + 1) % ring.length]!;
    return Array.from({ length: subdivisionsPerEdge + 1 }, (_, subdivision) => {
      const ratio = subdivision / subdivisionsPerEdge;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    });
  });

const boundaryMaxEdgeLength = (ring: Ring) =>
  ring.reduce((maximum, start, index) => {
    const end = ring[(index + 1) % ring.length]!;
    return Math.max(maximum, Math.hypot(end.x - start.x, end.y - start.y));
  }, 0);

export type EdgeLocalBoundaryHausdorffApproximation =
  | {
      status: "ok";
      estimate: number;
      additiveErrorBound: number;
      subdivisionsPerEdge: number;
      actualSampleCount: number;
    }
  | {
      status: "empty-boundary";
      subdivisionsPerEdge: number;
    };

/**
 * Hausdorff lower approximation using a uniform grid on every polygon edge.
 *
 * In exact real arithmetic, each closed edge is covered within
 * `edgeLength / subdivisionsPerEdge`. Taking the union gives a polygon
 * epsilon-net with radius `maxEdgeLength / subdivisionsPerEdge`. Unlike the
 * fixed-total sampler, this construction directly refines the Lean
 * `PolygonBoundarySampling` contract. IEEE-754 roundoff remains separate.
 */
export function approximateBoundaryHausdorffByEdge(
  before: Ring,
  after: Ring,
  subdivisionsPerEdge = 8,
): EdgeLocalBoundaryHausdorffApproximation {
  if (!Number.isSafeInteger(subdivisionsPerEdge) || subdivisionsPerEdge <= 0) {
    throw new RangeError("subdivisionsPerEdge must be a positive safe integer");
  }
  if (before.length === 0 || after.length === 0) {
    return { status: "empty-boundary", subdivisionsPerEdge };
  }
  const beforeSamples = sampleBoundaryByEdge(before, subdivisionsPerEdge);
  const afterSamples = sampleBoundaryByEdge(after, subdivisionsPerEdge);
  return {
    status: "ok",
    estimate: Math.max(
      directedBoundaryMaximum(beforeSamples, after),
      directedBoundaryMaximum(afterSamples, before),
    ),
    additiveErrorBound:
      Math.max(boundaryMaxEdgeLength(before), boundaryMaxEdgeLength(after)) / subdivisionsPerEdge,
    subdivisionsPerEdge,
    actualSampleCount: beforeSamples.length + afterSamples.length,
  };
}
