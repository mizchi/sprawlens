import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { extname, posix } from "node:path";
import fg from "fast-glob";
import Parser from "web-tree-sitter";
import { computeGraphMetrics } from "@sprawlens/schema";
import type {
  CodeEdge,
  CodeNode,
  CodeSymbol,
  CodeSymbolKind,
  Snapshot,
  SnapshotCommit,
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

/** Recurse a scope (source_file / declaration_list), collecting symbols. */
function walk(
  scope: SyntaxNode,
  file: string,
  out: { symbols: CodeSymbol[]; imports: string[] },
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
        const root = useCrate(node);
        if (root) out.imports.push(root);
        break;
      }
    }
  }
}

/** The external crate a `use` pulls from (skip crate/self/super = internal). */
function useCrate(node: SyntaxNode): string | null {
  const arg = node.childForFieldName("argument") ?? node.namedChild(0);
  if (!arg) return null;
  // walk to the leftmost identifier of the path
  let n: SyntaxNode | null = arg;
  while (n && (n.type === "scoped_identifier" || n.type === "scoped_use_list" || n.type === "use_as_clause")) {
    n = n.childForFieldName("path") ?? n.namedChild(0);
  }
  const first = (n?.text ?? arg.text).split("::")[0]!.trim();
  if (!first || first === "crate" || first === "self" || first === "super") return null;
  return first;
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
    imports: string[];
    loc: number;
    bytes: number;
  }[] = [];
  for (const rel of files) {
    const source = await readFile(posix.join(repoPath, rel), "utf8");
    const tree = parser.parse(source);
    if (!tree) continue;
    const out = { symbols: [] as CodeSymbol[], imports: [] as string[] };
    walk(tree.rootNode, rel, out);
    const loc = source.split("\n").length;
    totalLoc += loc;
    fileEntries.push({ rel, ...out, loc, bytes: Buffer.byteLength(source) });
    const parts = rel.split("/");
    parts.pop();
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      dirs.add(acc);
    }
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
    const dir = f.rel.includes("/") ? f.rel.slice(0, f.rel.lastIndexOf("/")) : "";
    const parent = dir ? `dir:${dir}` : "repo";
    edges.push({ id: `contains:${parent}->${id}`, type: "contains", from: parent, to: id });
    for (const spec of new Set(f.imports)) {
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
