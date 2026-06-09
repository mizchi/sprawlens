import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import ts from "typescript";
import { computeGraphMetrics } from "./metrics.js";
import type { CodeEdge, CodeNode, CodeSymbol, CodeSymbolKind, FileNode, Snapshot, SnapshotCommit } from "./types.js";

export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"] as const;

const SOURCE_PATTERNS = SOURCE_EXTENSIONS.map((ext) => `**/*${ext}`);
const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.turbo/**",
  "**/.git/**",
  "**/.codesprawl/**",
  "**/vendor/**",
  "**/vendors/**",
  "**/third_party/**",
  "**/third-party/**",
  "**/fixtures/**",
  "**/__fixtures__/**",
  "**/tests/assets/**",
  "**/test/assets/**",
  "**/__tests__/assets/**",
  "**/*.d.ts",
];

type SnapshotOptions = {
  repoPath?: string;
  repoName?: string;
};

export async function createSnapshotFromWorkingTree(
  workingTreePath: string,
  commit: SnapshotCommit,
  options: SnapshotOptions = {},
): Promise<Snapshot> {
  const root = path.resolve(workingTreePath);
  const repoPath = options.repoPath ? path.resolve(options.repoPath) : root;
  const repoName = options.repoName ?? path.basename(repoPath);
  const files = (await fg(SOURCE_PATTERNS, {
    cwd: root,
    onlyFiles: true,
    unique: true,
    ignore: DEFAULT_IGNORES,
  })).sort();

  const fileSet = new Set(files.map(normalizePath));
  const fileContents = new Map<string, string>();
  const fileNodes: FileNode[] = [];

  for (const relativePath of files.map(normalizePath)) {
    const absolutePath = path.join(root, relativePath);
    const [content, fileStat] = await Promise.all([readFile(absolutePath, "utf8"), stat(absolutePath)]);
    fileContents.set(relativePath, content);
    fileNodes.push({
      id: fileId(relativePath),
      type: "file",
      path: relativePath,
      ext: sourceExtension(relativePath),
      loc: countLoc(content),
      sizeBytes: fileStat.size,
      symbols: extractTopLevelSymbols(content, relativePath),
    });
  }

  const dirPaths = collectDirectoryPaths(fileNodes.map((node) => node.path));
  const nodes: CodeNode[] = [
    { id: "repo", type: "repo", name: repoName },
    ...dirPaths.map((dirPath) => ({ id: dirId(dirPath), type: "dir" as const, path: dirPath })),
    ...fileNodes,
  ];

  const edges = [
    ...createContainsEdges(dirPaths, fileNodes.map((node) => node.path)),
    ...createImportEdges(root, fileContents, fileSet),
  ];
  const { metrics } = computeGraphMetrics(nodes, edges);

  return {
    schemaVersion: 1,
    repoPath,
    commit,
    nodes,
    edges,
    metrics,
  };
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function sourceExtension(relativePath: string): string {
  if (relativePath.endsWith(".d.ts")) {
    return ".d.ts";
  }
  return path.posix.extname(relativePath);
}

function countLoc(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines.length;
}

function collectDirectoryPaths(filePaths: string[]): string[] {
  const dirs = new Set<string>();

  for (const filePath of filePaths) {
    const dirPath = path.posix.dirname(filePath);
    if (dirPath === ".") {
      continue;
    }

    const parts = dirPath.split("/");
    for (let index = 1; index <= parts.length; index += 1) {
      dirs.add(parts.slice(0, index).join("/"));
    }
  }

  return [...dirs].sort();
}

function createContainsEdges(dirPaths: string[], filePaths: string[]): CodeEdge[] {
  const edges = new Map<string, CodeEdge>();

  for (const dirPath of dirPaths) {
    const parent = path.posix.dirname(dirPath);
    const from = parent === "." ? "repo" : dirId(parent);
    const to = dirId(dirPath);
    edges.set(containsId(from, to), {
      id: containsId(from, to),
      type: "contains",
      from,
      to,
    });
  }

  for (const filePath of filePaths) {
    const parent = path.posix.dirname(filePath);
    const from = parent === "." ? "repo" : dirId(parent);
    const to = fileId(filePath);
    edges.set(containsId(from, to), {
      id: containsId(from, to),
      type: "contains",
      from,
      to,
    });
  }

  return [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function createImportEdges(root: string, fileContents: Map<string, string>, fileSet: Set<string>): CodeEdge[] {
  const edges = new Map<string, CodeEdge>();

  for (const [fromPath, content] of fileContents) {
    const specifiers = extractImportSpecifiers(content, fromPath);
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) {
        continue;
      }

      const resolvedPath = resolveRelativeImport(fromPath, specifier, fileSet);
      const from = fileId(fromPath);
      const to = resolvedPath ? fileId(resolvedPath) : unresolvedId(fromPath, specifier);
      const id = importId(from, to, specifier);
      edges.set(id, {
        id,
        type: "imports",
        from,
        to,
        specifier,
        resolved: Boolean(resolvedPath),
      });
    }
  }

  void root;
  return [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function extractImportSpecifiers(content: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  const specifiers: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteralLike(firstArg)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          specifiers.push(firstArg.text);
        } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
          specifiers.push(firstArg.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function extractTopLevelSymbols(content: string, fileName: string): CodeSymbol[] {
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  const symbols: CodeSymbol[] = [];

  for (const statement of sourceFile.statements) {
    const exported = hasExportModifier(statement);
    const direct = symbolFromStatement(statement, sourceFile, fileName, exported);
    if (direct) {
      symbols.push(direct);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const variableSymbol = symbolFromVariableDeclaration(declaration, statement, sourceFile, fileName, exported);
        if (variableSymbol) {
          symbols.push(variableSymbol);
        }
      }
    }
  }

  return symbols.sort((a, b) => a.startLine - b.startLine || a.name.localeCompare(b.name));
}

function symbolFromStatement(statement: ts.Statement, sourceFile: ts.SourceFile, fileName: string, exported: boolean): CodeSymbol | undefined {
  if (ts.isFunctionDeclaration(statement) && statement.name) {
    return createSymbol(fileName, sourceFile, statement, "function", statement.name.text, exported);
  }
  if (ts.isClassDeclaration(statement) && statement.name) {
    return createSymbol(fileName, sourceFile, statement, "class", statement.name.text, exported);
  }
  if (ts.isInterfaceDeclaration(statement)) {
    return createSymbol(fileName, sourceFile, statement, "interface", statement.name.text, exported);
  }
  if (ts.isEnumDeclaration(statement)) {
    return createSymbol(fileName, sourceFile, statement, "enum", statement.name.text, exported);
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    return createSymbol(fileName, sourceFile, statement, "type", statement.name.text, exported);
  }
  return undefined;
}

function symbolFromVariableDeclaration(
  declaration: ts.VariableDeclaration,
  statement: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  fileName: string,
  exported: boolean,
): CodeSymbol | undefined {
  if (!ts.isIdentifier(declaration.name)) {
    return undefined;
  }
  const initializer = declaration.initializer;
  if (!initializer) {
    return undefined;
  }
  const kind: CodeSymbolKind =
    ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)
      ? "function"
      : ts.isClassExpression(initializer)
        ? "class"
        : "variable";
  if (kind === "variable") {
    return undefined;
  }
  return createSymbol(fileName, sourceFile, statement, kind, declaration.name.text, exported);
}

function createSymbol(
  fileName: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: CodeSymbolKind,
  name: string,
  exported: boolean,
): CodeSymbol {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
  return {
    id: symbolId(fileName, kind, name, start),
    kind,
    name,
    startLine: start,
    endLine: end,
    loc: Math.max(1, end - start + 1),
    exported,
  };
}

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function scriptKindFor(fileName: string): ts.ScriptKind {
  if (fileName.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (fileName.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (fileName.endsWith(".js") || fileName.endsWith(".mjs") || fileName.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function resolveRelativeImport(fromPath: string, specifier: string, fileSet: Set<string>): string | undefined {
  const fromDir = path.posix.dirname(fromPath);
  const basePath = path.posix.normalize(path.posix.join(fromDir, specifier));
  if (basePath.startsWith("../") || basePath === "..") {
    return undefined;
  }

  for (const candidate of resolutionCandidates(basePath)) {
    if (fileSet.has(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolutionCandidates(basePath: string): string[] {
  const ext = path.posix.extname(basePath);
  if (ext) {
    const candidates = [basePath];
    const withoutExt = basePath.slice(0, -ext.length);
    if (ext === ".js") {
      candidates.push(`${withoutExt}.ts`, `${withoutExt}.tsx`);
    } else if (ext === ".jsx") {
      candidates.push(`${withoutExt}.tsx`);
    } else if (ext === ".mjs") {
      candidates.push(`${withoutExt}.mts`);
    } else if (ext === ".cjs") {
      candidates.push(`${withoutExt}.cts`);
    }
    return candidates;
  }

  return [
    ...SOURCE_EXTENSIONS.map((sourceExt) => `${basePath}${sourceExt}`),
    ...SOURCE_EXTENSIONS.map((sourceExt) => path.posix.join(basePath, `index${sourceExt}`)),
  ];
}

function fileId(relativePath: string): string {
  return `file:${relativePath}`;
}

function symbolId(relativePath: string, kind: CodeSymbolKind, name: string, startLine: number): string {
  return `symbol:${relativePath}:${kind}:${name}:${startLine}`;
}

function dirId(relativePath: string): string {
  return `dir:${relativePath}`;
}

function containsId(from: string, to: string): string {
  return `contains:${from}->${to}`;
}

function importId(from: string, to: string, specifier: string): string {
  return `imports:${from}->${to}:${specifier}`;
}

function unresolvedId(fromPath: string, specifier: string): string {
  return `unresolved:${fromPath}:${specifier}`;
}
