import { readFileSync } from "node:fs";

export type LspPosition = { line: number; character: number };
export type DocumentSymbol = {
  name: string;
  selectionRange: { start: LspPosition };
  children?: DocumentSymbol[];
};

/** Depth-first search for a symbol by exact name. */
export function findSymbol(symbols: DocumentSymbol[], name: string): DocumentSymbol | null {
  for (const symbol of symbols) {
    if (symbol.name === name) return symbol;
    const child = symbol.children && findSymbol(symbol.children, name);
    if (child) return child;
  }
  return null;
}

/**
 * The position of the symbol's *name* identifier. Servers disagree on what
 * `selectionRange` points at: typescript-language-server and rust-analyzer put
 * it on the identifier, but moonbit-lsp puts it at the declaration start (the
 * `pub`/`fn` keyword), where hover and prepareCallHierarchy resolve nothing. So
 * we locate the name within its start line and use that column, falling back to
 * the reported position when the name can't be found.
 */
export function namePosition(absolutePath: string, symbol: DocumentSymbol): LspPosition {
  const start = symbol.selectionRange.start;
  try {
    const line = readFileSync(absolutePath, "utf8").split("\n")[start.line];
    const column = line?.indexOf(symbol.name, start.character) ?? -1;
    if (column >= 0) return { line: start.line, character: column };
  } catch {
    // unreadable — use the position the server reported
  }
  return start;
}
