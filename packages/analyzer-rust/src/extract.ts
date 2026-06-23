import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { extname, posix } from "node:path";
import fg from "fast-glob";
import Parser from "web-tree-sitter";
import {
  computeGraphMetrics,
  matchWorkspacePackage,
  mergeSymbolImports,
  resolveSymbolReferences,
  symbolImportOf,
} from "@sprawlens/schema";
import type {
  CodeEdge,
  CodeNode,
  CodeSymbol,
  CodeSymbolImport,
  CodeSymbolKind,
  Snapshot,
  SnapshotCommit,
  WorkspacePackage,
} from "@sprawlens/schema";

type SyntaxNode = Parser.SyntaxNode;

const require = createRequire(import.meta.url);
let parserPromise: Promise<Parser> | null = null;
function rustParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = (async () => {
      await Parser.init({
        locateFile: () => require.resolve("web-tree-sitter/tree-sitter.wasm"),
      });
      const lang = await Parser.Language.load(
        require.resolve("tree-sitter-wasms/out/tree-sitter-rust.wasm"),
      );
      const parser = new Parser();
      parser.setLanguage(lang);
      return parser;
    })();
  }
  return parserPromise;
}

/** `pub` (any form) on the item. */
function isPub(node: SyntaxNode): boolean {
  for (let i = 0; i < node.childCount; i++) {
    if (node.child(i)?.type === "visibility_modifier") return true;
  }
  return false;
}

const BRANCH = new Set([
  "if_expression",
  "match_arm",
  "for_expression",
  "while_expression",
  "loop_expression",
]);
function complexityOf(node: SyntaxNode): number {
  let count = 1;
  const stack = [node];
  while (stack.length) {
    const n = stack.pop()!;
    if (BRANCH.has(n.type)) count++;
    for (let i = 0; i < n.namedChildCount; i++) stack.push(n.namedChild(i)!);
  }
  return count;
}

function symbolOf(
  file: string,
  kind: CodeSymbolKind,
  name: string,
  node: SyntaxNode,
  parentClass?: string,
): CodeSymbol {
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  return {
    id: `symbol:${file}:${kind}:${parentClass ? `${parentClass}.${name}` : name}:${startLine}`,
    kind,
    name,
    startLine,
    endLine,
    loc: endLine - startLine + 1,
    complexity: complexityOf(node),
    exported: isPub(node),
    ...(parentClass ? { parentClass } : {}),
  };
}

/** The implicit standard-library crates: external, but not project deps. */
const RUST_STDLIB: ReadonlySet<string> = new Set(["std", "core", "alloc", "proc_macro", "test"]);

/** A `use` declaration: the resolvable path + the names it brings into scope. */
type RustUse = { path: string; names: string[] };

/** Recurse a scope (source_file / declaration_list), collecting symbols. */
function walk(
  scope: SyntaxNode,
  file: string,
  out: { symbols: CodeSymbol[]; uses: RustUse[] },
  parentClass?: string,
): void {
  for (let i = 0; i < scope.namedChildCount; i++) {
    const node = scope.namedChild(i)!;
    switch (node.type) {
      case "function_item":
      case "function_signature_item": {
        const name = node.childForFieldName("name")?.text;
        if (name)
          out.symbols.push(
            symbolOf(file, parentClass ? "method" : "function", name, node, parentClass),
          );
        break;
      }
      case "struct_item":
      case "union_item": {
        const name = node.childForFieldName("name")?.text;
        if (name) out.symbols.push(symbolOf(file, "class", name, node));
        break;
      }
      case "enum_item": {
        const name = node.childForFieldName("name")?.text;
        if (name) out.symbols.push(symbolOf(file, "enum", name, node));
        break;
      }
      case "trait_item": {
        const name = node.childForFieldName("name")?.text;
        if (name) out.symbols.push(symbolOf(file, "interface", name, node));
        const body = node.childForFieldName("body");
        if (body) walk(body, file, out, name);
        break;
      }
      case "type_item": {
        const name = node.childForFieldName("name")?.text;
        if (name) out.symbols.push(symbolOf(file, "type", name, node));
        break;
      }
      case "const_item":
      case "static_item": {
        const name = node.childForFieldName("name")?.text;
        if (name) out.symbols.push(symbolOf(file, "variable", name, node));
        break;
      }
      case "macro_definition": {
        // `macro_rules! foo { … }` — otherwise its (often large) span falls into
        // the file's "(module scope)" remainder. Macro-heavy files (preludes,
        // ISLE, derive helpers) are almost entirely this.
        const name = node.childForFieldName("name")?.text;
        if (name) out.symbols.push(symbolOf(file, "macro", name, node));
        break;
      }
      case "impl_item": {
        const typeName = node.childForFieldName("type")?.text ?? parentClass;
        const body = node.childForFieldName("body");
        if (body) walk(body, file, out, typeName);
        break;
      }
      case "mod_item": {
        const body = node.childForFieldName("body");
        if (body) walk(body, file, out);
        break;
      }
      case "use_declaration": {
        const path = usePath(node);
        if (path) out.uses.push({ path, names: useNamesOf(node) });
        break;
      }
    }
  }
}

/** The path a `use` declares, as `a::b::c` (group/glob/alias trimmed off). */
function usePath(node: SyntaxNode): string | null {
  const arg = node.childForFieldName("argument") ?? node.namedChild(0);
  if (!arg) return null;
  // keep the module prefix before any { … }, ::*, or ` as `
  const text = arg.text.split("{")[0]!.split(" as ")[0]!.replace(/::\*$/, "");
  const path = text
    .split("::")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("::");
  return path || null;
}

/** The names a `use` brings into scope (last segment, group members, or alias). */
function useNamesOf(node: SyntaxNode): string[] {
  const arg = node.childForFieldName("argument") ?? node.namedChild(0);
  if (!arg) return [];
  const text = arg.text;
  if (/::\*\s*$/.test(text)) return []; // glob: can't enumerate
  const lastSegment = (segment: string): string => {
    const asAt = segment.indexOf(" as ");
    return (asAt >= 0 ? segment.slice(asAt + 4) : (segment.split("::").pop() ?? "")).trim();
  };
  const names = new Set<string>();
  const group = text.match(/\{([^}]*)\}/);
  if (group) {
    for (const part of group[1]!.split(",")) {
      const seg = part.trim();
      if (seg && seg !== "self") names.add(lastSegment(seg));
    }
  } else {
    const name = lastSegment(text);
    if (name && name !== "*") names.add(name);
  }
  names.delete("");
  return [...names];
}

/** All identifier / type usages in the tree (skipping the `use` declarations
 * themselves), as {line, name} — the source side of symbol references. */
function collectUsages(root: SyntaxNode): { line: number; name: string }[] {
  const out: { line: number; name: string }[] = [];
  const stack: SyntaxNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.type === "use_declaration") continue; // its names are imports, not uses
    if (n.type === "identifier" || n.type === "type_identifier") {
      out.push({ line: n.startPosition.row + 1, name: n.text });
    }
    for (let i = 0; i < n.namedChildCount; i++) stack.push(n.namedChild(i)!);
  }
  return out;
}

/** A `::`-qualified reference (`crate::a::foo`, `Foo::new`) and its line. The
 * leading segments name a module path or a type; the last is the symbol used. */
type ScopedRef = { line: number; segs: string[] };

/** All `::`-qualified paths in the tree (outermost only, `use` decls excluded).
 * These are the references a plain identifier scan misses: associated calls
 * (`Foo::new()`) and fully-qualified calls with no `use` (`crate::a::foo()`). */
function collectScopedRefs(root: SyntaxNode): ScopedRef[] {
  const out: ScopedRef[] = [];
  const stack: SyntaxNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.type === "use_declaration") continue;
    if (n.type === "scoped_identifier" || n.type === "scoped_type_identifier") {
      const segs = n.text
        .replace(/<[^>]*>/g, "") // drop generic args / turbofish
        .split("::")
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs.length >= 2) out.push({ line: n.startPosition.row + 1, segs });
      continue; // its segments are this ref, not separate ones
    }
    for (let i = 0; i < n.namedChildCount; i++) stack.push(n.namedChild(i)!);
  }
  return out;
}

/** `src` if the crate root lives there, else `` (repo root). */
function crateRoot(fileSet: ReadonlySet<string>): string {
  if (fileSet.has("src/lib.rs") || fileSet.has("src/main.rs")) return "src";
  if (fileSet.has("lib.rs") || fileSet.has("main.rs")) return "";
  return "src";
}

/** Module path of a file, by the path = module convention. */
function moduleSegsOf(rel: string, root: string): string[] {
  let p = rel;
  if (root && p.startsWith(`${root}/`)) p = p.slice(root.length + 1);
  p = p.replace(/\.rs$/, "");
  const segs = p.split("/").filter(Boolean);
  const last = segs[segs.length - 1];
  if (last === "mod" || last === "lib" || last === "main") segs.pop();
  return segs;
}

/** Longest module-path prefix that maps to an existing file. */
function resolveModule(root: string, segs: string[], fileSet: ReadonlySet<string>): string | null {
  for (let len = segs.length; len >= 1; len--) {
    const base = [root, ...segs.slice(0, len)].filter(Boolean).join("/");
    for (const cand of [`${base}.rs`, `${base}/mod.rs`]) {
      if (fileSet.has(cand)) return cand;
    }
  }
  for (const cand of [`${root}/lib.rs`, `${root}/main.rs`, "lib.rs", "main.rs"]) {
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

/** A crate in the tree: its name, its dir (repo-relative, "" for a lone crate),
 * and the dir its module tree is rooted at (e.g. `crates/foo/src`). */
type Crate = { name: string; dir: string; srcRoot: string };

/** The `[package] name` of a Cargo.toml, else null. */
function packageName(toml: string): string | null {
  const m = toml.match(/\[package\][\s\S]*?\bname\s*=\s*["']([^"']+)["']/);
  return m ? m[1]! : null;
}

/**
 * Discover the crates in the tree. A `[workspace]` root makes this a workspace:
 * every nested Cargo.toml with a `[package]` is a member crate (this covers
 * `members`, path-dependency crates, and virtual roots alike), each rooted at
 * `<dir>/src`. Otherwise the whole tree is one crate rooted by `crateRoot`.
 * `members` is the cross-crate match list (crate names with cargo's `-`→`_`);
 * it is empty for a lone crate, so single-crate resolution is unchanged.
 */
async function detectCrates(
  repoPath: string,
  fileSet: ReadonlySet<string>,
): Promise<{ crates: Crate[]; members: WorkspacePackage[] }> {
  let rootToml = "";
  try {
    rootToml = await readFile(posix.join(repoPath, "Cargo.toml"), "utf8");
  } catch {
    // no root Cargo.toml — treat as a lone crate
  }
  if (/^\s*\[workspace\]/m.test(rootToml)) {
    const manifests = await fg("**/Cargo.toml", {
      cwd: repoPath,
      onlyFiles: true,
      unique: true,
      ignore: ["**/target/**", "**/vendor/**"],
    });
    const crates: Crate[] = [];
    const members: WorkspacePackage[] = [];
    for (const rel of manifests.sort()) {
      const toml =
        rel === "Cargo.toml" ? rootToml : await readFile(posix.join(repoPath, rel), "utf8");
      const name = packageName(toml);
      if (!name) continue; // a virtual workspace root has no [package]
      const dir = posix.dirname(rel);
      const srcRoot = dir === "." ? crateRoot(fileSet) : `${dir}/src`;
      crates.push({ name, dir: dir === "." ? "" : dir, srcRoot });
      members.push({ name: name.replace(/-/g, "_"), sourceRoot: srcRoot });
    }
    if (crates.length > 0) return { crates, members };
  }
  return { crates: [{ name: "", dir: "", srcRoot: crateRoot(fileSet) }], members: [] };
}

/** The crate a file belongs to (longest member-dir prefix). */
function crateOf(rel: string, crates: Crate[]): Crate {
  let best = crates[0]!;
  for (const c of crates) {
    if ((c.dir === "" || rel.startsWith(`${c.dir}/`)) && c.dir.length >= best.dir.length) {
      best = c;
    }
  }
  return best;
}

/** Resolve a `use` path to a local file, an external crate name, or null. */
function resolveUse(
  path: string,
  importerRel: string,
  importerCrate: Crate,
  members: WorkspacePackage[],
  fileSet: ReadonlySet<string>,
): { file: string } | { external: string } | null {
  const segs = path.split("::").filter(Boolean);
  if (segs.length === 0) return null;
  const head = segs[0]!;
  if (head === "crate" || head === "self" || head === "super") {
    let moduleSegs: string[];
    if (head === "crate") {
      moduleSegs = segs.slice(1);
    } else {
      let mod = moduleSegsOf(importerRel, importerCrate.srcRoot);
      let i = 0;
      while (segs[i] === "super" || segs[i] === "self") {
        if (segs[i] === "super") mod = mod.slice(0, -1);
        i++;
      }
      moduleSegs = [...mod, ...segs.slice(i)];
    }
    const file = resolveModule(importerCrate.srcRoot, moduleSegs, fileSet);
    return file && file !== importerRel ? { file } : null;
  }
  // a sibling workspace crate: resolve within its own source tree
  const match = matchWorkspacePackage(members, path, "::");
  if (match) {
    const sub = match.subpath ? match.subpath.split("::").filter(Boolean) : [];
    const file = resolveModule(match.pkg.sourceRoot, sub, fileSet);
    if (file && file !== importerRel) return { file };
  }
  return { external: head };
}

/** Where a `::`-qualified reference points: the target file, the referenced
 * symbol name, and the qualifying type (if `Type::method`). Null when the path
 * is external (`String::new`) or its module/type prefix doesn't resolve. */
function resolveScopedTarget(
  segs: string[],
  importerRel: string,
  importerCrate: Crate,
  members: WorkspacePackage[],
  fileSet: ReadonlySet<string>,
  nameToFile: ReadonlyMap<string, string>,
): { file: string; name: string; preferClass: string | undefined } | null {
  if (segs.length < 2) return null;
  const head = segs[0]!;
  const name = segs[segs.length - 1]!;
  const prev = segs[segs.length - 2]!;
  // a PascalCase segment right before the symbol qualifies a type's member
  const preferClass = /^[A-Z]/.test(prev) ? prev : undefined;
  // module-rooted paths resolve through the same machinery as a `use`
  if (head === "crate" || head === "self" || head === "super") {
    const r = resolveUse(segs.join("::"), importerRel, importerCrate, members, fileSet);
    return r && "file" in r ? { file: r.file, name, preferClass } : null;
  }
  // a type/module head brought into scope by a `use` (`Calc::new`, `math::f`)
  const viaUse = nameToFile.get(head);
  if (viaUse) return { file: viaUse, name, preferClass };
  // a sibling-crate-qualified path (`mylib::Widget::new`)
  const r = resolveUse(segs.join("::"), importerRel, importerCrate, members, fileSet);
  return r && "file" in r ? { file: r.file, name, preferClass } : null;
}

/** Snapshot a Rust working tree via tree-sitter. */
export async function snapshotRustWorkingTree(
  repoPath: string,
  commit: SnapshotCommit,
  repoName: string,
): Promise<Snapshot> {
  const parser = await rustParser();
  const files = await fg("**/*.rs", {
    cwd: repoPath,
    ignore: ["**/target/**", "**/node_modules/**"],
    onlyFiles: true,
    suppressErrors: true,
  });
  files.sort();

  const nodes: CodeNode[] = [{ id: "repo", type: "repo", name: repoName }];
  const edges: CodeEdge[] = [];
  const dirs = new Set<string>();
  let totalLoc = 0;

  const fileEntries: {
    rel: string;
    symbols: CodeSymbol[];
    uses: RustUse[];
    usages: { line: number; name: string }[];
    scoped: ScopedRef[];
    loc: number;
    bytes: number;
  }[] = [];
  for (const rel of files) {
    const source = await readFile(posix.join(repoPath, rel), "utf8");
    const tree = parser.parse(source);
    if (!tree) continue;
    const out: { symbols: CodeSymbol[]; uses: RustUse[] } = { symbols: [], uses: [] };
    walk(tree.rootNode, rel, out);
    const usages = collectUsages(tree.rootNode);
    const scoped = collectScopedRefs(tree.rootNode);
    const loc = source.split("\n").length;
    totalLoc += loc;
    fileEntries.push({ rel, ...out, usages, scoped, loc, bytes: Buffer.byteLength(source) });
    const parts = rel.split("/");
    parts.pop();
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      dirs.add(acc);
    }
  }

  for (const dir of [...dirs].sort()) nodes.push({ id: `dir:${dir}`, type: "dir", path: dir });

  const fileSet = new Set(fileEntries.map((f) => f.rel));
  const { crates, members } = await detectCrates(repoPath, fileSet);

  // exported symbols per file, by name — the target side of symbol references
  const exportsByFile = new Map<string, Map<string, CodeSymbol>>();
  // and the full exported list, so a `Type::method` ref can prefer the symbol
  // whose parentClass matches the qualifier (names alone collide across types)
  const exportedSymbolsByFile = new Map<string, CodeSymbol[]>();
  for (const f of fileEntries) {
    const byName = new Map<string, CodeSymbol>();
    const all: CodeSymbol[] = [];
    for (const symbol of f.symbols) {
      if (!symbol.exported) continue;
      byName.set(symbol.name, symbol);
      all.push(symbol);
    }
    exportsByFile.set(f.rel, byName);
    exportedSymbolsByFile.set(f.rel, all);
  }

  for (const f of fileEntries) {
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
    const dir = f.rel.includes("/") ? f.rel.slice(0, f.rel.lastIndexOf("/")) : "";
    const parent = dir ? `dir:${dir}` : "repo";
    edges.push({ id: `contains:${parent}->${id}`, type: "contains", from: parent, to: id });
    const importerCrate = crateOf(f.rel, crates);

    // Aggregate per target file so a file is one import edge no matter how many
    // `use`s and `::`-paths reach it, merging every symbol reference into it.
    const localRefs = new Map<string, CodeSymbolImport[]>();
    const localSpecifier = new Map<string, string>();
    const externals = new Map<string, boolean>(); // crate -> stdlib?
    const nameToFile = new Map<string, string>(); // use-imported name -> file

    for (const use of f.uses) {
      const r = resolveUse(use.path, f.rel, importerCrate, members, fileSet);
      if (!r) continue;
      if ("file" in r) {
        if (!localRefs.has(r.file)) {
          localRefs.set(r.file, []);
          localSpecifier.set(r.file, use.path);
        }
        for (const name of use.names) nameToFile.set(name, r.file);
        // usages of the names this `use` brings in become symbol references,
        // resolved against the symbols the target file exports
        if (use.names.length) {
          const refs = f.usages.filter((u) => use.names.includes(u.name));
          if (refs.length) {
            mergeSymbolImports(
              localRefs.get(r.file)!,
              resolveSymbolReferences(refs, f.symbols, exportsByFile.get(r.file) ?? new Map()),
            );
          }
        }
      } else {
        externals.set(r.external, RUST_STDLIB.has(r.external));
      }
    }

    // `::`-qualified references (`crate::a::foo`, `Calc::new`): resolve the
    // module/type prefix to a file and the last segment to its exported symbol.
    for (const sref of f.scoped) {
      const target = resolveScopedTarget(
        sref.segs,
        f.rel,
        importerCrate,
        members,
        fileSet,
        nameToFile,
      );
      if (!target || target.file === f.rel) continue;
      const si = symbolImportOf(
        { line: sref.line, name: target.name, preferClass: target.preferClass },
        f.symbols,
        exportedSymbolsByFile.get(target.file) ?? [],
      );
      if (!si) continue;
      if (!localRefs.has(target.file)) {
        localRefs.set(target.file, []);
        localSpecifier.set(target.file, sref.segs.join("::"));
      }
      mergeSymbolImports(localRefs.get(target.file)!, [si]);
    }

    for (const [file, symbolImports] of localRefs) {
      const specifier = localSpecifier.get(file)!;
      edges.push({
        id: `imports:${id}->file:${file}:${specifier}`,
        type: "imports",
        from: id,
        to: `file:${file}`,
        specifier,
        resolved: true,
        ...(symbolImports.length > 0 ? { symbolImports } : {}),
      });
    }
    for (const [crate, stdlib] of externals) {
      edges.push({
        id: `imports:${id}->external:${crate}:${crate}`,
        type: "imports",
        from: id,
        to: `external:${crate}`,
        specifier: crate,
        resolved: false,
        external: true,
        ...(stdlib ? { stdlib: true } : {}),
      });
    }
  }
  for (const dir of dirs) {
    const parent = dir.includes("/") ? `dir:${dir.slice(0, dir.lastIndexOf("/"))}` : "repo";
    edges.push({
      id: `contains:${parent}->dir:${dir}`,
      type: "contains",
      from: parent,
      to: `dir:${dir}`,
    });
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
