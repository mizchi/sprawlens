/**
 * Strongly connected components (iterative Tarjan) and the analyses built
 * on them: cycle detection and a greedy feedback edge set. These power the
 * "red flow" rendering (edges that keep the dependency graph cyclic) and
 * refactor suggestions (biggest tangles first).
 */
export type SccEdge = { source: string; target: string };

export type SccResult = {
  /** Tarjan emission order: dependencies before their dependents. */
  components: string[][];
  componentOf: Map<string, number>;
};

export function edgeKey(source: string, target: string): string {
  return `${source} ${target}`;
}

export function stronglyConnectedComponents(
  nodes: readonly string[],
  edges: readonly SccEdge[],
): SccResult {
  const adjacency = buildAdjacency(nodes, edges);

  const indexOf = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const componentOf = new Map<string, number>();
  const components: string[][] = [];
  let nextIndex = 0;

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
        const members: string[] = [];
        for (;;) {
          const member = stack.pop()!;
          onStack.delete(member);
          componentOf.set(member, components.length);
          members.push(member);
          if (member === node) break;
        }
        components.push(members);
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
  return { components, componentOf };
}

/**
 * Components that actually contain a cycle (size > 1, or a self-loop),
 * largest first — the ranking refactor suggestions start from.
 */
export function cyclicComponents(
  nodes: readonly string[],
  edges: readonly SccEdge[],
): string[][] {
  const ids = new Set(nodes);
  const selfLooped = new Set<string>();
  for (const edge of edges) {
    if (edge.source === edge.target && ids.has(edge.source)) {
      selfLooped.add(edge.source);
    }
  }
  const scc = stronglyConnectedComponents(nodes, edges);
  return scc.components
    .filter((c) => c.length > 1 || selfLooped.has(c[0]!))
    .sort((a, b) => b.length - a.length);
}

/**
 * Greedy feedback edge set: DFS back edges (target still on the DFS path)
 * plus self-loops. Removing them makes the graph acyclic, so they are the
 * edges that "go against the flow" — drawn as red flows in the map.
 * Deterministic for a fixed node/edge order.
 */
export function feedbackEdges(
  nodes: readonly string[],
  edges: readonly SccEdge[],
): Set<string> {
  const adjacency = buildAdjacency(nodes, edges);
  const feedback = new Set<string>();
  const visited = new Set<string>();
  const onPath = new Set<string>();

  for (const root of nodes) {
    if (visited.has(root)) continue;
    const work: { node: string; edgeIndex: number }[] = [
      { node: root, edgeIndex: 0 },
    ];
    visited.add(root);
    onPath.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const targets = adjacency.get(frame.node)!;
      let descended = false;
      while (frame.edgeIndex < targets.length) {
        const target = targets[frame.edgeIndex]!;
        frame.edgeIndex++;
        if (onPath.has(target)) {
          feedback.add(edgeKey(frame.node, target));
          continue;
        }
        if (visited.has(target)) continue;
        visited.add(target);
        onPath.add(target);
        work.push({ node: target, edgeIndex: 0 });
        descended = true;
        break;
      }
      if (descended) continue;
      onPath.delete(frame.node);
      work.pop();
    }
  }
  return feedback;
}

function buildAdjacency(
  nodes: readonly string[],
  edges: readonly SccEdge[],
): Map<string, string[]> {
  const ids = new Set(nodes);
  const adjacency = new Map<string, string[]>();
  for (const id of nodes) adjacency.set(id, []);
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
  }
  return adjacency;
}
