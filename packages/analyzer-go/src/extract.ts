import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, posix } from "node:path";
import fg from "fast-glob";
import Parser from "web-tree-sitter";
import {
  computeGraphMetrics,
  matchWorkspacePackage,
  resolvePackageImports,
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

type SyntaxNode = Parser.SyntaxNode;

const require = createRequire(import.meta.url);
let parserPromise: Promise<Parser> | null = null;
function goParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = (async () => {
      await Parser.init({
        locateFile: () => require.resolve("web-tree-sitter/tree-sitter.wasm"),
      });
      const lang = await Parser.Language.load(
        require.resolve("tree-sitter-wasms/out/tree-sitter-go.wasm"),
      );
      const parser = new Parser();
      parser.setLanguage(lang);
      return parser;
    })();
  }
  return parserPromise;
}

const exported = (name: string): boolean =>
  name.length > 0 && name[0] === name[0]!.toUpperCase() && /[A-Z]/.test(name[0]!);

/** Branch points in a subtree (rough cyclomatic complexity). */
function complexityOf(node: SyntaxNode): number {
  let count = 1;
  const branch = new Set([
    "if_statement",
    "for_statement",
    "expression_case",
    "type_case",
    "communication_case",
    "select_statement",
  ]);
  const stack = [node];
  while (stack.length) {
    const n = stack.pop()!;
    if (branch.has(n.type)) count++;
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
    exported: exported(name),
    ...(parentClass ? { parentClass } : {}),
  };
}

/** The module paths in a go.mod's `require` directives (single + block form). */
function goRequires(goMod: string): string[] {
  const mods: string[] = [];
  // single-line: `require example.com/m v1.2.3`
  for (const m of goMod.matchAll(/^\s*require\s+(\S+)\s+v\S+/gm)) mods.push(m[1]!);
  // block: `require (` … `example.com/m v1.2.3 // indirect` … `)`
  for (const block of goMod.matchAll(/require\s*\(([\s\S]*?)\)/g)) {
    for (const line of block[1]!.split("\n")) {
      const m = line.match(/^\s*(\S+)\s+v\S+/);
      if (m) mods.push(m[1]!);
    }
  }
  // longest module first, so prefix matching picks the most specific
  return [...new Set(mods)].sort((a, b) => b.length - a.length);
}

/**
 * Classify an external import path: the standard library (no dot in the first
 * path segment — `fmt`, `path/filepath`) versus a third-party dependency,
 * grouped to its go.mod module (`github.com/x/y/sub` → `github.com/x/y`) so the
 * deps view shows modules, not every sub-package.
 */
function classifyGoExternal(
  path: string,
  requires: readonly string[],
): { group: string; stdlib: boolean } {
  if (!path.split("/")[0]!.includes(".")) return { group: path, stdlib: true };
  const mod = requires.find((m) => path === m || path.startsWith(`${m}/`));
  // fall back to host/org/repo when the module isn't pinned in go.mod
  const group = mod ?? path.split("/").slice(0, 3).join("/");
  return { group, stdlib: false };
}

/** A package import + the name it is referenced by (alias or last path segment). */
type GoImport = { path: string; alias: string };
/** A `pkg.Name` usage: the line, the package alias, and the selected name. */
type GoSelector = { line: number; pkg: string; name: string };

/** The receiver type a `method_declaration` is defined on, e.g. `Greeter` for
 * `func (g Greeter)`, `Stack` for `func (s *Stack[T])`. The first type name
 * under the receiver's type unwraps the pointer and any generic args. */
function receiverType(node: SyntaxNode): string | undefined {
  const type = node.childForFieldName("receiver")?.namedChild(0)?.childForFieldName("type");
  if (!type) return undefined;
  if (type.type === "type_identifier") return type.text;
  const queue: SyntaxNode[] = [type]; // *T, T[X], *T[X]: outermost type id wins
  while (queue.length) {
    const n = queue.shift()!;
    if (n.type === "type_identifier") return n.text;
    for (let i = 0; i < n.namedChildCount; i++) queue.push(n.namedChild(i)!);
  }
  return undefined;
}

function symbolsAndImports(
  root: SyntaxNode,
  file: string,
): { symbols: CodeSymbol[]; imports: GoImport[]; selectors: GoSelector[] } {
  const symbols: CodeSymbol[] = [];
  const imports: GoImport[] = [];
  for (let i = 0; i < root.namedChildCount; i++) {
    const node = root.namedChild(i)!;
    switch (node.type) {
      case "function_declaration": {
        const name = node.childForFieldName("name")?.text;
        if (name) symbols.push(symbolOf(file, "function", name, node));
        break;
      }
      case "method_declaration": {
        const name = node.childForFieldName("name")?.text;
        if (name) symbols.push(symbolOf(file, "method", name, node, receiverType(node)));
        break;
      }
      case "type_declaration": {
        for (let j = 0; j < node.namedChildCount; j++) {
          const spec = node.namedChild(j)!;
          if (spec.type !== "type_spec") continue;
          const name = spec.childForFieldName("name")?.text;
          if (!name) continue;
          const t = spec.childForFieldName("type")?.type;
          const kind: CodeSymbolKind =
            t === "struct_type" ? "class" : t === "interface_type" ? "interface" : "type";
          symbols.push(symbolOf(file, kind, name, spec));
        }
        break;
      }
      case "const_declaration":
      case "var_declaration": {
        for (let j = 0; j < node.namedChildCount; j++) {
          const spec = node.namedChild(j)!;
          const nameNode = spec.childForFieldName("name") ?? spec.namedChild(0);
          const name = nameNode?.text;
          if (name) symbols.push(symbolOf(file, "variable", name, spec));
        }
        break;
      }
      case "import_declaration": {
        const stack = [node];
        while (stack.length) {
          const n = stack.pop()!;
          if (n.type === "import_spec") {
            const raw = n.childForFieldName("path")?.text;
            if (raw) {
              const path = raw.replace(/^["`]|["`]$/g, "");
              const alias =
                n.childForFieldName("name")?.text ?? path.split("/").pop() ?? path;
              imports.push({ path, alias });
            }
          }
          for (let k = 0; k < n.namedChildCount; k++) stack.push(n.namedChild(k)!);
        }
        break;
      }
    }
  }
  // collect `pkg.Name` usages anywhere in the file (references to imports)
  const selectors: GoSelector[] = [];
  const stack: SyntaxNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.type === "selector_expression") {
      const operand = n.childForFieldName("operand");
      const field = n.childForFieldName("field");
      if (operand?.type === "identifier" && field) {
        selectors.push({
          line: n.startPosition.row + 1,
          pkg: operand.text,
          name: field.text,
        });
      }
    }
    for (let k = 0; k < n.namedChildCount; k++) stack.push(n.namedChild(k)!);
  }
  return { symbols, imports, selectors };
}

/** Snapshot a Go working tree via tree-sitter. Imports resolve to local module
 * packages when the path is under the module, else stay external. */
export async function snapshotGoWorkingTree(
  repoPath: string,
  commit: SnapshotCommit,
  repoName: string,
): Promise<Snapshot> {
  const parser = await goParser();
  const files = await fg("**/*.go", {
    cwd: repoPath,
    ignore: ["**/vendor/**", "**/node_modules/**", "**/testdata/**"],
    onlyFiles: true,
    suppressErrors: true,
  });
  files.sort();

  // go.mod gives the module path (for local resolution) and the require list
  // (the project's third-party dependencies, for grouping external imports)
  let modulePath = "";
  let requires: string[] = [];
  if (existsSync(posix.join(repoPath, "go.mod"))) {
    const goMod = await readFile(posix.join(repoPath, "go.mod"), "utf8");
    const m = goMod.match(/^\s*module\s+(\S+)/m);
    if (m) modulePath = m[1]!;
    requires = goRequires(goMod);
  }

  const nodes: CodeNode[] = [{ id: "repo", type: "repo", name: repoName }];
  const edges: CodeEdge[] = [];
  const dirs = new Set<string>();
  /** package dir -> the .go files in it (a Go package is a directory). */
  const filesByDir = new Map<string, string[]>();
  let totalLoc = 0;

  const fileEntries: {
    rel: string;
    symbols: CodeSymbol[];
    imports: GoImport[];
    selectors: GoSelector[];
    loc: number;
    bytes: number;
  }[] = [];
  for (const rel of files) {
    const source = await readFile(posix.join(repoPath, rel), "utf8");
    const tree = parser.parse(source);
    if (!tree) continue;
    const { symbols, imports, selectors } = symbolsAndImports(tree.rootNode, rel);
    const loc = source.split("\n").length;
    totalLoc += loc;
    fileEntries.push({ rel, symbols, imports, selectors, loc, bytes: Buffer.byteLength(source) });
    // register dir chain + the package (file's own dir)
    const parts = rel.split("/");
    parts.pop();
    const pkgDir = parts.join("/");
    (filesByDir.get(pkgDir) ?? filesByDir.set(pkgDir, []).get(pkgDir)!).push(rel);
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      dirs.add(acc);
    }
  }

  // The go.mod module is a one-package workspace rooted at the repo: any import
  // under the module path resolves to a local package dir (matchWorkspacePackage
  // generalizes this to N named roots; Go just has one).
  const workspace: WorkspacePackage[] = modulePath
    ? [{ name: modulePath, sourceRoot: "" }]
    : [];
  /** Local package dir for an import path under the module, else null. */
  const localDirOf = (spec: string): string | null => {
    const m = matchWorkspacePackage(workspace, spec);
    return m ? [m.pkg.sourceRoot, m.subpath].filter(Boolean).join("/") : null;
  };

  // exported symbols per file — the target side of symbol references
  const exportedSymbolsByFile = new Map<string, CodeSymbol[]>();
  for (const f of fileEntries) {
    exportedSymbolsByFile.set(f.rel, f.symbols.filter((s) => s.exported));
  }

  for (const dir of [...dirs].sort())
    nodes.push({ id: `dir:${dir}`, type: "dir", path: dir });

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
    // contains edges (repo/dir -> file)
    const dir = f.rel.includes("/") ? f.rel.slice(0, f.rel.lastIndexOf("/")) : "";
    const parent = dir ? `dir:${dir}` : "repo";
    edges.push({ id: `contains:${parent}->${id}`, type: "contains", from: parent, to: id });
    // a Go package is a directory: an import resolves to its files, else it is
    // a stdlib / go.mod-module dependency. The shared helper does the wiring.
    edges.push(
      ...resolvePackageImports({
        fileId: id,
        rel: f.rel,
        imports: f.imports.map((imp) => ({ spec: imp.path, alias: imp.alias })),
        uses: f.selectors.map((s) => ({ line: s.line, alias: s.pkg, name: s.name })),
        symbols: f.symbols,
        exportedSymbolsOf: (rel) => exportedSymbolsByFile.get(rel) ?? [],
        resolveImport: (spec) => {
          const localDir = localDirOf(spec);
          const localFiles = localDir !== null ? filesByDir.get(localDir) : undefined;
          if (localFiles && localFiles.length > 0) return { local: localFiles };
          const { group, stdlib } = classifyGoExternal(spec, requires);
          return { external: group, stdlib };
        },
      }),
    );
  }
  // contains edges for the dir tree (repo/parent-dir -> dir)
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
