import type { AtlasEdge, AtlasNode } from "../contracts/graph.js";

/** Repo-relative symbol reference returned by the atlas server. */
export type SymbolRef = { file: string; name: string; line: number };

export type CallHierarchyResponse = {
  incoming: SymbolRef[];
  outgoing: SymbolRef[];
};

/** Start line embedded in snapshot symbol ids: symbol:<path>:<kind>:<name>:<line>. */
function startLineOf(symbolId: string): number | null {
  const line = Number(symbolId.slice(symbolId.lastIndexOf(":") + 1));
  return Number.isFinite(line) ? line : null;
}

/**
 * Maps an LSP reference to a known atlas node id: line containment first
 * (methods resolve to their class symbol), then name match, then the file.
 */
export function resolveRef(
  ref: SymbolRef,
  symbolsByFile: Map<string, AtlasNode[]>,
  fileIds: Set<string>,
): string | null {
  const symbols = symbolsByFile.get(ref.file);
  if (symbols) {
    for (const symbol of symbols) {
      const start = startLineOf(symbol.id);
      if (start === null) continue;
      if (ref.line >= start && ref.line < start + symbol.metrics.loc) {
        return symbol.id;
      }
    }
    const byName = symbols.find((s) => s.label === ref.name);
    if (byName) return byName.id;
  }
  return fileIds.has(ref.file) ? ref.file : null;
}

/** Converts a call-hierarchy response into direction-correct atlas edges. */
export function refsToEdges(
  symbolId: string,
  response: CallHierarchyResponse,
  symbolsByFile: Map<string, AtlasNode[]>,
  fileIds: Set<string>,
): AtlasEdge[] {
  const edges: AtlasEdge[] = [];
  for (const ref of response.incoming) {
    const id = resolveRef(ref, symbolsByFile, fileIds);
    if (id && id !== symbolId) edges.push({ source: id, target: symbolId });
  }
  for (const ref of response.outgoing) {
    const id = resolveRef(ref, symbolsByFile, fileIds);
    if (id && id !== symbolId) edges.push({ source: symbolId, target: id });
  }
  return edges;
}

export async function fetchCallHierarchy(
  repo: string,
  file: string,
  symbol: string,
): Promise<CallHierarchyResponse> {
  const response = await fetch("/api/call-hierarchy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repo, file, symbol }),
  });
  if (!response.ok) throw new Error(`call-hierarchy: ${response.status}`);
  return (await response.json()) as CallHierarchyResponse;
}
