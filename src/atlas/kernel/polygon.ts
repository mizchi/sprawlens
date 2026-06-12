import type { Vec2 } from "./vec.js";

/** Open ring (last vertex implicitly connects to the first), CCW for positive area. */
export type Ring = Vec2[];

export type Circle = { cx: number; cy: number; r: number };

export function signedArea(ring: Ring): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
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
export function clipHalfPlane(
  ring: Ring,
  nx: number,
  ny: number,
  c: number,
): Ring {
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
      const t = curDist / (curDist - nextDist);
      out.push({
        x: cur.x + (next.x - cur.x) * t,
        y: cur.y + (next.y - cur.y) * t,
      });
    }
  }
  return out.length < 3 ? [] : out;
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
    const t =
      len2 > 0
        ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2))
        : 0;
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
  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
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
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper].map((p) => ({ ...p }));
}
