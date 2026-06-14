import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import ts from "typescript";
import { computeGraphMetrics } from "./metrics.js";
import type {
  CodeEdge,
  CodeImportBinding,
  CodeImportBindingKind,
  CodeNode,
  CodeSymbol,
  CodeSymbolImport,
  CodeSymbolKind,
  FileNode,
  Snapshot,
  SnapshotCommit,
} from "./types.js";

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
    ...createImportEdges(root, fileContents, fileSet, fileNodes),
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

type ExtractedImport = {
  specifier: string;
  bindings: CodeImportBinding[];
};

function createImportEdges(root: string, fileContents: Map<string, string>, fileSet: Set<string>, fileNodes: FileNode[]): CodeEdge[] {
  const edges = new Map<string, CodeEdge>();
  const fileByPath = new Map(fileNodes.map((file) => [file.path, file]));

  for (const [fromPath, content] of fileContents) {
    const imports = extractImports(content, fromPath);
    const usageByLocal = collectTopLevelSymbolUsages(content, fromPath, new Set(imports.flatMap((item) => item.bindings.map((binding) => binding.local))));
    for (const item of imports) {
      const { specifier, bindings } = item;
      const from = fileId(fromPath);
      // bare specifiers are external packages: capture them as edges to a
      // synthetic external node (no node emitted, like unresolved imports)
      if (!specifier.startsWith(".")) {
        const to = externalId(specifier);
        const id = importId(from, to, specifier);
        // resolved: the package is known, just not a project file — so it
        // never counts as an unresolved (broken) import
        edges.set(id, {
          id,
          type: "imports",
          from,
          to,
          specifier,
          resolved: true,
          external: true,
          bindings: bindings.length > 0 ? bindings : undefined,
        });
        continue;
      }

      const resolvedPath = resolveRelativeImport(fromPath, specifier, fileSet);
      const to = resolvedPath ? fileId(resolvedPath) : unresolvedId(fromPath, specifier);
      const id = importId(from, to, specifier);
      const symbolImports = resolvedPath ? resolveSymbolImports(bindings, usageByLocal, fileByPath.get(resolvedPath)) : [];
      edges.set(id, {
        id,
        type: "imports",
        from,
        to,
        specifier,
        resolved: Boolean(resolvedPath),
        bindings: bindings.length > 0 ? bindings : undefined,
        symbolImports: symbolImports.length > 0 ? symbolImports : undefined,
      });
    }
  }

  void root;
  return [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function extractImports(content: string, fileName: string): ExtractedImport[] {
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  const imports: ExtractedImport[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        bindings: bindingsFromImportDeclaration(node),
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        bindings: bindingsFromExportDeclaration(node),
      });
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteralLike(firstArg)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          imports.push({ specifier: firstArg.text, bindings: [{ imported: "*", local: "*", kind: "dynamic" }] });
        } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
          imports.push({ specifier: firstArg.text, bindings: [{ imported: "*", local: "*", kind: "require" }] });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

function bindingsFromImportDeclaration(node: ts.ImportDeclaration): CodeImportBinding[] {
  const importClause = node.importClause;
  if (!importClause) {
    return [{ imported: "*", local: "*", kind: "side-effect" }];
  }
  const bindings: CodeImportBinding[] = [];
  const typeOnly = importClause.isTypeOnly || undefined;
  if (importClause.name) {
    bindings.push({ imported: "default", local: importClause.name.text, kind: "default", typeOnly });
  }
  const namedBindings = importClause.namedBindings;
  if (namedBindings && ts.isNamespaceImport(namedBindings)) {
    bindings.push({ imported: "*", local: namedBindings.name.text, kind: "namespace", typeOnly });
  } else if (namedBindings && ts.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) {
      bindings.push({
        imported: element.propertyName?.text ?? element.name.text,
        local: element.name.text,
        kind: "named",
        typeOnly: importClause.isTypeOnly || element.isTypeOnly || undefined,
      });
    }
  }
  return bindings;
}

function bindingsFromExportDeclaration(node: ts.ExportDeclaration): CodeImportBinding[] {
  const exportClause = node.exportClause;
  if (!exportClause) {
    return [{ imported: "*", local: "*", kind: "reexport-all", typeOnly: node.isTypeOnly || undefined }];
  }
  if (ts.isNamespaceExport(exportClause)) {
    return [{ imported: "*", local: exportClause.name.text, kind: "reexport-all", typeOnly: node.isTypeOnly || undefined }];
  }
  return exportClause.elements.map((element) => ({
    imported: element.propertyName?.text ?? element.name.text,
    local: element.name.text,
    kind: "reexport-named" as CodeImportBindingKind,
    typeOnly: node.isTypeOnly || element.isTypeOnly || undefined,
  }));
}

function resolveSymbolImports(
  bindings: CodeImportBinding[],
  usageByLocal: Map<string, CodeSymbol[]>,
  targetFile?: FileNode,
): CodeSymbolImport[] {
  if (!targetFile) {
    return [];
  }
  const exportedSymbols = new Map((targetFile.symbols ?? []).filter((symbol) => symbol.exported).map((symbol) => [symbol.name, symbol]));
  const imports: CodeSymbolImport[] = [];
  for (const binding of bindings) {
    if (binding.typeOnly || binding.imported === "*" || binding.kind === "side-effect" || binding.kind === "dynamic" || binding.kind === "require") {
      continue;
    }
    const target = exportedSymbols.get(binding.imported);
    if (!target) {
      continue;
    }
    const fromSymbols = binding.kind === "reexport-named" ? [] : (usageByLocal.get(binding.local) ?? []);
    if (fromSymbols.length === 0) {
      imports.push({
        ...binding,
        toSymbolId: target.id,
        toSymbolName: target.name,
      });
      continue;
    }
    for (const fromSymbol of fromSymbols) {
      imports.push({
        ...binding,
        fromSymbolId: fromSymbol.id,
        fromSymbolName: fromSymbol.name,
        toSymbolId: target.id,
        toSymbolName: target.name,
      });
    }
  }
  return imports;
}

function collectTopLevelSymbolUsages(content: string, fileName: string, localNames: Set<string>): Map<string, CodeSymbol[]> {
  const usages = new Map<string, CodeSymbol[]>();
  if (localNames.size === 0 || (localNames.size === 1 && localNames.has("*"))) {
    return usages;
  }
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      continue;
    }
    const exported = hasExportModifier(statement);
    const symbols = symbolsFromTopLevelStatement(statement, sourceFile, fileName, exported);
    for (const symbol of symbols) {
      const seenLocals = new Set<string>();
      const visit = (node: ts.Node) => {
        if (ts.isIdentifier(node) && localNames.has(node.text)) {
          seenLocals.add(node.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(statement);
      for (const local of seenLocals) {
        const current = usages.get(local) ?? [];
        current.push(symbol);
        usages.set(local, current);
      }
    }
  }

  return usages;
}

function extractTopLevelSymbols(content: string, fileName: string): CodeSymbol[] {
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  const symbols: CodeSymbol[] = [];

  for (const statement of sourceFile.statements) {
    const exported = hasExportModifier(statement);
    symbols.push(...symbolsFromTopLevelStatement(statement, sourceFile, fileName, exported));
  }

  return symbols.sort((a, b) => a.startLine - b.startLine || a.name.localeCompare(b.name));
}

function symbolsFromTopLevelStatement(statement: ts.Statement, sourceFile: ts.SourceFile, fileName: string, exported: boolean): CodeSymbol[] {
  const direct = symbolFromStatement(statement, sourceFile, fileName, exported);
  if (direct) {
    if (ts.isClassDeclaration(statement) && statement.name) {
      const members = classMemberSymbols(statement, sourceFile, fileName, statement.name.text, direct.id, exported);
      // the class keeps only its own (non-member) lines so class + members
      // sum to the declaration's span — no double counting when both show
      const memberLoc = members.reduce((sum, m) => sum + m.loc, 0);
      const own = { ...direct, loc: Math.max(1, direct.loc - memberLoc) };
      return [own, ...members];
    }
    return [direct];
  }
  if (!ts.isVariableStatement(statement)) {
    return [];
  }
  return statement.declarationList.declarations.flatMap((declaration) => {
    const variableSymbol = symbolFromVariableDeclaration(declaration, statement, sourceFile, fileName, exported);
    return variableSymbol ? [variableSymbol] : [];
  });
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === kind));
}

/** Methods, accessors and properties of a class, as symbols whose ids encode
 * the owning class (`symbol:path:<kind>:Class.member:line`). Static members
 * take the `static-` kind variant; private (`private`/`#`) members are kept
 * but not flagged exported. */
function classMemberSymbols(
  cls: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  fileName: string,
  className: string,
  classId: string,
  classExported: boolean,
): CodeSymbol[] {
  const out: CodeSymbol[] = [];
  for (const member of cls.members) {
    let base: "method" | "property" | undefined;
    let name: string | undefined;
    if (ts.isConstructorDeclaration(member)) {
      base = "method";
      name = "constructor";
    } else if (ts.isMethodDeclaration(member)) {
      base = "method";
      name = memberName(member.name, sourceFile);
    } else if (ts.isGetAccessor(member) || ts.isSetAccessor(member) || ts.isPropertyDeclaration(member)) {
      base = "property";
      name = memberName(member.name, sourceFile);
    }
    if (!base || !name) continue;
    const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);
    const isPrivate =
      hasModifier(member, ts.SyntaxKind.PrivateKeyword) || name.startsWith("#");
    const kind = (isStatic ? `static-${base}` : base) as CodeSymbolKind;
    const start = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1;
    const end = sourceFile.getLineAndCharacterOfPosition(member.getEnd()).line + 1;
    out.push({
      id: `symbol:${fileName}:${kind}:${className}.${name}:${start}`,
      kind,
      name,
      startLine: start,
      endLine: end,
      loc: Math.max(1, end - start + 1),
      complexity: cyclomaticComplexity(member),
      exported: classExported && !isPrivate,
      parentClass: classId,
    });
  }
  return out;
}

function memberName(name: ts.PropertyName | undefined, sourceFile: ts.SourceFile): string | undefined {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText(sourceFile);
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
  if (kind === "variable" && !exported) {
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
    complexity: cyclomaticComplexity(node),
    exported,
  };
}

/** Cyclomatic complexity: 1 + decision points in the subtree. Logical
 * operators count (short-circuiting is a branch); case clauses count per
 * clause; else does not (it is the other side of the if). */
function cyclomaticComplexity(root: ts.Node): number {
  let branches = 0;
  const visit = (node: ts.Node) => {
    switch (node.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CaseClause:
      case ts.SyntaxKind.CatchClause:
        branches++;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const op = (node as ts.BinaryExpression).operatorToken.kind;
        if (
          op === ts.SyntaxKind.AmpersandAmpersandToken ||
          op === ts.SyntaxKind.BarBarToken ||
          op === ts.SyntaxKind.QuestionQuestionToken
        ) {
          branches++;
        }
        break;
      }
      default:
        break;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return 1 + branches;
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

function externalId(specifier: string): string {
  return `external:${specifier}`;
}
