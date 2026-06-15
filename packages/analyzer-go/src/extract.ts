import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, posix } from "node:path";
import fg from "fast-glob";
import Parser from "web-tree-sitter";
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

/** A package import + the name it is referenced by (alias or last path segment). */
type GoImport = { path: string; alias: string };
/** A `pkg.Name` usage: the line, the package alias, and the selected name. */
type GoSelector = { line: number; pkg: string; name: string };

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
        if (name) symbols.push(symbolOf(file, "method", name, node));
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

  // go.mod module path lets us resolve imports under it to local packages
  let modulePath = "";
  if (existsSync(posix.join(repoPath, "go.mod"))) {
    const m = (await readFile(posix.join(repoPath, "go.mod"), "utf8")).match(
      /^\s*module\s+(\S+)/m,
    );
    if (m) modulePath = m[1]!;
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

  // exported symbols per file, by name — the target side of symbol references
  const exportsByFile = new Map<string, Map<string, CodeSymbol>>();
  for (const f of fileEntries) {
    const byName = new Map<string, CodeSymbol>();
    for (const symbol of f.symbols) if (symbol.exported) byName.set(symbol.name, symbol);
    exportsByFile.set(f.rel, byName);
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
    const seenImport = new Set<string>();
    for (const imp of f.imports) {
      if (seenImport.has(imp.path)) continue;
      seenImport.add(imp.path);
      const spec = imp.path;
      const localDir = localDirOf(spec);
      const localFiles = localDir !== null ? filesByDir.get(localDir) : undefined;
      if (localFiles && localFiles.length > 0) {
        // `pkg.Name` usages of this package become symbol references; each
        // resolves against the package file that exports that name
        const refs = f.selectors
          .filter((s) => s.pkg === imp.alias)
          .map((s) => ({ line: s.line, name: s.name }));
        // a Go package is a directory: link the importer to every file in it
        for (const target of localFiles) {
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
