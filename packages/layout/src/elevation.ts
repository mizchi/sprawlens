import { topoRank } from "./topoRank.ts";

/** `source` depends on (imports) `target` — the atlas edge direction. */
export type ElevationEdge = { source: string; target: string };

/**
 * Topological elevation rooted at an entry point. The entry (e.g. the app's
 * `main`) sits at the summit; following what it depends on descends, and its
 * deepest transitive dependency is sea level (0). Only the entry's dependency
 * closure gets a height — unrelated islands and the things that depend *on* the
 * entry are left out (they aren't below it). A dependency cycle collapses to
 * one shared elevation (via topoRank's SCC condensation).
 *
 * Pure: callers pick the entry (a real entry point or any node to stand on) and
 * pass the dependency edges; the renderer lifts each node by the height here.
 */
export function elevationFromEntry(
  entry: string | readonly string[],
  edges: readonly ElevationEdge[],
): Map<string, number> {
  const entries = typeof entry === "string" ? [entry] : entry;
  // forward (dependency) closure: the entries plus everything they transitively
  // import, walking source → target only
  const forward = new Map<string, ElevationEdge[]>();
  for (const edge of edges) {
    const list = forward.get(edge.source);
    if (list) list.push(edge);
    else forward.set(edge.source, [edge]);
  }
  const reachable = new Set<string>(entries);
  const queue = [...entries];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of forward.get(current) ?? []) {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  // rank within the closure: leaves (no deps) = 0, the entry (depends on the
  // deepest chain) = max — which is exactly the elevation we want
  const subEdges = edges.filter((e) => reachable.has(e.source) && reachable.has(e.target));
  return topoRank([...reachable], subEdges);
}
