/**
 * Language-agnostic code graph contract. Producers (TypeScript analyzers,
 * future MoonBit / LSP providers) emit this shape; layout consumes it.
 */
export type AtlasNodeKind = "module" | "file" | "symbol";

export type AtlasNodeMetrics = {
  loc: number;
};

export type AtlasNode = {
  id: string;
  kind: AtlasNodeKind;
  label: string;
  metrics: AtlasNodeMetrics;
  /** Public surface marker (exported symbol / public API file). */
  exported?: boolean;
};

export type AtlasEdge = {
  source: string;
  target: string;
  weight?: number;
};

export type AtlasGraph = {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
};

/**
 * Derives layout weights from a graph. LOC today; PageRank or dependency
 * scoring can be swapped in without touching the layout kernel.
 */
export type WeightScorer = (graph: AtlasGraph) => Map<string, number>;

export const locScorer: WeightScorer = (graph) =>
  new Map(graph.nodes.map((node) => [node.id, node.metrics.loc]));
