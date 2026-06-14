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
        const path = usePath(node);
        if (path) out.imports.push(path);
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
function resolveModule(
  root: string,
  segs: string[],
  fileSet: ReadonlySet<string>,
): string | null {
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

/** Resolve a `use` path to a local file, or an external crate name, or null. */
function resolveUse(
  path: string,
  importerRel: string,
  root: string,
  fileSet: ReadonlySet<string>,
): { file: string } | { external: string } | null {
  const segs = path.split("::").filter(Boolean);
  if (segs.length === 0) return null;
  const head = segs[0]!;
  let moduleSegs: string[];
  if (head === "crate") {
    moduleSegs = segs.slice(1);
  } else if (head === "self" || head === "super") {
    let mod = moduleSegsOf(importerRel, root);
    let i = 0;
    while (segs[i] === "super" || segs[i] === "self") {
      if (segs[i] === "super") mod = mod.slice(0, -1);
      i++;
    }
    moduleSegs = [...mod, ...segs.slice(i)];
  } else {
    return { external: head };
  }
  const file = resolveModule(root, moduleSegs, fileSet);
  return file && file !== importerRel ? { file } : null;
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

  const fileSet = new Set(fileEntries.map((f) => f.rel));
  const root = crateRoot(fileSet);

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
    // dedupe by resolved target / external crate (a file `use`s many items)
    const seen = new Set<string>();
    for (const path of f.imports) {
      const r = resolveUse(path, f.rel, root, fileSet);
      if (!r) continue;
      if ("file" in r) {
        if (seen.has(`f:${r.file}`)) continue;
        seen.add(`f:${r.file}`);
        edges.push({
          id: `imports:${id}->file:${r.file}:${path}`,
          type: "imports",
          from: id,
          to: `file:${r.file}`,
          specifier: path,
          resolved: true,
        });
      } else {
        if (seen.has(`e:${r.external}`)) continue;
        seen.add(`e:${r.external}`);
        edges.push({
          id: `imports:${id}->external:${r.external}:${r.external}`,
          type: "imports",
          from: id,
          to: `external:${r.external}`,
          specifier: r.external,
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
