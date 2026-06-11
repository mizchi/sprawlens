import { stronglyConnectedComponents } from "./scc.js";

export type RankEdge = { source: string; target: string };

/**
 * Longest-path topological rank, cycle-tolerant. `source → target` reads
 * "source depends on target"; nodes with no dependencies get rank 0 and a
 * node's rank is 1 + max(rank of its dependencies). Cycles are collapsed
 * into a single strongly connected component (Tarjan) that shares one rank.
 */
export function topoRank(
  nodes: readonly string[],
  edges: readonly RankEdge[],
): Map<string, number> {
  const ids = new Set(nodes);
  const { componentOf, components } = stronglyConnectedComponents(
    nodes,
    edges,
  );

  // condensed DAG, then longest path via memoized DFS (acyclic by SCC)
  const componentDeps = new Map<number, Set<number>>();
  for (let c = 0; c < components.length; c++) componentDeps.set(c, new Set());
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    const from = componentOf.get(edge.source)!;
    const to = componentOf.get(edge.target)!;
    if (from !== to) componentDeps.get(from)!.add(to);
  }
  const componentRank = new Map<number, number>();
  const rankOf = (component: number): number => {
    const cached = componentRank.get(component);
    if (cached !== undefined) return cached;
    let rank = 0;
    for (const dep of componentDeps.get(component)!) {
      rank = Math.max(rank, rankOf(dep) + 1);
    }
    componentRank.set(component, rank);
    return rank;
  };

  const result = new Map<string, number>();
  for (const id of nodes) {
    result.set(id, rankOf(componentOf.get(id)!));
  }
  return result;
}
