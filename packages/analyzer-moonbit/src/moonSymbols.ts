import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { CodeSymbol, CodeSymbolKind } from "@sprawlens/schema";

const execFileAsync = promisify(execFile);

/**
 * Compiler-aware symbol extraction via `moon ide gen-symbols`. Run once at the
 * repo root, it writes a workspace-wide `symbols.jsonl` (every own package +
 * dependencies) in a single spawn — ~5x faster than parsing each file with the
 * vendored bundle, and precise (kind + visibility + body span from the MoonBit
 * compiler). Requires the IDE build artifacts (`_build/.ide/packages.json`);
 * when they're absent (repo not built) or the `moon` CLI is missing, returns
 * null so the caller falls back to the vendored-parser / regex extractor.
 */

type GenSym = {
  kind: string[]; // ["Sym", name] | ["SymChild", type, name] | ["TraitImpl", trait, method, type]
  path: string; // repo-relative
  tag: string; // hex; encodes MoonBit kind + visibility (low bit = pub)
  range: [number, number, number, number]; // [startLine, startCol, endLine, endCol], 1-based
};

type ParsedGenSym = {
  kind: CodeSymbolKind;
  name: string;
  exported: boolean;
  parentClass?: string;
};

// dependency / build dirs whose symbols are not the repo's own code
const FOREIGN_PREFIXES = [".mooncakes", ".mool", "target", "_build"];

/**
 * Map a gen-symbols entry to a neutral kind, matching the granularity the
 * vendored parser produced: top-level decls and methods become symbols; enum
 * variants, trait-impl methods and test blocks are not separate symbols.
 */
function kindOf(kind: string[], tag: number): CodeSymbolKind | null {
  const head = kind[0];
  if (head === "TraitImpl") return null; // trait-impl methods aren't standalone symbols here
  if (head === "SymChild") {
    if ((tag & 0xf0) === 0xd0) return null; // enum variant, not a separate symbol
    return "method";
  }
  // head === "Sym" (top-level declaration)
  if (tag === 0x2005) return "interface"; // trait
  if (tag === 0x61) return "enum"; // suberror
  if ((tag & 0x8000) === 0x8000) return null; // `test "..."` block → test plane, not a symbol
  if ((tag & 0xf000) === 0x1000) return "function"; // fn 0x100x
  if ((tag & 0xff0) === 0x110) return "class"; // struct 0x11x
  if ((tag & 0xff0) === 0x50) return "enum"; // enum 0x5x
  if ((tag & 0xf00) === 0x400) return "variable"; // let 0x40x
  return null;
}

export function parseMoonbitGenSymbol(kind: string[], tagHex: string): ParsedGenSym | null {
  const tag = Number.parseInt(tagHex, 16);
  if (!Number.isFinite(tag)) return null;
  const neutralKind = kindOf(kind, tag);
  if (!neutralKind) return null;
  if (kind[0] === "SymChild") {
    const parentClass = kind[1];
    const name = kind[2];
    return parentClass && name
      ? { kind: neutralKind, name, exported: (tag & 1) === 1, parentClass }
      : null;
  }
  const name = kind[1];
  return name ? { kind: neutralKind, name, exported: (tag & 1) === 1 } : null;
}

export async function extractMoonbitSymbolsViaIde(
  repoRoot: string,
): Promise<Map<string, CodeSymbol[]> | null> {
  if (!existsSync(join(repoRoot, "_build", ".ide", "packages.json"))) return null;
  const outPath = join(repoRoot, "symbols.jsonl");
  let text: string;
  try {
    // --no-check reuses the existing IDE artifacts instead of re-running `moon check`
    await execFileAsync("moon", ["ide", "gen-symbols", "--no-check"], {
      cwd: repoRoot,
      maxBuffer: 64 * 1024 * 1024,
    });
    text = await readFile(outPath, "utf8");
    await rm(outPath, { force: true }).catch(() => {});
  } catch {
    await rm(outPath, { force: true }).catch(() => {});
    return null; // moon missing / not built / spawn failed → caller falls back
  }

  const byFile = new Map<string, CodeSymbol[]>();
  for (const line of text.split("\n")) {
    if (!line) continue;
    let entry: GenSym;
    try {
      entry = JSON.parse(line) as GenSym;
    } catch {
      continue;
    }
    const path = entry.path.split("\\").join("/");
    if (FOREIGN_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
    const parsed = parseMoonbitGenSymbol(entry.kind, entry.tag);
    if (!parsed) continue;
    const startLine = entry.range[0];
    const endLine = entry.range[2];
    const symbol: CodeSymbol = {
      id: `symbol:${path}:${parsed.kind}:${parsed.parentClass ? `${parsed.parentClass}.${parsed.name}` : parsed.name}:${startLine}`,
      kind: parsed.kind,
      name: parsed.name,
      startLine,
      endLine,
      loc: Math.max(endLine - startLine + 1, 1),
      complexity: 1,
      exported: parsed.exported,
      ...(parsed.parentClass ? { parentClass: parsed.parentClass } : {}),
    };
    const arr = byFile.get(path) ?? [];
    arr.push(symbol);
    byFile.set(path, arr);
  }
  return byFile;
}
