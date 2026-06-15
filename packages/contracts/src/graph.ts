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
  /** Cyclomatic complexity (branch points + 1) when the producer measured
   * it; consumers fall back to a LOC-based estimate. */
  complexity?: number;
};

/** Producer-reported symbol classification (declaration form), for icons.
 * const/let are not distinguished yet (both "variable"), nor async/static. */
export type SymbolKind =
  | "function"
  | "class"
  | "variable"
  | "type"
  | "interface"
  | "enum"
  // class members; static- variants are the static counterparts
  | "method"
  | "property"
  | "static-method"
  | "static-property";

export type AtlasNode = {
  id: string;
  kind: AtlasNodeKind;
  label: string;
  metrics: AtlasNodeMetrics;
  /** Public surface marker (exported symbol / public API file). */
  exported?: boolean;
  /** Symbol declaration kind (function/class/...), when the node is a symbol. */
  symbolKind?: SymbolKind;
  /** Visual layer (test, deps, ...) for a file node; absent = source plane. */
  layer?: string;
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
  /** Names referenced across this edge — the imported symbols, for edge
   * labels. Lifted aggregates union their contributors' refs, so a bundled
   * module→module edge carries every symbol name behind it. */
  refs?: string[];
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
