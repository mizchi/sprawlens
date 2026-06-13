import type { Vec2 } from "../kernel/vec.js";

/** Squared distance from p to segment ab (avoids a sqrt per segment). */
function distance2ToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 1e-12) {
    t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const qx = a.x + t * dx;
  const qy = a.y + t * dy;
  const ex = p.x - qx;
  const ey = p.y - qy;
  return ex * ex + ey * ey;
}

/** Nearest distance from p to the open polyline through `points`. */
export function distanceToPolyline(p: Vec2, points: readonly Vec2[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y);
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d2 = distance2ToSegment(p, points[i]!, points[i + 1]!);
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

export type EdgePickCandidate = {
  source: string;
  target: string;
  points: readonly Vec2[];
};

export type EdgePick = { source: string; target: string; distance: number };

/** A background click within this screen distance of an edge selects it. */
export const EDGE_PICK_PX = 10;

/**
 * The candidate whose polyline passes closest to `point`, within `maxDist`
 * (all in world units). Picks the nearest edge even where several overlap —
 * no reliance on which shape happens to be on top. Ties resolve to the first
 * candidate, so callers control priority by ordering. Returns null when
 * nothing is within range.
 */
export function pickNearestEdge(
  point: Vec2,
  candidates: readonly EdgePickCandidate[],
  maxDist: number,
): EdgePick | null {
  let best: EdgePick | null = null;
  for (const candidate of candidates) {
    const distance = distanceToPolyline(point, candidate.points);
    if (distance > maxDist) continue;
    if (!best || distance < best.distance) {
      best = { source: candidate.source, target: candidate.target, distance };
    }
  }
  return best;
}

/**
 * Shared click→edge resolver: map a screen click to world space, then pick
 * the nearest candidate within `maxDist`. Both layouts route their
 * background click through this so overlapping edges resolve by distance,
 * never by paint order.
 */
export function pickEdgeAtPoint(
  clientToWorld: (x: number, y: number) => Vec2 | null,
  clientX: number,
  clientY: number,
  candidates: readonly EdgePickCandidate[],
  maxDist: number,
): EdgePick | null {
  const world = clientToWorld(clientX, clientY);
  return world ? pickNearestEdge(world, candidates, maxDist) : null;
}
