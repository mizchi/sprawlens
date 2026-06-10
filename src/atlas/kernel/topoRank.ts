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
  const adjacency = new Map<string, string[]>();
  for (const id of nodes) adjacency.set(id, []);
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
  }

  // Tarjan SCC (iterative to dodge recursion limits on deep graphs)
  const indexOf = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const componentOf = new Map<string, number>();
  let nextIndex = 0;
  let componentCount = 0;

  for (const root of nodes) {
    if (indexOf.has(root)) continue;
    const work: { node: string; edgeIndex: number }[] = [
      { node: root, edgeIndex: 0 },
    ];
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const { node } = frame;
      if (frame.edgeIndex === 0) {
        indexOf.set(node, nextIndex);
        lowlink.set(node, nextIndex);
        nextIndex++;
        stack.push(node);
        onStack.add(node);
      }
      const targets = adjacency.get(node)!;
      let descended = false;
      while (frame.edgeIndex < targets.length) {
        const target = targets[frame.edgeIndex]!;
        frame.edgeIndex++;
        if (!indexOf.has(target)) {
          work.push({ node: target, edgeIndex: 0 });
          descended = true;
          break;
        }
        if (onStack.has(target)) {
          lowlink.set(
            node,
            Math.min(lowlink.get(node)!, indexOf.get(target)!),
          );
        }
      }
      if (descended) continue;
      if (lowlink.get(node) === indexOf.get(node)) {
        for (;;) {
          const member = stack.pop()!;
          onStack.delete(member);
          componentOf.set(member, componentCount);
          if (member === node) break;
        }
        componentCount++;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) {
        lowlink.set(
          parent.node,
          Math.min(lowlink.get(parent.node)!, lowlink.get(node)!),
        );
      }
    }
  }

  // condensed DAG, then longest path via memoized DFS (acyclic by SCC)
  const componentDeps = new Map<number, Set<number>>();
  for (let c = 0; c < componentCount; c++) componentDeps.set(c, new Set());
  for (const [source, targets] of adjacency) {
    const from = componentOf.get(source)!;
    for (const target of targets) {
      const to = componentOf.get(target)!;
      if (from !== to) componentDeps.get(from)!.add(to);
    }
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
