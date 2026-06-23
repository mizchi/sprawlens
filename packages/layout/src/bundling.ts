import type { Vec2 } from "./vec.ts";

/**
 * Hierarchical edge bundling (Holten 2006): an edge's control polyline runs
 * from the source up the hierarchy to the lowest common ancestor and back
 * down to the target; rendering a smooth curve through it makes edges that
 * share hierarchy segments visually bundle together.
 */

/**
 * Control polyline for the edge source→target. Ancestors come from
 * `parentOf` (null = root); each visited node contributes its position from
 * `positionOf`. The LCA itself is included once when it is a real node;
 * ancestors without a position are skipped (e.g. the implicit root).
 * Returns null when either endpoint has no position.
 */
export function hierarchyControlPoints(
  source: string,
  target: string,
  parentOf: ReadonlyMap<string, string | null>,
  positionOf: ReadonlyMap<string, Vec2>,
): Vec2[] | null {
  const sourcePos = positionOf.get(source);
  const targetPos = positionOf.get(target);
  if (!sourcePos || !targetPos) return null;

  const chainOf = (id: string): string[] => {
    const chain: string[] = [];
    let cur: string | null | undefined = id;
    while (cur != null && !chain.includes(cur)) {
      chain.push(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return chain;
  };
  const up = chainOf(source);
  const down = chainOf(target);

  // strip the common ancestor suffix, keeping the LCA once
  let si = up.length - 1;
  let ti = down.length - 1;
  let lca: string | null = null;
  while (si >= 0 && ti >= 0 && up[si] === down[ti]) {
    lca = up[si]!;
    si--;
    ti--;
  }

  const ids = [
    ...up.slice(0, si + 1),
    ...(lca !== null && lca !== source && lca !== target ? [lca] : []),
    ...down.slice(0, ti + 1).reverse(),
  ];
  const points: Vec2[] = [];
  for (const id of ids) {
    const p = positionOf.get(id);
    if (p) points.push({ x: p.x, y: p.y });
  }
  return points.length >= 2 ? points : [sourcePos, targetPos];
}

/**
 * Bundling-strength straightening: blends interior control points toward the
 * source→target chord. strength=1 keeps the hierarchy path (fully bundled),
 * strength=0 yields a straight edge. Endpoints never move.
 */
export function bundlePath(path: readonly Vec2[], strength: number): Vec2[] {
  const n = path.length;
  if (n <= 2) return path.map((p) => ({ ...p }));
  const first = path[0]!;
  const last = path[n - 1]!;
  return path.map((p, i) => {
    const t = i / (n - 1);
    const chordX = first.x + (last.x - first.x) * t;
    const chordY = first.y + (last.y - first.y) * t;
    return {
      x: p.x + (chordX - p.x) * (1 - strength),
      y: p.y + (chordY - p.y) * (1 - strength),
    };
  });
}
