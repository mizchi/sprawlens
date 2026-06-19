/**
 * Tiny, dependency-free syntax highlighter for the hover tooltip. LSP hover
 * payloads are short code snippets (a signature, a type) in a fenced markdown
 * block; pulling in shiki/highlight.js for that is out of proportion. This
 * tokenizes well enough to colour a signature across the languages sprawlens
 * supports (a shared keyword/primitive set — highlighting, not parsing).
 */

export type TokenKind =
  | "comment"
  | "string"
  | "keyword"
  | "type"
  | "number"
  | "punct"
  | "plain";

export type Token = { kind: TokenKind; text: string };

/** Keywords across Rust / TS / Go / MoonBit — a superset is fine for colour. */
const KEYWORDS: ReadonlySet<string> = new Set([
  "pub", "fn", "let", "const", "mut", "struct", "enum", "trait", "impl", "use",
  "mod", "return", "if", "else", "match", "for", "while", "loop", "break",
  "continue", "type", "interface", "class", "function", "export", "import",
  "from", "as", "async", "await", "new", "self", "super", "where", "dyn",
  "ref", "move", "static", "yield", "default", "extends", "implements",
  "public", "private", "protected", "readonly", "namespace", "package", "func",
  "var", "go", "defer", "chan", "map", "range", "select", "case", "switch",
  "typealias", "derive", "in", "of", "extern", "unsafe", "crate", "test",
]);

/** Built-in primitive type names that aren't PascalCase but read as types. */
const PRIMITIVES: ReadonlySet<string> = new Set([
  "str", "bool", "char", "usize", "isize",
  "i8", "i16", "i32", "i64", "i128", "u8", "u16", "u32", "u64", "u128",
  "f32", "f64", "int", "uint", "float", "double", "byte", "rune",
  "string", "number", "boolean", "void", "any", "unknown", "never", "object",
]);

const WORD_START = /[A-Za-z_]/;
const WORD_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
const NUM_PART = /[0-9_.a-fA-FxXoObB]/;
const WS = /\s/;
/** A char that can't open a comment and isn't word/number/space/quote. */
const PUNCT_BOUNDARY = /[A-Za-z0-9_\s"'`]/;

/** Split source into coloured tokens; the texts rejoin exactly to the input. */
export function tokenizeCode(code: string): Token[] {
  const tokens: Token[] = [];
  const push = (kind: TokenKind, text: string): void => {
    if (text) tokens.push({ kind, text });
  };
  const n = code.length;
  let i = 0;
  while (i < n) {
    const c = code[i]!;
    // line comment
    if (c === "/" && code[i + 1] === "/") {
      let j = i + 2;
      while (j < n && code[j] !== "\n") j++;
      push("comment", code.slice(i, j));
      i = j;
      continue;
    }
    // block comment
    if (c === "/" && code[i + 1] === "*") {
      let j = i + 2;
      while (j < n && !(code[j] === "*" && code[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      push("comment", code.slice(i, j));
      i = j;
      continue;
    }
    // string (unterminated stops at end of line)
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && code[j] !== c && code[j] !== "\n") {
        if (code[j] === "\\") j++;
        j++;
      }
      if (j < n && code[j] === c) j++;
      push("string", code.slice(i, j));
      i = j;
      continue;
    }
    // number
    if (DIGIT.test(c)) {
      let j = i + 1;
      while (j < n && NUM_PART.test(code[j]!)) j++;
      push("number", code.slice(i, j));
      i = j;
      continue;
    }
    // identifier / keyword / type
    if (WORD_START.test(c)) {
      let j = i + 1;
      while (j < n && WORD_PART.test(code[j]!)) j++;
      const word = code.slice(i, j);
      const kind: TokenKind = KEYWORDS.has(word)
        ? "keyword"
        : PRIMITIVES.has(word) || /^[A-Z]/.test(word)
          ? "type"
          : "plain";
      push(kind, word);
      i = j;
      continue;
    }
    // whitespace — kept as plain so the token stream rejoins to the input
    if (WS.test(c)) {
      let j = i + 1;
      while (j < n && WS.test(code[j]!)) j++;
      push("plain", code.slice(i, j));
      i = j;
      continue;
    }
    // punctuation run (never swallow the start of a comment)
    let j = i + 1;
    while (
      j < n &&
      !PUNCT_BOUNDARY.test(code[j]!) &&
      !(code[j] === "/" && (code[j + 1] === "/" || code[j + 1] === "*"))
    ) {
      j++;
    }
    push("punct", code.slice(i, j));
    i = j;
  }
  return tokens;
}

export type HoverBlock =
  | { type: "code"; lang: string; text: string }
  | { type: "text"; text: string };

const FENCE_OPEN = /^```(\w*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;

/**
 * Strip the common leading whitespace from a block (and surrounding blank
 * lines), keeping relative indentation. An LSP hover returns a symbol's
 * signature with its source indentation, so a deeply-nested symbol's snippet
 * is pushed right; a plain `.trim()` only flushes the first line and skews the
 * rest. Dedent makes the snippet read the same regardless of nesting depth.
 */
function dedent(text: string): string {
  const lines = text.split("\n");
  while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  let min = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    min = Math.min(min, line.length - line.trimStart().length);
  }
  if (!Number.isFinite(min) || min === 0) return lines.join("\n");
  return lines.map((line) => line.slice(min)).join("\n");
}

/**
 * Split an LSP hover markdown string into fenced code blocks (carrying their
 * declared language) and the prose between them. Prose is trimmed and empty
 * runs are dropped, so a lone signature yields one code block.
 */
export function parseHoverMarkdown(markdown: string): HoverBlock[] {
  const lines = markdown.split("\n");
  const blocks: HoverBlock[] = [];
  let prose: string[] = [];
  const flushProse = (): void => {
    const text = prose.join("\n").trim();
    if (text) blocks.push({ type: "text", text });
    prose = [];
  };
  let i = 0;
  while (i < lines.length) {
    const open = lines[i]!.match(FENCE_OPEN);
    if (open) {
      flushProse();
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE_CLOSE.test(lines[i]!)) {
        body.push(lines[i]!);
        i++;
      }
      i++; // skip the closing fence
      blocks.push({ type: "code", lang: open[1] ?? "", text: dedent(body.join("\n")) });
    } else {
      prose.push(lines[i]!);
      i++;
    }
  }
  flushProse();
  return blocks;
}

/** Token colours for the hover tooltip, per theme. */
export const HIGHLIGHT_THEME: Record<"light" | "dark", Record<TokenKind, string>> = {
  light: {
    comment: "#6b7280",
    string: "#0a7d3c",
    keyword: "#9333ea",
    type: "#b45309",
    number: "#0369a1",
    punct: "#64748b",
    plain: "#1f2937",
  },
  dark: {
    comment: "#7d8590",
    string: "#7ee787",
    keyword: "#d2a8ff",
    type: "#ffa657",
    number: "#79c0ff",
    punct: "#8b949e",
    plain: "#e6edf3",
  },
};
