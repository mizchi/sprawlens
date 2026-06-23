import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { HoverInfo } from "@sprawlens/schema";
import type { LspClient } from "./lspClient.ts";
import { type DocumentSymbol, findSymbol, namePosition } from "./symbolPosition.ts";

/** LSP hover contents: MarkupContent, a MarkedString, or an array of them. */
type MarkedString = string | { language: string; value: string };
type HoverResult = {
  contents: { kind: string; value: string } | MarkedString | MarkedString[];
} | null;

/** Flatten the several hover-content shapes into one markdown string. */
function flatten(contents: NonNullable<HoverResult>["contents"]): string {
  const one = (c: MarkedString): string =>
    typeof c === "string" ? c : "```" + c.language + "\n" + c.value + "\n```";
  if (Array.isArray(contents)) return contents.map(one).join("\n\n").trim();
  if (typeof contents === "object" && "kind" in contents) {
    return contents.value.trim(); // MarkupContent (markdown or plaintext)
  }
  return one(contents).trim();
}

/**
 * LSP hover for a symbol: resolve its declaration position via documentSymbol
 * (the project loads lazily after didOpen, so it's retried briefly), then ask
 * the server for hover there. Returns null when the symbol or hover is absent.
 */
export async function hover(
  client: LspClient,
  rootDir: string,
  relativeFile: string,
  symbolName: string,
  languageId: string,
): Promise<HoverInfo | null> {
  const absolute = resolve(rootDir, relativeFile);
  client.openDocument(absolute, languageId);
  const uri = pathToFileURL(absolute).href;

  let symbols: DocumentSymbol[] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    symbols =
      (await client.request<DocumentSymbol[] | null>("textDocument/documentSymbol", {
        textDocument: { uri },
      })) ?? [];
    if (symbols.length > 0) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const symbol = findSymbol(symbols, symbolName);
  if (!symbol) return null;

  const result = await client.request<HoverResult>("textDocument/hover", {
    textDocument: { uri },
    position: namePosition(absolute, symbol),
  });
  if (!result || !result.contents) return null;
  const markdown = flatten(result.contents);
  return markdown ? { markdown } : null;
}
