export type OrderEdge = { source: string; target: string };

/**
 * Crossing-reduction for concentric rings: order each ring's modules so
 * dependency edges between rings cross as little as possible. This is the
 * radial form of Sugiyama's barycenter heuristic — each module wants the
 * mean angle of its linked modules, and rings are re-spaced evenly so they
 * cannot collapse. Sweeps alternate inner→outer / outer→inner (Gauss-Seidel)
 * so an order settles instead of oscillating.
 *
 * `rings` maps a ring index to its members; the return maps each index to
 * the members in their crossing-reduced angular order. A lone innermost
 * ring is the center (origin, no angle): it never reorders and contributes
 * no pull, matching ringLayout's center placement.
 */
export function barycentricRingOrder(
  rings: ReadonlyMap<number, readonly string[]>,
  edges: readonly OrderEdge[],
  iterations = 6,
): Map<number, string[]> {
  const ringIndices = [...rings.keys()].sort((a, b) => a - b);
  const order = new Map<number, string[]>(
    ringIndices.map((i) => [i, [...rings.get(i)!]]),
  );
  if (ringIndices.length === 0) return order;

  // the lone innermost circle is the center: fixed, angle-less
  const center =
    order.get(ringIndices[0]!)!.length === 1 ? order.get(ringIndices[0]!)![0]! : null;

  const adjacency = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = adjacency.get(a);
    if (list) list.push(b);
    else adjacency.set(a, [b]);
  };
  for (const e of edges) {
    if (e.source === e.target) continue;
    link(e.source, e.target);
    link(e.target, e.source);
  }

  const angle = new Map<string, number>();
  const respace = (ring: number) => {
    const members = order.get(ring)!;
    const n = members.length;
    members.forEach((id, i) => angle.set(id, (2 * Math.PI * i) / n));
  };
  for (const ring of ringIndices) {
    if (order.get(ring)!.length === 1 && order.get(ring)![0] === center) continue;
    respace(ring);
  }

  const meanAngle = (id: string): number | null => {
    const neighbors = adjacency.get(id);
    if (!neighbors) return null;
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (const other of neighbors) {
      if (other === center) continue; // center sits at the origin, no angle
      const a = angle.get(other);
      if (a === undefined) continue;
      sx += Math.cos(a);
      sy += Math.sin(a);
      count++;
    }
    if (count === 0 || (sx === 0 && sy === 0)) return null;
    return Math.atan2(sy, sx);
  };

  const sweep = ringIndices.filter(
    (ring) => !(order.get(ring)!.length === 1 && order.get(ring)![0] === center),
  );
  for (let iter = 0; iter < iterations; iter++) {
    const seq = iter % 2 === 0 ? sweep : [...sweep].reverse();
    for (const ring of seq) {
      const members = order.get(ring)!;
      // keep an unlinked module's current angle so it holds its slot
      const targetOf = new Map<string, number>(
        members.map((id) => [id, meanAngle(id) ?? angle.get(id)!]),
      );
      members.sort(
        (a, b) =>
          targetOf.get(a)! - targetOf.get(b)! ||
          (a < b ? -1 : a > b ? 1 : 0),
      );
      respace(ring);
    }
  }
  return order;
}
