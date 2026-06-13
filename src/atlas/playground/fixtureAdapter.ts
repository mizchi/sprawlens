import type {
  AtlasEdge,
  AtlasGraph,
  AtlasNode,
  SymbolKind,
} from "../contracts/graph.js";

const SYMBOL_KINDS: ReadonlySet<string> = new Set([
  "function",
  "class",
  "variable",
  "type",
  "interface",
  "enum",
]);
function isSymbolKind(kind: string | undefined): kind is SymbolKind {
  return kind !== undefined && SYMBOL_KINDS.has(kind);
}

/**
 * Minimal structural view of a `.codesprawl` snapshot JSON. Deliberately
 * re-declared here (not imported from src/core) so atlas stays decoupled
 * from the legacy pipeline; only the data shape is shared.
 */
export type SnapshotSymbolLike = {
  complexity?: number;
  id: string;
  name: string;
  kind: string;
  loc: number;
  exported?: boolean;
};

export type SnapshotNodeLike = {
  id: string;
  type: string;
  path?: string;
  loc?: number;
  symbols?: SnapshotSymbolLike[];
};

export type SnapshotEdgeLike = {
  type: string;
  from: string;
  to: string;
  resolved?: boolean;
  /** Symbol-level import targets; the using symbol is unknown statically. */
  symbolImports?: { toSymbolId: string }[];
};

export type SnapshotLike = {
  nodes: SnapshotNodeLike[];
  edges: SnapshotEdgeLike[];
};

function baseName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

export function snapshotToAtlasGraph(snapshot: SnapshotLike): AtlasGraph {
  const pathByNodeId = new Map<string, string>();
  const nodes: AtlasNode[] = [];
  for (const node of snapshot.nodes) {
    if (node.type !== "file" || !node.path) continue;
    pathByNodeId.set(node.id, node.path);
    const complexity = (node.symbols ?? []).reduce(
      (sum, s) => sum + (s.complexity ?? 0),
      0,
    );
    nodes.push({
      id: node.path,
      kind: "file",
      label: baseName(node.path),
      metrics: {
        loc: Math.max(node.loc ?? 0, 1),
        ...(complexity > 0 ? { complexity } : {}),
      },
    });
  }
  // imported symbol id → its name, so edges can carry reference labels
  const symbolName = new Map<string, string>();
  for (const node of snapshot.nodes) {
    for (const symbol of node.symbols ?? []) symbolName.set(symbol.id, symbol.name);
  }

  // accumulate refs per file-pair: one pair can appear across several import
  // edges, and each edge names the symbols it pulled from the target
  const refsByPair = new Map<string, Set<string>>();
  const order: { source: string; target: string; key: string }[] = [];
  for (const edge of snapshot.edges) {
    if (edge.type !== "imports" || edge.resolved !== true) continue;
    const source = pathByNodeId.get(edge.from);
    const target = pathByNodeId.get(edge.to);
    if (!source || !target) continue;
    const key = `${source}->${target}`;
    let refs = refsByPair.get(key);
    if (!refs) {
      refs = new Set();
      refsByPair.set(key, refs);
      order.push({ source, target, key });
    }
    for (const symbolImport of edge.symbolImports ?? []) {
      const name = symbolName.get(symbolImport.toSymbolId);
      if (name) refs.add(name);
    }
  }
  const edges: AtlasGraph["edges"] = order.map(({ source, target, key }) => {
    const refs = refsByPair.get(key)!;
    return refs.size > 0
      ? { source, target, refs: [...refs] }
      : { source, target };
  });
  return { nodes, edges };
}

/**
 * Symbol-reference edges from static imports: the importing *file* points at
 * the imported *symbol* (the using symbol is not known statically — the LSP
 * provider upgrades these to symbol→symbol call-hierarchy edges later).
 */
export function snapshotSymbolEdges(snapshot: SnapshotLike): AtlasEdge[] {
  const pathByNodeId = new Map<string, string>();
  for (const node of snapshot.nodes) {
    if (node.type === "file" && node.path) pathByNodeId.set(node.id, node.path);
  }
  const edges: AtlasEdge[] = [];
  const seen = new Set<string>();
  for (const edge of snapshot.edges) {
    if (edge.type !== "imports" || edge.resolved !== true) continue;
    const source = pathByNodeId.get(edge.from);
    if (!source) continue;
    for (const symbolImport of edge.symbolImports ?? []) {
      const key = `${source}->${symbolImport.toSymbolId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source, target: symbolImport.toSymbolId });
    }
  }
  return edges;
}

/**
 * Real symbols per file for the nested layout. Symbol LOC rarely covers the
 * whole file (imports, module-level statements), so the remainder is added
 * as an unnamed filler node to keep the nested areas proportional to LOC.
 */
export function snapshotSymbols(
  snapshot: SnapshotLike,
): Map<string, AtlasNode[]> {
  const result = new Map<string, AtlasNode[]>();
  for (const node of snapshot.nodes) {
    if (node.type !== "file" || !node.path) continue;
    const fileLoc = Math.max(node.loc ?? 0, 1);
    const symbols: AtlasNode[] = (node.symbols ?? []).map((symbol) => ({
      id: symbol.id,
      kind: "symbol",
      label: symbol.name,
      metrics: {
        loc: Math.max(symbol.loc, 1),
        ...(symbol.complexity !== undefined
          ? { complexity: symbol.complexity }
          : {}),
      },
      exported: symbol.exported === true,
      ...(isSymbolKind(symbol.kind) ? { symbolKind: symbol.kind } : {}),
    }));
    const covered = symbols.reduce((sum, s) => sum + s.metrics.loc, 0);
    const remainder = fileLoc - covered;
    if (symbols.length === 0 || remainder > 0) {
      // "#rest" suffix marks the filler; renderers suppress its label
      symbols.push({
        id: `${node.path}#rest`,
        kind: "symbol",
        label: "(module scope)",
        metrics: { loc: Math.max(remainder, symbols.length === 0 ? fileLoc : 1) },
      });
    }
    result.set(node.path, symbols);
  }
  return result;
}
