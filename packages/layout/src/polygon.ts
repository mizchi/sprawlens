import type { Vec2 } from "./vec.ts";
import { orientationDeterminant } from "./orientation.ts";
import { halfPlaneBoundaryParameter } from "./halfPlaneIntersection.ts";

/** Open ring (last vertex implicitly connects to the first), CCW for positive area. */
export type Ring = Vec2[];

export type Circle = { cx: number; cy: number; r: number };

export function signedTwiceArea(ring: readonly Vec2[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

export function signedArea(ring: Ring): number {
  return signedTwiceArea(ring) / 2;
}

export function centroid(ring: Ring): Vec2 {
  const area = signedArea(ring);
  if (ring.length === 0) return { x: 0, y: 0 };
  if (ring.length < 3 || area === 0) {
    let sx = 0;
    let sy = 0;
    for (const p of ring) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / ring.length, y: sy / ring.length };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/**
 * Sutherland–Hodgman clip against the half-plane nx*x + ny*y <= c.
 * Preserves orientation; returns [] when the ring is fully outside.
 */
export function clipHalfPlane(ring: Ring, nx: number, ny: number, c: number): Ring {
  if (ring.length === 0) return [];
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i]!;
    const next = ring[(i + 1) % ring.length]!;
    const curDist = nx * cur.x + ny * cur.y - c;
    const nextDist = nx * next.x + ny * next.y - c;
    const curInside = curDist <= 0;
    const nextInside = nextDist <= 0;
    if (curInside) out.push(cur);
    if (curInside !== nextInside) {
      const t = halfPlaneBoundaryParameter(curDist, nextDist);
      out.push({
        x: cur.x + (next.x - cur.x) * t,
        y: cur.y + (next.y - cur.y) * t,
      });
    }
  }
  return out.length < 3 ? [] : out;
}

const counterClockwise = (ring: readonly Vec2[]): Ring => {
  const copy = ring.map((point) => ({ ...point }));
  return signedArea(copy) < 0 ? copy.reverse() : copy;
};

/** Intersection of two convex rings. Input orientation may be CW or CCW. */
export function convexIntersection(subject: readonly Vec2[], clip: readonly Vec2[]): Ring {
  let intersection = counterClockwise(subject);
  const boundary = counterClockwise(clip);
  if (intersection.length < 3 || boundary.length < 3) return [];
  for (let index = 0; index < boundary.length; index++) {
    const a = boundary[index]!;
    const b = boundary[(index + 1) % boundary.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    intersection = clipHalfPlane(intersection, dy, -dx, dy * a.x - dx * a.y);
    if (intersection.length === 0) break;
  }
  return intersection;
}

/** Intersection over union for two convex rings, in [0, 1]. */
export function polygonIoU(a: readonly Vec2[], b: readonly Vec2[]): number {
  const areaA = Math.abs(signedArea([...a]));
  const areaB = Math.abs(signedArea([...b]));
  const intersectionArea = Math.abs(signedArea(convexIntersection(a, b)));
  const union = areaA + areaB - intersectionArea;
  if (union <= 1e-12) return areaA <= 1e-12 && areaB <= 1e-12 ? 1 : 0;
  return Math.max(0, Math.min(1, intersectionArea / union));
}

/** Point-in-polygon for convex CCW rings. */
export function containsPoint(ring: Ring, p: Vec2): boolean {
  if (ring.length < 3) return false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) {
      return false;
    }
  }
  return true;
}

export function circleToPolygon(circle: Circle, segments: number): Ring {
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    ring.push({
      x: circle.cx + Math.cos(angle) * circle.r,
      y: circle.cy + Math.sin(angle) * circle.r,
    });
  }
  return ring;
}

/**
 * Nearest point of a convex ring to `p`: `p` itself when inside, otherwise
 * the closest point on the boundary (projected-gradient constraint for
 * region-confined layouts).
 */
export function nearestPointInRing(ring: Ring, p: Vec2): Vec2 {
  if (ring.length < 3) {
    if (ring.length === 0) return p;
    let sx = 0;
    let sy = 0;
    for (const v of ring) {
      sx += v.x;
      sy += v.y;
    }
    return { x: sx / ring.length, y: sy / ring.length };
  }
  if (containsPoint(ring, p)) return p;
  let best: Vec2 = ring[0]!;
  let bestD2 = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len2 = ex * ex + ey * ey;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2)) : 0;
    const qx = a.x + ex * t;
    const qy = a.y + ey * t;
    const d2 = (p.x - qx) ** 2 + (p.y - qy) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = { x: qx, y: qy };
    }
  }
  return best;
}

/**
 * Convex hull (Andrew monotone chain), CCW in screen coordinates.
 * Returns fewer than 3 points unchanged; collinear inputs collapse to
 * their extremes — callers needing an area must check the result.
 */
export function convexHull(points: readonly Vec2[]): Ring {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Vec2[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      orientationDeterminant(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (
      upper.length >= 2 &&
      orientationDeterminant(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper].map((p) => ({ ...p }));
}
