import { readFile } from "node:fs/promises";
import { extname, posix } from "node:path";
import fg from "fast-glob";
import {
  computeGraphMetrics,
  matchWorkspacePackage,
  resolveSymbolReferences,
} from "@sprawlens/schema";
import type {
  CodeEdge,
  CodeNode,
  CodeSymbol,
  CodeSymbolKind,
  Snapshot,
  SnapshotCommit,
  WorkspacePackage,
} from "@sprawlens/schema";

/**
 * MoonBit has no published tree-sitter grammar yet, so this is a heuristic,
 * line-based extractor: top-level declarations are regular enough to read, and
 * package imports live in moon.pkg.json. Swap in tree-sitter-moonbit when a
 * grammar is available — the Snapshot it produces stays the same.
 */

const FN = /^(pub\s+)?fn\s+(?:([A-Za-z_]\w*)::)?([A-Za-z_]\w*)/;
const TYPE = /^(pub\s+)?(struct|enum|trait|type!?)\s+([A-Za-z_]\w*)/;
const VALUE = /^(pub\s+)?(let|const)\s+([A-Za-z_]\w*)/;

const TYPE_KIND: Record<string, CodeSymbolKind> = {
  struct: "class",
  enum: "enum",
  trait: "interface",
  type: "type",
  "type!": "type",
};

function symbolsOf(source: string, file: string): CodeSymbol[] {
  const lines = source.split("\n");
  const symbols: CodeSymbol[] = [];
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (depth === 0 && trimmed && !trimmed.startsWith("//")) {
      let kind: CodeSymbolKind | null = null;
      let name = "";
      let parentClass: string | undefined;
      let exported = false;
      let m: RegExpMatchArray | null;
      if ((m = trimmed.match(FN))) {
        kind = m[2] ? "method" : "function";
        name = m[3]!;
        parentClass = m[2] ?? undefined;
        exported = !!m[1];
      } else if ((m = trimmed.match(TYPE))) {
        kind = TYPE_KIND[m[2]!] ?? "type";
        name = m[3]!;
        exported = !!m[1];
      } else if ((m = trimmed.match(VALUE))) {
        kind = "variable";
        name = m[3]!;
        exported = !!m[1];
      }
      if (kind) {
        const startLine = i + 1;
        const endLine = blockEnd(lines, i);
        symbols.push({
          id: `symbol:${file}:${kind}:${parentClass ? `${parentClass}.${name}` : name}:${startLine}`,
          kind,
          name,
          startLine,
          endLine,
          loc: endLine - startLine + 1,
          complexity: 1,
          exported,
          ...(parentClass ? { parentClass } : {}),
        });
      }
    }
    depth += braceDelta(line);
    if (depth < 0) depth = 0;
  }
  return symbols;
}

/** Last line of the block opened on `start` (matching brace), else `start`. */
function blockEnd(lines: string[], start: number): number {
  let depth = 0;
  let opened = false;
  for (let i = start; i < lines.length; i++) {
    depth += braceDelta(lines[i]!);
    if (depth > 0) opened = true;
    if (opened && depth <= 0) return i + 1;
  }
  return start + 1;
}

/** Net brace count of a line (ignores braces in line comments). */
function braceDelta(line: string): number {
  const code = line.split("//")[0]!;
  let d = 0;
  for (const ch of code) {
    if (ch === "{") d++;
    else if (ch === "}") d--;
  }
  return d;
}

/** An imported package + the alias it is referenced by (`@alias.name`). */
type MbImport = { path: string; alias: string };

/** Imported packages from a package manifest. MoonBit has two formats: the
 * legacy JSON `moon.pkg.json` and the newer `moon.pkg` DSL — dispatch on the
 * leading `{` (only the JSON object starts with one). */
function pkgImports(content: string): MbImport[] {
  return content.trimStart().startsWith("{")
    ? pkgImportsJson(content)
    : pkgImportsDsl(content);
}

/** Imports declared in a moon.pkg.json (strings or {path, alias}). */
function pkgImportsJson(json: string): MbImport[] {
  try {
    const data = JSON.parse(json) as { import?: unknown };
    const list = Array.isArray(data.import) ? data.import : [];
    const out: MbImport[] = [];
    for (const entry of list) {
      let path = "";
      let alias = "";
      if (typeof entry === "string") path = entry;
      else if (entry && typeof entry === "object" && "path" in entry) {
        path = String((entry as { path: unknown }).path);
        const a = (entry as { alias?: unknown }).alias;
        if (typeof a === "string") alias = a;
      }
      if (path) out.push({ path, alias: alias || path.split("/").pop() || path });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Imports declared in a moon.pkg DSL: `import { "a", "b" as c }` blocks. The
 * `import { … } for "test"` block is test-only, so it is skipped (its deps
 * would over-link the package's non-test files).
 */
function pkgImportsDsl(content: string): MbImport[] {
  const out: MbImport[] = [];
  const block = /import\s*\{([\s\S]*?)\}(\s*for\b[^\n]*)?/g;
  const entry = /"([^"]+)"(?:\s+as\s+([A-Za-z_]\w*))?/g;
  let b: RegExpExecArray | null;
  while ((b = block.exec(content))) {
    if (b[2]) continue; // `for "..."`-scoped (test) imports
    entry.lastIndex = 0;
    let e: RegExpExecArray | null;
    while ((e = entry.exec(b[1]!))) {
      const path = e[1]!;
      out.push({ path, alias: e[2] || path.split("/").pop() || path });
    }
  }
  return out;
}

/** The module name from moon.mod.json (JSON) or moon.mod (TOML), else "". */
async function readModuleName(repoPath: string): Promise<string> {
  try {
    const mod = JSON.parse(
      await readFile(posix.join(repoPath, "moon.mod.json"), "utf8"),
    ) as { name?: unknown };
    if (typeof mod.name === "string") return mod.name;
  } catch {
    // no JSON module file; try the TOML form
  }
  try {
    const toml = await readFile(posix.join(repoPath, "moon.mod"), "utf8");
    const m = toml.match(/^\s*name\s*=\s*"([^"]+)"/m);
    if (m) return m[1]!;
  } catch {
    // no module file at all; everything stays external
  }
  return "";
}

/** `@alias.name` qualified usages in a file (heuristic, line-based). */
const SELECTOR = /@([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)/g;
function selectorsOf(source: string): { line: number; pkg: string; name: string }[] {
  const out: { line: number; pkg: string; name: string }[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    SELECTOR.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SELECTOR.exec(lines[i]!))) {
      out.push({ line: i + 1, pkg: m[1]!, name: m[2]! });
    }
  }
  return out;
}

export async function snapshotMoonbitWorkingTree(
  repoPath: string,
  commit: SnapshotCommit,
  repoName: string,
): Promise<Snapshot> {
  const files = await fg("**/*.mbt", {
    cwd: repoPath,
    ignore: ["**/target/**", "**/node_modules/**", "**/.mooncakes/**"],
    onlyFiles: true,
    suppressErrors: true,
  });
  files.sort();
  // both manifest spellings: legacy moon.pkg.json and the newer moon.pkg DSL
  const pkgFiles = await fg(["**/moon.pkg.json", "**/moon.pkg"], {
    cwd: repoPath,
    ignore: ["**/target/**", "**/.mooncakes/**"],
    onlyFiles: true,
    suppressErrors: true,
  });
  // dir -> imported packages
  const importsByDir = new Map<string, MbImport[]>();
  for (const pkg of pkgFiles) {
    const dir = pkg.includes("/") ? pkg.slice(0, pkg.lastIndexOf("/")) : "";
    importsByDir.set(dir, pkgImports(await readFile(posix.join(repoPath, pkg), "utf8")));
  }
  // module name (moon.mod.json / moon.mod) resolves imports under it to local dirs
  const moduleName = await readModuleName(repoPath);

  const nodes: CodeNode[] = [{ id: "repo", type: "repo", name: repoName }];
  const edges: CodeEdge[] = [];
  const dirs = new Set<string>();
  /** package dir -> its .mbt files. */
  const filesByDir = new Map<string, string[]>();
  let totalLoc = 0;

  const entries: {
    rel: string;
    symbols: CodeSymbol[];
    selectors: { line: number; pkg: string; name: string }[];
    loc: number;
    bytes: number;
    dir: string;
  }[] = [];
  for (const rel of files) {
    const source = await readFile(posix.join(repoPath, rel), "utf8");
    const loc = source.split("\n").length;
    totalLoc += loc;
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    entries.push({
      rel,
      symbols: symbolsOf(source, rel),
      selectors: selectorsOf(source),
      loc,
      bytes: Buffer.byteLength(source),
      dir,
    });
    (filesByDir.get(dir) ?? filesByDir.set(dir, []).get(dir)!).push(rel);
    const parts = rel.split("/");
    parts.pop();
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      dirs.add(acc);
    }
  }

  // The moon.mod.json module is a one-package workspace rooted at the repo;
  // imports under its name resolve to local package dirs (same neutral matcher
  // the other analyzers use, generalized here to a single named root).
  const workspace: WorkspacePackage[] = moduleName
    ? [{ name: moduleName, sourceRoot: "" }]
    : [];
  /** Local package dir for an import under the module, else null. */
  const localDirOf = (spec: string): string | null => {
    const m = matchWorkspacePackage(workspace, spec);
    return m ? [m.pkg.sourceRoot, m.subpath].filter(Boolean).join("/") : null;
  };

  for (const dir of [...dirs].sort())
    nodes.push({ id: `dir:${dir}`, type: "dir", path: dir });

  // exported symbols per file, by name — the target side of symbol references
  const exportsByFile = new Map<string, Map<string, CodeSymbol>>();
  for (const f of entries) {
    const byName = new Map<string, CodeSymbol>();
    for (const symbol of f.symbols) if (symbol.exported) byName.set(symbol.name, symbol);
    exportsByFile.set(f.rel, byName);
  }

  for (const f of entries) {
    const id = `file:${f.rel}`;
    nodes.push({
      id,
      type: "file",
      path: f.rel,
      ext: extname(f.rel),
      loc: f.loc,
      sizeBytes: f.bytes,
      symbols: f.symbols,
    });
    const parent = f.dir ? `dir:${f.dir}` : "repo";
    edges.push({ id: `contains:${parent}->${id}`, type: "contains", from: parent, to: id });
    // package imports (from moon.pkg.json) apply to every file in the package
    const seenImport = new Set<string>();
    for (const imp of importsByDir.get(f.dir) ?? []) {
      if (seenImport.has(imp.path)) continue;
      seenImport.add(imp.path);
      const spec = imp.path;
      const localDir = localDirOf(spec);
      const localFiles = localDir !== null ? filesByDir.get(localDir) : undefined;
      // a package's test files (`*_test.mbt` / `*_wbtest.mbt`) are not part of
      // its importable surface — never an import target
      const importable = localFiles?.filter((t) => !/_(test|wbtest)\.mbt$/.test(t));
      if (importable && importable.length > 0) {
        // `@alias.name` usages of this package become symbol references
        const refs = f.selectors
          .filter((s) => s.pkg === imp.alias)
          .map((s) => ({ line: s.line, name: s.name }));
        for (const target of importable) {
          if (target === f.rel) continue;
          const symbolImports = refs.length
            ? resolveSymbolReferences(
                refs,
                f.symbols,
                exportsByFile.get(target) ?? new Map(),
              )
            : [];
          edges.push({
            id: `imports:${id}->file:${target}:${spec}`,
            type: "imports",
            from: id,
            to: `file:${target}`,
            specifier: spec,
            resolved: true,
            ...(symbolImports.length > 0 ? { symbolImports } : {}),
          });
        }
      } else {
        edges.push({
          id: `imports:${id}->external:${spec}:${spec}`,
          type: "imports",
          from: id,
          to: `external:${spec}`,
          specifier: spec,
          resolved: false,
          external: true,
        });
      }
    }
  }
  for (const dir of dirs) {
    const parent = dir.includes("/") ? `dir:${dir.slice(0, dir.lastIndexOf("/"))}` : "repo";
    edges.push({ id: `contains:${parent}->dir:${dir}`, type: "contains", from: parent, to: `dir:${dir}` });
  }

  const { metrics } = computeGraphMetrics(nodes, edges);
  return {
    schemaVersion: 1,
    repoPath,
    commit,
    nodes,
    edges,
    metrics: { ...metrics, loc: totalLoc },
  };
}
