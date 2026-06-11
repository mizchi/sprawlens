export type RankableEdge = { source: string; target: string };

export type PageRankOptions = {
  damping?: number;
  iterations?: number;
  tolerance?: number;
};

/**
 * Standard PageRank over a dependency graph. An edge `source → target`
 * reads "source depends on target", so rank flows toward the
 * most-depended-upon nodes (the load-bearing public API). Dangling nodes
 * redistribute uniformly; the result sums to 1.
 */
export function pageRank(
  nodes: readonly string[],
  edges: readonly RankableEdge[],
  options?: PageRankOptions,
): Map<string, number> {
  const { damping = 0.85, iterations = 100, tolerance = 1e-9 } =
    options ?? {};
  const n = nodes.length;
  if (n === 0) return new Map();
  const indexOf = new Map(nodes.map((id, i) => [id, i]));
  const outgoing: number[][] = nodes.map(() => []);
  for (const edge of edges) {
    const from = indexOf.get(edge.source);
    const to = indexOf.get(edge.target);
    if (from === undefined || to === undefined || from === to) continue;
    outgoing[from]!.push(to);
  }

  let rank = new Array<number>(n).fill(1 / n);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = new Array<number>(n).fill((1 - damping) / n);
    let danglingMass = 0;
    for (let i = 0; i < n; i++) {
      const targets = outgoing[i]!;
      if (targets.length === 0) {
        danglingMass += rank[i]!;
        continue;
      }
      const share = (damping * rank[i]!) / targets.length;
      for (const target of targets) next[target]! += share;
    }
    const danglingShare = (damping * danglingMass) / n;
    let delta = 0;
    for (let i = 0; i < n; i++) {
      next[i]! += danglingShare;
      delta += Math.abs(next[i]! - rank[i]!);
    }
    rank = next;
    if (delta < tolerance) break;
  }
  return new Map(nodes.map((id, i) => [id, rank[i]!]));
}
