import type { FocusView } from "./useMapViewport.ts";

type ChangeKind = "added" | "modified";

export type ChangedPreviewInput = {
  changedFiles: ReadonlyMap<string, ChangeKind>;
  changedSymbols: ReadonlyMap<string, ChangeKind>;
  diffStats?: ReadonlyMap<string, unknown>;
  moduleOfId: (id: string) => string;
  parentFileOf: (id: string) => string;
  symbolsByFile?: ReadonlyMap<string, readonly { id: string }[]> | null;
};

export function buildChangedPreviewFocus(input: ChangedPreviewInput): FocusView | null {
  const fileIds = new Set<string>(input.changedFiles.keys());
  const exactSymbolIds = new Set(input.changedSymbols.keys());
  for (const id of input.diffStats?.keys() ?? []) {
    if (id.startsWith("symbol:")) exactSymbolIds.add(id);
  }
  for (const id of exactSymbolIds) fileIds.add(input.parentFileOf(id));
  if (fileIds.size === 0 && exactSymbolIds.size === 0) return null;

  const symbolIds = new Set(exactSymbolIds);
  for (const fileId of fileIds) {
    const hasExactInFile = [...exactSymbolIds].some((id) => input.parentFileOf(id) === fileId);
    if (hasExactInFile) continue;
    for (const symbol of input.symbolsByFile?.get(fileId) ?? []) symbolIds.add(symbol.id);
  }

  const moduleIds = new Set<string>();
  for (const fileId of fileIds) moduleIds.add(input.moduleOfId(fileId));
  for (const symbolId of symbolIds) moduleIds.add(input.moduleOfId(input.parentFileOf(symbolId)));

  return {
    level: symbolIds.size > 0 ? "symbol" : "file",
    moduleIds,
    fileIds,
    symbolIds,
    downstreamEdges: [],
    upstreamEdges: [],
  };
}
