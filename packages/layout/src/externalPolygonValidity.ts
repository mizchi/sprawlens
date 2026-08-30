import type { Vec2 } from "./vec.ts";
import { convexIntersection, signedArea, type Ring } from "./polygon.ts";
import { orientationDeterminant } from "./orientation.ts";
import { assessSimpleRingTopology } from "./simpleRing.ts";

export type RingValidity = {
  finite: boolean;
  hasMinimumVertices: boolean;
  counterClockwise: boolean;
  degenerate: boolean;
  nonConvex: boolean;
  duplicateVertex: boolean;
  zeroLengthEdge: boolean;
  selfIntersecting: boolean;
};

const scaleOf = (ring: readonly Vec2[]) => {
  if (ring.length === 0) return 1;
  const xs = ring.map(({ x }) => x);
  const ys = ring.map(({ y }) => y);
  return Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};

/** Structural checks used before convex clipping or host-side validity metrics. */
export function assessRingValidity(ring: readonly Vec2[]): RingValidity {
  const finite = ring.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
  const hasMinimumVertices = ring.length >= 3;
  if (!finite || !hasMinimumVertices) {
    return {
      finite,
      hasMinimumVertices,
      counterClockwise: false,
      degenerate: true,
      nonConvex: true,
      duplicateVertex: false,
      zeroLengthEdge: false,
      selfIntersecting: false,
    };
  }
  const scale = scaleOf(ring);
  const lengthEpsilon = scale * 1e-12;
  const crossEpsilon = scale * scale * 1e-12;
  const { duplicateVertex, zeroLengthEdge, selfIntersecting } = assessSimpleRingTopology(
    ring,
    crossEpsilon,
    lengthEpsilon,
  );
  let orientation = 0;
  let nonConvex = false;
  for (let index = 0; index < ring.length; index++) {
    const turn = orientationDeterminant(
      ring[index]!,
      ring[(index + 1) % ring.length]!,
      ring[(index + 2) % ring.length]!,
    );
    if (Math.abs(turn) <= crossEpsilon) continue;
    const sign = Math.sign(turn);
    if (orientation !== 0 && orientation !== sign) nonConvex = true;
    orientation = sign;
  }
  if (orientation === 0) nonConvex = true;
  const area = signedArea([...ring]);
  const degenerate = Math.abs(area) <= crossEpsilon;
  return {
    finite,
    hasMinimumVertices,
    counterClockwise: area > crossEpsilon,
    degenerate,
    nonConvex,
    duplicateVertex,
    zeroLengthEdge,
    selfIntersecting,
  };
}

export function isAxisAlignedRectangle(ring: readonly Vec2[]): boolean {
  const validity = assessRingValidity(ring);
  if (
    ring.length !== 4 ||
    validity.degenerate ||
    validity.nonConvex ||
    validity.selfIntersecting ||
    validity.duplicateVertex ||
    validity.zeroLengthEdge
  ) {
    return false;
  }
  const epsilon = scaleOf(ring) * 1e-12;
  return ring.every((point, index) => {
    const next = ring[(index + 1) % ring.length]!;
    const horizontal = Math.abs(point.y - next.y) <= epsilon;
    const vertical = Math.abs(point.x - next.x) <= epsilon;
    return horizontal !== vertical;
  });
}

export function containsPointInConvexRing(ring: readonly Vec2[], point: Vec2): boolean {
  const epsilon = scaleOf(ring) ** 2 * 1e-12;
  let orientation = 0;
  for (let index = 0; index < ring.length; index++) {
    const side = orientationDeterminant(ring[index]!, ring[(index + 1) % ring.length]!, point);
    if (Math.abs(side) <= epsilon) continue;
    const sign = Math.sign(side);
    if (orientation !== 0 && orientation !== sign) return false;
    orientation = sign;
  }
  return ring.length >= 3;
}

type Segment = { a: Vec2; b: Vec2 };

const properIntersectionX = (left: Segment, right: Segment, epsilon: number): number | null => {
  const rx = left.b.x - left.a.x;
  const ry = left.b.y - left.a.y;
  const sx = right.b.x - right.a.x;
  const sy = right.b.y - right.a.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) <= epsilon) return null;
  const qx = right.a.x - left.a.x;
  const qy = right.a.y - left.a.y;
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * ry - qy * rx) / denominator;
  if (t <= epsilon || t >= 1 - epsilon || u <= epsilon || u >= 1 - epsilon) return null;
  return left.a.x + t * rx;
};

const verticalInterval = (ring: readonly Vec2[], x: number): [number, number] | null => {
  const ys: number[] = [];
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index]!;
    const b = ring[(index + 1) % ring.length]!;
    if ((a.x < x && b.x > x) || (b.x < x && a.x > x)) {
      const t = (x - a.x) / (b.x - a.x);
      ys.push(a.y + t * (b.y - a.y));
    }
  }
  if (ys.length < 2) return null;
  return [Math.min(...ys), Math.max(...ys)];
};

const unionIntervalLength = (rings: readonly Ring[], x: number) => {
  const intervals = rings.flatMap((ring) => {
    const interval = verticalInterval(ring, x);
    return interval ? [interval] : [];
  });
  intervals.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  let length = 0;
  let start = Number.NaN;
  let end = Number.NaN;
  for (const [nextStart, nextEnd] of intervals) {
    if (Number.isNaN(start)) {
      start = nextStart;
      end = nextEnd;
    } else if (nextStart <= end) {
      end = Math.max(end, nextEnd);
    } else {
      length += end - start;
      start = nextStart;
      end = nextEnd;
    }
  }
  return Number.isNaN(start) ? 0 : length + end - start;
};

/** Exact-by-slabs union area for convex rings, clipped to a convex boundary. */
export function convexPolygonUnionArea(
  polygons: readonly (readonly Vec2[])[],
  boundary: readonly Vec2[],
): number | null {
  const allValid = [boundary, ...polygons].every((ring) => {
    const validity = assessRingValidity(ring);
    return !validity.degenerate && !validity.nonConvex && !validity.selfIntersecting;
  });
  if (!allValid) return null;
  const clipped = polygons
    .map((polygon) => convexIntersection(polygon, boundary))
    .filter((ring) => ring.length >= 3 && Math.abs(signedArea(ring)) > 1e-15);
  if (clipped.length === 0) return 0;
  const segments = clipped.flatMap((ring) =>
    ring.map((a, index) => ({ a, b: ring[(index + 1) % ring.length]! })),
  );
  const xs = clipped.flatMap((ring) => ring.map(({ x }) => x));
  const epsilon = scaleOf(boundary) ** 2 * 1e-12;
  for (let left = 0; left < segments.length; left++) {
    for (let right = left + 1; right < segments.length; right++) {
      const x = properIntersectionX(segments[left]!, segments[right]!, epsilon);
      if (x !== null) xs.push(x);
    }
  }
  xs.sort((a, b) => a - b);
  const uniqueXs = xs.filter((x, index) => index === 0 || Math.abs(x - xs[index - 1]!) > epsilon);
  let area = 0;
  for (let index = 0; index + 1 < uniqueXs.length; index++) {
    const x0 = uniqueXs[index]!;
    const x1 = uniqueXs[index + 1]!;
    const width = x1 - x0;
    if (width <= epsilon) continue;
    const first = x0 + width / 3;
    const second = x0 + (2 * width) / 3;
    area +=
      (width * (unionIntervalLength(clipped, first) + unionIntervalLength(clipped, second))) / 2;
  }
  return area;
}
