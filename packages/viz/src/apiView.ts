import type { AtlasEdge, AtlasGraph, AtlasNode } from "@sprawlens/schema";
import { parentFileOf } from "@sprawlens/schema";
import { defaultModuleIdOf } from "@sprawlens/schema";
import { transitiveWeights } from "@sprawlens/layout";
import { complexityOf } from "./viewConfig.js";

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
      edges: api.edges.filter((e) => !boundaryIds.has(e.source) && !boundaryIds.has(e.target)),
    },
    boundaryByModule,
  };
}

export type ApiGraphOptions = {
  /** Keep non-exported symbols too (the full symbol network). */
  includePrivate?: boolean;
  /** Force-keep specific (otherwise private) symbols — e.g. changed ones, so
   * the diff shows at symbol granularity even with private symbols hidden. */
  keep?: (symbolId: string) => boolean;
  /** Area scoring; defaults to transitive complexity over the network. */
  weight?: "complexity" | "loc";
};

/**
 * Filler node id holding a group's budgeted-out symbols' total area. The id is
 * a synthetic path *under* the group key (`${key}/(scope)`) so every boundary
 * (module, directory, ...) re-groups it back into that exact key via the same
 * path heuristic — a bare `key#scope` would mis-bucket a container module id
 * (`src/atlas`) up into its parent and collapse the directory layout.
 */
export function moduleScopeId(groupKey: string): string {
  return `${groupKey}/(scope)`;
}

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
    const shown = options.includePrivate
      ? symbols
      : symbols.filter((s) => s.exported === true || options.keep?.(s.id));
    for (const symbol of shown) {
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
    const source = nodeIds.has(edge.source) ? edge.source : (soleExportOf.get(edge.source) ?? null);
    if (!source || !nodeIds.has(edge.target) || source === edge.target) continue;
    const key = `${source}->${edge.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ source, target: edge.target });
  }

  // area = transitive complexity: a symbol grows with the total
  // complexity it pulls in through the projected network
  if (options.weight !== "loc") {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const weights = transitiveWeights(
      nodes.map((n) => n.id),
      edges,
      (id) => complexityOf(byId.get(id)!),
    );
    for (const node of nodes) {
      node.metrics.loc = weights.get(node.id) ?? node.metrics.loc;
    }
  }
  return { nodes, edges };
}

export type SymbolBudget = {
  /** Lay out at most this many symbol cells. */
  budget: number;
  /** Ranks symbols (higher = keep); gets the id and its area weight. */
  priorityOf?: (id: string, weight: number) => number;
  /** Files that must keep at least one cell regardless of priority — e.g.
   * those a cross-layer edge points at, so they surface to be highlighted and
   * linked even when the budget would otherwise fold them. */
  ensure?: { files: ReadonlySet<string>; fileOf: (id: string) => string };
  /** Group a folded symbol belongs to; its dropped area pools into one filler
   * per group. Defaults to the module, but with a directory boundary active the
   * caller passes the directory so each directory keeps its own scope filler —
   * otherwise the per-module filler becomes one giant directory that swamps the
   * real ones. */
  fillerKeyOf?: (id: string) => string;
  /** Drop the folded "(module scope)" fillers entirely instead of pooling the
   * dropped area: cells then size by the kept symbols alone. */
  dropFolded?: boolean;
};

/**
 * Budget LOD over a built api graph: keep the top-priority symbols, fold
 * the rest into one "(module scope)" filler per module so each district's
 * dropped area is preserved without thousands of sub-pixel leaves. Pure
 * and cheap (sort + filter) — the expensive weight computation stays in
 * {@link buildApiGraph}, so re-budgeting as the focus moves is fast.
 */
export function applySymbolBudget(
  graph: AtlasGraph,
  {
    budget,
    priorityOf = (_, w) => w,
    ensure,
    fillerKeyOf = apiModuleIdOf,
    dropFolded = false,
  }: SymbolBudget,
): AtlasGraph {
  if (graph.nodes.length <= budget) return graph;
  const ranked = graph.nodes
    .map((node) => ({ node, score: priorityOf(node.id, node.metrics.loc) }))
    .sort((a, b) => b.score - a.score);
  const kept = ranked.slice(0, budget).map((r) => r.node);
  const keptIds = new Set(kept.map((n) => n.id));
  // promote the best-ranked symbol of any ensured file that the budget missed,
  // so each cross-layer-referenced file keeps a cell to anchor its edge + glow
  if (ensure && ensure.files.size > 0) {
    const have = new Set<string>();
    for (const n of kept) have.add(ensure.fileOf(n.id));
    for (const { node } of ranked) {
      if (keptIds.has(node.id)) continue;
      const file = ensure.fileOf(node.id);
      if (!ensure.files.has(file) || have.has(file)) continue;
      have.add(file);
      kept.push(node);
      keptIds.add(node.id);
    }
  }
  const fillerLoc = new Map<string, number>();
  if (!dropFolded) {
    for (const { node } of ranked.slice(budget)) {
      if (keptIds.has(node.id)) continue; // ensure-promoted: not folded
      const key = fillerKeyOf(node.id);
      fillerLoc.set(key, (fillerLoc.get(key) ?? 0) + node.metrics.loc);
    }
  }
  const fillers: AtlasNode[] = [...fillerLoc].map(([key, loc]) => ({
    id: moduleScopeId(key),
    kind: "symbol",
    label: "(module scope)",
    metrics: { loc },
    exported: false,
  }));
  return {
    nodes: [...kept, ...fillers],
    edges: graph.edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target)),
  };
}
