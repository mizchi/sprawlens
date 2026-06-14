import type { Vec2 } from "@sprawlens/layout";

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

/** A click/hover over empty canvas grabs an edge within this screen distance
 * — the hit target is far wider than the hairline stroke so edges in the open
 * are easy to catch. */
export const EDGE_PICK_PX = 16;
/** Over a node shape (circle / cell), the edge must be this much closer to
 * win, so the node stays selectable while edges crossing it remain catchable
 * when the cursor is right on them. */
export const EDGE_PICK_NODE_PX = 7;
/**
 * Dominance: the nearest edge is grabbed only when it is at least this much
 * closer than the runner-up (d1 ≤ d2 · dominance). The wide hit radius then
 * shrinks automatically where edges crowd — neighbours keep a clear contested
 * band between them instead of their fat targets overlapping. 1 disables it.
 */
export const EDGE_PICK_DOMINANCE = 0.8;

/**
 * The candidate whose polyline passes closest to `point`, within `maxDist`
 * (all in world units). Picks the nearest edge even where several overlap —
 * no reliance on which shape happens to be on top. With `dominance` < 1 the
 * nearest must also beat the runner-up by that ratio, so a wide hit radius
 * doesn't bleed past the midline between two close edges. Returns null when
 * nothing qualifies.
 */
export function pickNearestEdge(
  point: Vec2,
  candidates: readonly EdgePickCandidate[],
  maxDist: number,
  dominance = 1,
): EdgePick | null {
  let best: EdgePick | null = null;
  let d1 = Infinity;
  let d2 = Infinity; // runner-up distance, for the dominance test
  for (const candidate of candidates) {
    const distance = distanceToPolyline(point, candidate.points);
    if (distance < d1) {
      d2 = d1;
      d1 = distance;
      best = { source: candidate.source, target: candidate.target, distance };
    } else if (distance < d2) {
      d2 = distance;
    }
  }
  if (!best || d1 > maxDist) return null;
  // contested: another edge is nearly as close, so don't commit to either
  if (d1 > d2 * dominance) return null;
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
  dominance = 1,
): EdgePick | null {
  const world = clientToWorld(clientX, clientY);
  return world ? pickNearestEdge(world, candidates, maxDist, dominance) : null;
}
