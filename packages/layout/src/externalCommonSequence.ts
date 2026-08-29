import type { LayoutSequenceGraph } from "./sequenceBenchmark.ts";

type GraphPath = readonly [LayoutSequenceGraph, LayoutSequenceGraph, LayoutSequenceGraph];

export type ExternalCommonSequenceProbe = {
  noOp: GraphPath;
  weightReversal: GraphPath;
  leafInsertionReversal: GraphPath;
  combinedReversal: GraphPath;
  orderAB: GraphPath;
  orderBA: GraphPath;
};

const cloneGraph = (graph: LayoutSequenceGraph): LayoutSequenceGraph => ({
  nodes: graph.nodes.map((node) => ({ ...node, hint: node.hint ? { ...node.hint } : undefined })),
  edges: graph.edges.map((edge) => ({ ...edge })),
});

const insertedIdentity = (existing: ReadonlySet<string>) => {
  const stem = "__sprawlens_inserted_leaf__";
  if (!existing.has(stem)) return stem;
  let suffix = 2;
  while (existing.has(`${stem}-${suffix}`)) suffix++;
  return `${stem}-${suffix}`;
};

/**
 * Build the external-common probe. Unlike the dependency-aware probe, B is a
 * leaf insertion observed by weight/hierarchy treemap methods.
 */
export function buildExternalCommonSequenceProbe(
  graph: LayoutSequenceGraph,
): ExternalCommonSequenceProbe {
  if (graph.nodes.length < 2) throw new Error("external-common probe requires at least two nodes");
  const base = cloneGraph(graph);
  const weightedId = [...base.nodes]
    .map(({ id }) => id)
    .sort((left, right) => left.localeCompare(right))[0]!;
  const weights = base.nodes.map(({ weight }) => weight).sort((left, right) => left - right);
  const insertionWeight = weights[Math.floor(weights.length / 2)]!;
  const newId = insertedIdentity(new Set(base.nodes.map(({ id }) => id)));
  const changeWeight = (input: LayoutSequenceGraph): LayoutSequenceGraph => ({
    nodes: input.nodes.map((node) =>
      node.id === weightedId ? { ...node, weight: Math.max(1, node.weight * 1.5) } : { ...node },
    ),
    edges: input.edges.map((edge) => ({ ...edge })),
  });
  const insertLeaf = (input: LayoutSequenceGraph): LayoutSequenceGraph => ({
    nodes: [...input.nodes.map((node) => ({ ...node })), { id: newId, weight: insertionWeight }],
    edges: input.edges.map((edge) => ({ ...edge })),
  });
  const afterA = changeWeight(base);
  const afterB = insertLeaf(base);
  const finalAB = insertLeaf(afterA);
  const finalBA = changeWeight(afterB);
  return {
    noOp: [cloneGraph(base), cloneGraph(base), cloneGraph(base)],
    weightReversal: [cloneGraph(base), cloneGraph(afterA), cloneGraph(base)],
    leafInsertionReversal: [cloneGraph(base), cloneGraph(afterB), cloneGraph(base)],
    combinedReversal: [cloneGraph(base), cloneGraph(finalAB), cloneGraph(base)],
    orderAB: [cloneGraph(base), cloneGraph(afterA), finalAB],
    orderBA: [cloneGraph(base), cloneGraph(afterB), finalBA],
  };
}
