import type { Vec2 } from "@sprawlens/layout";

/** World-space rectangle: the committed (post-zoom/pan) viewport. */
export type ViewRect = { x: number; y: number; w: number; h: number };

/** A point is in view if it falls inside the rect grown by `slack`. */
export function pointInView(p: Vec2, view: ViewRect, slack: number): boolean {
  return (
    p.x >= view.x - slack &&
    p.x <= view.x + view.w + slack &&
    p.y >= view.y - slack &&
    p.y <= view.y + view.h + slack
  );
}

/**
 * A cell is in view if its axis-aligned bounding box (center ± half-span)
 * overlaps the rect. `halfSpan` is the cell's approximate radius
 * (sqrt(area)); a 1.5× factor keeps partially-visible cells alive so
 * panning never reveals an empty margin.
 */
export function cellInView(site: Vec2, halfSpan: number, view: ViewRect): boolean {
  return pointInView(site, view, halfSpan * 1.5);
}

/**
 * A segment is in view if its bounding box overlaps the rect (grown by
 * `slack`). Conservative — a long diagonal sweeping across the rect is
 * kept even when both endpoints sit off-screen — but it discards the bulk
 * of edges whose both ends share an off-screen quadrant, which is where
 * the overdraw lives at monorepo scale.
 */
export function segmentInView(a: Vec2, b: Vec2, view: ViewRect, slack: number): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return (
    maxX >= view.x - slack &&
    minX <= view.x + view.w + slack &&
    maxY >= view.y - slack &&
    minY <= view.y + view.h + slack
  );
}
