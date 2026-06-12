import type { AtlasEdge, AtlasGraph, AtlasNode } from "../contracts/graph.js";
import { parentFileOf } from "../contracts/hierarchy.js";
import { defaultModuleIdOf } from "../contracts/modules.js";
import { pageRank } from "../kernel/pagerank.js";

/**
 * Public-API network projection: file scope is dropped, every exported
 * symbol becomes a node and only the dependency network among public
 * symbols remains. Cell areas follow PageRank over that network — the
 * most-depended-upon API surfaces grow — and positions come from graph
 * proximity (force layout).
 */

/** Module of a symbol = module of its parent file. */
export function apiModuleIdOf(symbolId: string): string {
  return defaultModuleIdOf(parentFileOf(symbolId));
}

export type ApiBoundarySplit = {
  /** Internal symbols + internal↔internal edges; what the layout subdivides. */
  internal: AtlasGraph;
  /** module id → its externally-referenced symbols (the adapter ports). */
  boundaryByModule: Map<string, AtlasNode[]>;
};

/**
 * Symbols referenced from outside their module are the module's real
 * interface: they leave the cell layout and sit on the circle's rim as
 * adapter ports, with their inward references showing the delegation.
 *
 * `rawEdges` (the unprojected symbol references, sources may be file ids)
 * widen the classification: a cross-module reference marks its target as
 * boundary even when the using symbol was too ambiguous to project.
 */
export function splitApiBoundary(
  api: AtlasGraph,
  moduleIdOf: (id: string) => string,
  rawEdges: readonly AtlasEdge[] = [],
): ApiBoundarySplit {
  const nodeIds = new Set(api.nodes.map((n) => n.id));
  const boundaryIds = new Set<string>();
  for (const edge of api.edges) {
    if (moduleIdOf(edge.source) !== moduleIdOf(edge.target)) {
      boundaryIds.add(edge.target);
    }
  }
  for (const edge of rawEdges) {
    if (!nodeIds.has(edge.target)) continue;
    // moduleIdOf handles both symbol ids and plain file ids
    if (moduleIdOf(edge.source) !== moduleIdOf(edge.target)) {
      boundaryIds.add(edge.target);
    }
  }
  const boundaryByModule = new Map<string, AtlasNode[]>();
  const internalNodes: AtlasNode[] = [];
  for (const node of api.nodes) {
    if (boundaryIds.has(node.id)) {
      const moduleId = moduleIdOf(node.id);
      const list = boundaryByModule.get(moduleId);
      if (list) list.push(node);
      else boundaryByModule.set(moduleId, [node]);
    } else {
      internalNodes.push(node);
    }
  }
  return {
    internal: {
      nodes: internalNodes,
      edges: api.edges.filter(
        (e) => !boundaryIds.has(e.source) && !boundaryIds.has(e.target),
      ),
    },
    boundaryByModule,
  };
}

export type ApiGraphOptions = {
  /** Keep non-exported symbols too (the full symbol network). */
  includePrivate?: boolean;
  /** Area scoring; defaults to PageRank over the projected network. */
  weight?: "pagerank" | "loc";
};

export function buildApiGraph(
  fileGraph: AtlasGraph,
  symbolsOf: (fileId: string) => AtlasNode[],
  symbolEdges: readonly AtlasEdge[],
  options: ApiGraphOptions = {},
): AtlasGraph {
  const nodes: AtlasNode[] = [];
  const nodeIds = new Set<string>();
  /** file id → its single exported symbol, when unambiguous. */
  const soleExportOf = new Map<string, string | null>();
  for (const file of fileGraph.nodes) {
    const symbols = symbolsOf(file.id);
    const exported = symbols.filter((s) => s.exported === true);
    soleExportOf.set(file.id, exported.length === 1 ? exported[0]!.id : null);
    for (const symbol of options.includePrivate ? symbols : exported) {
      nodes.push({
        id: symbol.id,
        kind: "symbol",
        label: symbol.label,
        metrics: { loc: Math.max(symbol.metrics.loc, 1) },
        exported: symbol.exported === true,
      });
      nodeIds.add(symbol.id);
    }
  }

  const edges: AtlasEdge[] = [];
  const seen = new Set<string>();
  for (const edge of symbolEdges) {
    // static file→symbol references are lifted only when the source file
    // exports exactly one symbol; anything else is ambiguous and dropped
    const source = nodeIds.has(edge.source)
      ? edge.source
      : (soleExportOf.get(edge.source) ?? null);
    if (!source || !nodeIds.has(edge.target) || source === edge.target)
      continue;
    const key = `${source}->${edge.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ source, target: edge.target });
  }

  // area = PageRank: rank flows toward the most-depended-upon symbols.
  // Normalized so the mean weight is 1 (unlinked symbols keep a floor).
  // weight: "loc" keeps the symbols' own sizes instead.
  if (options.weight !== "loc") {
    const ranks = pageRank(
      nodes.map((n) => n.id),
      edges,
    );
    for (const node of nodes) {
      node.metrics.loc = (ranks.get(node.id) ?? 0) * nodes.length;
    }
  }
  return { nodes, edges };
}
