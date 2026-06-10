export type ReachEdge = { source: string; target: string };

export type ReachResult<E extends ReachEdge> = {
  nodes: Set<string>;
  /** Union of both directions. */
  edges: E[];
  /** Edges on paths the root depends on (forward walk). */
  downstreamEdges: E[];
  /** Edges on paths that depend on the root (backward walk). */
  upstreamEdges: E[];
};

/**
 * Dependency-path extraction: the subgraph reachable from `root` going
 * downstream (what it depends on) plus upstream (what depends on it), with
 * exactly the edges traversed. Edges between two ancestors' siblings etc.
 * are excluded — only paths through/from/to the root remain. Cycle-safe.
 */
export function reachSubgraph<E extends ReachEdge>(
  edges: readonly E[],
  root: string,
): ReachResult<E> {
  const forward = new Map<string, E[]>();
  const backward = new Map<string, E[]>();
  for (const edge of edges) {
    const f = forward.get(edge.source);
    if (f) f.push(edge);
    else forward.set(edge.source, [edge]);
    const b = backward.get(edge.target);
    if (b) b.push(edge);
    else backward.set(edge.target, [edge]);
  }

  const nodes = new Set<string>([root]);
  const walk = (
    adjacency: Map<string, E[]>,
    nextOf: (edge: E) => string,
  ): Set<E> => {
    const collected = new Set<E>();
    const visited = new Set<string>([root]);
    const queue = [root];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of adjacency.get(current) ?? []) {
        collected.add(edge);
        const next = nextOf(edge);
        nodes.add(next);
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    return collected;
  };
  const downstream = walk(forward, (e) => e.target);
  const upstream = walk(backward, (e) => e.source);
  return {
    nodes,
    edges: [...new Set([...downstream, ...upstream])],
    downstreamEdges: [...downstream],
    upstreamEdges: [...upstream],
  };
}
