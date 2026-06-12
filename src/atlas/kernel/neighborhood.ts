import type { AtlasEdge } from "../contracts/graph.js";
import type { CellResult } from "./capacityLayout.js";

/**
 * Neighborhood preservation for Voronoi treemaps (Paetzold et al. 2025):
 * dependency edges should be realized as shared cell borders. The power
 * diagram already labels every cell edge with the neighbor that produced
 * it, so adjacency extraction is free; a greedy swap pass then permutes
 * the node→slot assignment to maximize the realized-edge rate directly on
 * the cell adjacency graph.
 */

/** Symmetric cell adjacency from the labeled power-diagram edges. */
export function cellAdjacency(
  cells: readonly CellResult[],
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const cell of cells) adjacency.set(cell.id, new Set());
  for (const cell of cells) {
    const own = adjacency.get(cell.id)!;
    for (const edge of cell.edges) {
      if (edge.neighborId === null) continue;
      const other = adjacency.get(edge.neighborId);
      if (!other) continue;
      own.add(edge.neighborId);
      other.add(cell.id);
    }
  }
  return adjacency;
}

/**
 * Fraction of edges whose endpoints ended up as adjacent cells. Edges with
 * endpoints outside the adjacency map and self loops are skipped; with no
 * eligible edges the constraint set is vacuously satisfied (rate 1).
 */
export function realizedEdgeRate(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  edges: readonly AtlasEdge[],
): number {
  let eligible = 0;
  let realized = 0;
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const neighbors = adjacency.get(edge.source);
    if (!neighbors || !adjacency.has(edge.target)) continue;
    eligible++;
    if (neighbors.has(edge.target)) realized++;
  }
  return eligible === 0 ? 1 : realized / eligible;
}

/**
 * Greedy pairwise swaps on a node→slot permutation: a swap is kept when it
 * strictly increases the number of constraint edges realized as slot
 * adjacencies. Deterministic (fixed pair order), delta-evaluated, and runs
 * passes until a full pass finds no improvement.
 */
export function greedySwapAssignment(
  assign: readonly number[],
  nodes: readonly string[],
  slotAdjacency: readonly ReadonlySet<number>[],
  edges: readonly AtlasEdge[],
  maxPasses = 8,
): number[] {
  const n = nodes.length;
  const current = [...assign];
  if (n < 2) return current;
  const indexOf = new Map(nodes.map((id, i) => [id, i]));
  // constraint neighbors per node index (deduped, ignoring unknown ids)
  const linked: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (const edge of edges) {
    const a = indexOf.get(edge.source);
    const b = indexOf.get(edge.target);
    if (a === undefined || b === undefined || a === b) continue;
    linked[a]!.add(b);
    linked[b]!.add(a);
  }

  /** Realized links of node i if it sat on `slot` (j's slot read live). */
  const realizedAt = (i: number, slot: number, ignore: number): number => {
    let count = 0;
    for (const j of linked[i]!) {
      if (j === ignore) continue;
      if (slotAdjacency[slot]!.has(current[j]!)) count++;
    }
    return count;
  };

  for (let pass = 0; pass < maxPasses; pass++) {
    let improvedInPass = false;
    for (let i = 0; i < n; i++) {
      if (linked[i]!.size === 0) continue;
      for (let k = i + 1; k < n; k++) {
        if (linked[i]!.size === 0 && linked[k]!.size === 0) continue;
        const si = current[i]!;
        const sk = current[k]!;
        // the i–k edge (if any) flips between slot pairs of identical
        // adjacency, so it cancels out of the delta; exclude it via ignore
        const before =
          realizedAt(i, si, k) + realizedAt(k, sk, i);
        const after = realizedAt(i, sk, k) + realizedAt(k, si, i);
        if (after > before) {
          current[i] = sk;
          current[k] = si;
          improvedInPass = true;
        }
      }
    }
    if (!improvedInPass) break;
  }
  return current;
}
