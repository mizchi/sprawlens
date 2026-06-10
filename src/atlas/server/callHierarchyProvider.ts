import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LspClient } from "./lspClient.js";

/** Repo-relative reference to a symbol; lines are 1-based. */
export type SymbolRef = { file: string; name: string; line: number };

export type CallHierarchyResult = {
  incoming: SymbolRef[];
  outgoing: SymbolRef[];
};

type LspRange = { start: { line: number; character: number } };
type DocumentSymbol = {
  name: string;
  selectionRange: LspRange;
  children?: DocumentSymbol[];
};
type CallHierarchyItem = {
  name: string;
  uri: string;
  selectionRange: LspRange;
};

function findSymbol(
  symbols: DocumentSymbol[],
  name: string,
): DocumentSymbol | null {
  for (const symbol of symbols) {
    if (symbol.name === name) return symbol;
    const child = symbol.children && findSymbol(symbol.children, name);
    if (child) return child;
  }
  return null;
}

function toRef(rootDir: string, item: CallHierarchyItem): SymbolRef {
  const absolute = fileURLToPath(item.uri);
  const root = resolve(rootDir);
  const file = absolute.startsWith(root + "/")
    ? absolute.slice(root.length + 1)
    : absolute;
  return { file, name: item.name, line: item.selectionRange.start.line + 1 };
}

/**
 * Resolve a symbol by name in a file and walk one level of the call
 * hierarchy in both directions. The project loads lazily after didOpen, so
 * documentSymbol is retried briefly before giving up.
 */
export async function callHierarchy(
  client: LspClient,
  rootDir: string,
  relativeFile: string,
  symbolName: string,
): Promise<CallHierarchyResult> {
  const absolute = resolve(rootDir, relativeFile);
  client.openDocument(absolute);
  const uri = pathToFileURL(absolute).href;

  let symbols: DocumentSymbol[] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    symbols =
      (await client.request<DocumentSymbol[] | null>(
        "textDocument/documentSymbol",
        { textDocument: { uri } },
      )) ?? [];
    if (symbols.length > 0) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const symbol = findSymbol(symbols, symbolName);
  if (!symbol) return { incoming: [], outgoing: [] };

  const items = await client.request<CallHierarchyItem[] | null>(
    "textDocument/prepareCallHierarchy",
    { textDocument: { uri }, position: symbol.selectionRange.start },
  );
  const item = items?.[0];
  if (!item) return { incoming: [], outgoing: [] };

  const [incoming, outgoing] = await Promise.all([
    client.request<{ from: CallHierarchyItem }[] | null>(
      "callHierarchy/incomingCalls",
      { item },
    ),
    client.request<{ to: CallHierarchyItem }[] | null>(
      "callHierarchy/outgoingCalls",
      { item },
    ),
  ]);
  return {
    incoming: (incoming ?? []).map((call) => toRef(rootDir, call.from)),
    outgoing: (outgoing ?? []).map((call) => toRef(rootDir, call.to)),
  };
}
