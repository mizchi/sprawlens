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
