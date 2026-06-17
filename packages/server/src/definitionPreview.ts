import { readFile } from "node:fs/promises";
import { join } from "node:path";

const LANG_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  rs: "rust",
  go: "go",
  mbt: "moonbit",
  py: "python",
};
function langOf(file: string): string {
  return LANG_BY_EXT[file.split(".").pop() ?? ""] ?? "";
}

// a line that belongs to the declaration's preamble: doc/line/block comments,
// Rust attributes (#[...], #![...]) and TS/decorator `@…` lines
const PREAMBLE_LINE = /^(\/\/|\/\*|\*|@|#!?\[)/;

/**
 * Language-neutral "definition preview": a symbol's leading doc comment /
 * attributes plus its signature (up to the body's opening brace, or a
 * statement terminator), read straight from the source. This is the fallback
 * for languages with no LSP hover provider — tree-sitter analyzers already pin
 * every symbol's start line, so the declaration can be shown without an LSP.
 */
export async function definitionPreview(
  repoRoot: string,
  file: string,
  line: number,
): Promise<{ markdown: string } | null> {
  let text: string;
  try {
    text = await readFile(join(repoRoot, file), "utf8");
  } catch {
    return null;
  }
  const lines = text.split("\n");
  const i = line - 1; // the declaration's first line, 0-based
  if (i < 0 || i >= lines.length) return null;

  // leading doc comment + attributes/decorators directly above the declaration
  let start = i;
  for (let j = i - 1; j >= 0 && j >= i - 20; j--) {
    if (PREAMBLE_LINE.test(lines[j]!.trim())) start = j;
    else break;
  }

  // signature: the declaration up to (and including) its body opener, capped so
  // a giant function body never lands in the tooltip
  const sig: string[] = [];
  for (let j = i; j < lines.length && j < i + 12; j++) {
    const raw = lines[j]!;
    const brace = raw.indexOf("{");
    if (brace >= 0) {
      sig.push(raw.slice(0, brace + 1));
      break;
    }
    sig.push(raw);
    if (/;\s*$/.test(raw)) break; // const / type alias / signature-only
  }

  const snippet = [...lines.slice(start, i), ...sig].join("\n").replace(/\s+$/, "");
  if (!snippet.trim()) return null;
  return { markdown: "```" + langOf(file) + "\n" + snippet + "\n```" };
}
