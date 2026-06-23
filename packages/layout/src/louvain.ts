/**
 * Deterministic Louvain community detection (Blondel et al. 2008):
 * greedy modularity passes followed by graph aggregation, repeated until
 * no merge improves modularity. No RNG — nodes are visited in input
 * order and ties break toward the lowest community index, so the same
 * graph always yields the same partition. The per-level assignments give
 * the nested enclosures of the multi-level cluster layout.
 */
export type LouvainEdge = { source: string; target: string; weight?: number };

export type LouvainOptions = {
  /** >1 favors smaller communities, <1 larger ones. */
  resolution?: number;
};

export type LouvainResult = {
  /** Finest → coarsest; each maps every input node to a community id. */
  levels: Map<string, number>[];
  /** The coarsest (final) assignment. */
  communityOf: Map<string, number>;
};

type WorkGraph = {
  /** node → (neighbor → accumulated weight); self-loops live here too. */
  adjacency: Map<number, number>[];
  /** node strength: incident weight, self-loops counted twice. */
  strength: number[];
  totalStrength: number;
};

export function louvain(
  nodes: readonly string[],
  edges: readonly LouvainEdge[],
  options: LouvainOptions = {},
): LouvainResult {
  const resolution = options.resolution ?? 1;
  if (nodes.length === 0) return { levels: [], communityOf: new Map() };

  const indexOf = new Map(nodes.map((id, i) => [id, i]));
  let graph = buildGraph(
    nodes.length,
    edges.flatMap((e) => {
      const a = indexOf.get(e.source);
      const b = indexOf.get(e.target);
      return a === undefined || b === undefined ? [] : [[a, b, e.weight ?? 1] as const];
    }),
  );

  // assignmentOf[i] = community of original node i in the current level
  let assignment = nodes.map((_, i) => i);
  const levels: Map<string, number>[] = [];

  for (;;) {
    const partition = onePass(graph, resolution);
    const communityCount = new Set(partition).size;
    if (communityCount === graph.adjacency.length && levels.length > 0) break;
    // compact community ids in first-appearance order (deterministic)
    const renumber = new Map<number, number>();
    for (const c of partition) {
      if (!renumber.has(c)) renumber.set(c, renumber.size);
    }
    assignment = assignment.map((c) => renumber.get(partition[c]!)!);
    levels.push(new Map(nodes.map((id, i) => [id, assignment[i]!])));
    if (communityCount === graph.adjacency.length) break;
    graph = aggregate(graph, partition, renumber);
    if (graph.adjacency.length <= 1) break;
  }

  return { levels, communityOf: levels[levels.length - 1]! };
}

function buildGraph(
  size: number,
  weightedEdges: readonly (readonly [number, number, number])[],
): WorkGraph {
  const adjacency: Map<number, number>[] = Array.from({ length: size }, () => new Map());
  const strength = new Array<number>(size).fill(0);
  let totalStrength = 0;
  const add = (a: number, b: number, w: number) => {
    adjacency[a]!.set(b, (adjacency[a]!.get(b) ?? 0) + w);
  };
  for (const [a, b, w] of weightedEdges) {
    if (a === b) {
      add(a, a, w);
      strength[a]! += 2 * w;
      totalStrength += 2 * w;
      continue;
    }
    add(a, b, w);
    add(b, a, w);
    strength[a]! += w;
    strength[b]! += w;
    totalStrength += 2 * w;
  }
  return { adjacency, strength, totalStrength };
}

/** Greedy local-moving phase; returns the community per graph node. */
function onePass(graph: WorkGraph, resolution: number): number[] {
  const n = graph.adjacency.length;
  const community = Array.from({ length: n }, (_, i) => i);
  const communityStrength = graph.strength.slice();
  const m2 = graph.totalStrength || 1;

  let moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < n; i++) {
      const own = community[i]!;
      const ki = graph.strength[i]!;
      // weight from i into each adjacent community (self-loops excluded)
      const linkTo = new Map<number, number>();
      for (const [j, w] of graph.adjacency[i]!) {
        if (j === i) continue;
        const c = community[j]!;
        linkTo.set(c, (linkTo.get(c) ?? 0) + w);
      }
      communityStrength[own]! -= ki;
      let best = own;
      let bestGain = (linkTo.get(own) ?? 0) - (resolution * communityStrength[own]! * ki) / m2;
      for (const [c, link] of linkTo) {
        if (c === own) continue;
        const gain = link - (resolution * communityStrength[c]! * ki) / m2;
        if (gain > bestGain + 1e-12 || (gain > bestGain - 1e-12 && c < best)) {
          best = c;
          bestGain = gain;
        }
      }
      communityStrength[best]! += ki;
      if (best !== own) {
        community[i] = best;
        moved = true;
      }
    }
  }
  return community;
}

/** Collapse communities into super-nodes; internal edges become self-loops. */
function aggregate(
  graph: WorkGraph,
  partition: readonly number[],
  renumber: Map<number, number>,
): WorkGraph {
  const size = renumber.size;
  const merged: (readonly [number, number, number])[] = [];
  for (let i = 0; i < graph.adjacency.length; i++) {
    const a = renumber.get(partition[i]!)!;
    for (const [j, w] of graph.adjacency[i]!) {
      if (j === i) {
        merged.push([a, a, w]);
        continue;
      }
      if (j < i) continue; // each undirected pair once
      const b = renumber.get(partition[j]!)!;
      merged.push([a, b, w]);
    }
  }
  return buildGraph(size, merged);
}
