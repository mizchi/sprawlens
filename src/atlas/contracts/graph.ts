/**
 * Language-agnostic code graph contract. Producers (TypeScript analyzers,
 * future MoonBit / LSP providers) emit this shape; layout consumes it.
 */
/**
 * Containment levels, outer to inner. "service" groups modules into
 * deployment/communication units; "block" is a CFG basic block inside a
 * symbol. Any subset of levels can act as display boundaries — see
 * contracts/hierarchy.ts.
 */
export type AtlasNodeKind =
  | "service"
  | "module"
  | "directory"
  | "file"
  | "class"
  | "symbol"
  | "block";

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

/**
 * Edge provenance: "import" is a static code dependency, "call" is an
 * observed/declared communication link (service RPC, queue), "flow" is a
 * control-flow edge between CFG blocks. Lifted aggregates keep the kind
 * only when every contributing edge agrees.
 */
export type AtlasEdgeKind = "import" | "call" | "flow";

export type AtlasEdge = {
  source: string;
  target: string;
  weight?: number;
  kind?: AtlasEdgeKind;
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
