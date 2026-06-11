import type { AtlasEdge, AtlasGraph, AtlasNode } from "../contracts/graph.js";
import { defaultModuleIdOf } from "../contracts/modules.js";
import { pageRank } from "../kernel/pagerank.js";

/**
 * Public-API network projection: file scope is dropped, every exported
 * symbol becomes a node and only the dependency network among public
 * symbols remains. Cell areas follow PageRank over that network — the
 * most-depended-upon API surfaces grow — and positions come from graph
 * proximity (force layout).
 */

/** Parent file of a symbol id (`symbol:<path>:...` or `<path>#sN`). */
function parentFileOf(symbolId: string): string {
  if (symbolId.startsWith("symbol:")) {
    return symbolId.split(":")[1] ?? symbolId;
  }
  const hash = symbolId.indexOf("#");
  return hash >= 0 ? symbolId.slice(0, hash) : symbolId;
}

/** Module of a symbol = module of its parent file. */
export function apiModuleIdOf(symbolId: string): string {
  return defaultModuleIdOf(parentFileOf(symbolId));
}

export function buildApiGraph(
  fileGraph: AtlasGraph,
  symbolsOf: (fileId: string) => AtlasNode[],
  symbolEdges: readonly AtlasEdge[],
): AtlasGraph {
  const nodes: AtlasNode[] = [];
  const nodeIds = new Set<string>();
  /** file id → its single exported symbol, when unambiguous. */
  const soleExportOf = new Map<string, string | null>();
  for (const file of fileGraph.nodes) {
    const exported = symbolsOf(file.id).filter((s) => s.exported === true);
    soleExportOf.set(file.id, exported.length === 1 ? exported[0]!.id : null);
    for (const symbol of exported) {
      nodes.push({
        id: symbol.id,
        kind: "symbol",
        label: symbol.label,
        metrics: { loc: 1 }, // replaced by the PageRank weight below
        exported: true,
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
  const ranks = pageRank(
    nodes.map((n) => n.id),
    edges,
  );
  for (const node of nodes) {
    node.metrics.loc = (ranks.get(node.id) ?? 0) * nodes.length;
  }
  return { nodes, edges };
}
