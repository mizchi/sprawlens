import type { CodeSymbol, CodeSymbolKind } from "@sprawlens/schema";

/**
 * Precise top-level symbol extraction via the real MoonBit parser
 * (vendored as a compiled-to-JS bundle). The parser returns the AST as JSON
 * with source locations; this walks the top-level `Impl` nodes into the
 * neutral CodeSymbol shape. Returns null when the parser is unavailable or
 * throws, so the caller can fall back to the regex heuristic.
 */

type ExtractFn = (source: string) => string;
let extractFn: ExtractFn | null = null;
let loadFailed = false;

// `../vendor` resolves in the workspace (from analyzer-moonbit's src or dist);
// `./vendor` resolves when this module is bundled into the CLI (the build
// copies the parser next to dist/index.js). Tried in order.
const VENDOR_CANDIDATES = ["../vendor/moonbit-parser.js", "./vendor/moonbit-parser.js"];

/** Lazily load the vendored parser bundle (≈900 KB) once. */
async function loadExtract(): Promise<ExtractFn | null> {
  if (extractFn) return extractFn;
  if (loadFailed) return null;
  for (const candidate of VENDOR_CANDIDATES) {
    try {
      const url = new URL(candidate, import.meta.url);
      const mod = (await import(url.href)) as { extract?: ExtractFn };
      if (typeof mod.extract === "function") {
        extractFn = mod.extract;
        return extractFn;
      }
    } catch {
      // try the next candidate location
    }
  }
  loadFailed = true;
  return null;
}

type Loc = { start: { line: number }; end: { line: number } };
type Vis = { type?: string };
type Impl = Record<string, unknown> & { type?: string; loc?: Loc };

/** `Visibility::Pub*` (Pub, PubAll, ...) marks exported; Default/Priv do not. */
function isExported(vis: Vis | undefined): boolean {
  return typeof vis?.type === "string" && vis.type.startsWith("Visibility::Pub");
}

/** MoonBit TypeDesc → neutral symbol kind. */
const TYPE_KIND: Record<string, CodeSymbolKind> = {
  "TypeDesc::Record": "class",
  "TypeDesc::Variant": "enum",
  "TypeDesc::ErrorEnum": "enum",
};

function makeSymbol(
  file: string,
  kind: CodeSymbolKind,
  name: string,
  loc: Loc | undefined,
  exported: boolean,
  parentClass?: string,
): CodeSymbol | null {
  if (!name || !loc) return null;
  const startLine = loc.start.line;
  const endLine = loc.end.line;
  return {
    id: `symbol:${file}:${kind}:${parentClass ? `${parentClass}.${name}` : name}:${startLine}`,
    kind,
    name,
    startLine,
    endLine,
    loc: Math.max(endLine - startLine + 1, 1),
    complexity: 1,
    exported,
    ...(parentClass ? { parentClass } : {}),
  };
}

/** Map one top-level `Impl` AST node to a symbol (or null to skip it). */
function symbolOfImpl(impl: Impl, file: string): CodeSymbol | null {
  switch (impl.type) {
    case "Impl::TopFuncDef": {
      const f = impl.fun_decl as
        | {
            name?: { name?: string };
            vis?: Vis;
            type_name?: { name?: Record<string, string> } | null;
          }
        | undefined;
      const name = f?.name?.name;
      if (!name) return null;
      // a method is `fn T::m(...)`: type_name carries the receiver type T
      const parent = f?.type_name?.name?.["0"];
      return makeSymbol(
        file,
        parent ? "method" : "function",
        name,
        impl.loc,
        isExported(f?.vis),
        parent,
      );
    }
    case "Impl::TopTypeDef": {
      const d = impl["0"] as
        | { tycon?: string; components?: { type?: string }; type_vis?: Vis; loc?: Loc }
        | undefined;
      const name = d?.tycon;
      if (!name) return null;
      const kind = TYPE_KIND[d?.components?.type ?? ""] ?? "type";
      return makeSymbol(file, kind, name, d?.loc, isExported(d?.type_vis));
    }
    case "Impl::TopTrait": {
      const d = impl["0"] as { name?: { name?: string }; vis?: Vis; loc?: Loc } | undefined;
      const name = d?.name?.name;
      if (!name) return null;
      return makeSymbol(file, "interface", name, d?.loc, isExported(d?.vis));
    }
    case "Impl::TopLetDef": {
      const binder = impl.binder as { name?: string } | undefined;
      const name = binder?.name;
      if (!name) return null;
      return makeSymbol(file, "variable", name, impl.loc, isExported(impl.vis as Vis));
    }
    default:
      return null; // TopExpr / TopTest / TopImpl / TopUsing / ... carry no symbol
  }
}

/**
 * Parse `source` and return its top-level symbols, or null if the parser
 * could not be loaded or threw (the caller falls back to the regex extractor).
 */
export async function extractMoonbitSymbols(
  source: string,
  file: string,
): Promise<CodeSymbol[] | null> {
  const extract = await loadExtract();
  if (!extract) return null;
  try {
    const ast = JSON.parse(extract(source)) as Impl[];
    if (!Array.isArray(ast)) return null;
    const symbols: CodeSymbol[] = [];
    for (const impl of ast) {
      const symbol = symbolOfImpl(impl, file);
      if (symbol) symbols.push(symbol);
    }
    return symbols;
  } catch {
    return null;
  }
}
