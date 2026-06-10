import path from "node:path";
import fg from "fast-glob";
import ts from "typescript";
import type { CodeSymbolKind } from "./types.js";

export type SymbolDependencyDirection = "incoming" | "outgoing";
export type SymbolDependencyKind = "call";

export type SymbolDependencyNode = {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  startColumn: number;
};

export type SymbolDependencyEdge = {
  id: string;
  kind: SymbolDependencyKind;
  direction: SymbolDependencyDirection;
  fromSymbolId: string;
  toSymbolId: string;
  callCount: number;
  locations: SymbolDependencyLocation[];
};

export type SymbolDependencyLocation = {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type SymbolDependencyResult = {
  schemaVersion: 1;
  source: "typescript-language-service";
  repoPath: string;
  symbolId: string;
  nodes: SymbolDependencyNode[];
  edges: SymbolDependencyEdge[];
  diagnostics: string[];
};

export type ResolveSymbolDependenciesOptions = {
  symbolId: string;
  maxIncoming?: number;
  maxOutgoing?: number;
};

type ParsedSymbolId = {
  filePath: string;
  kind: CodeSymbolKind;
  name: string;
  startLine: number;
};

const SOURCE_PATTERNS = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mts", "**/*.cts", "**/*.mjs", "**/*.cjs"];
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

export async function resolveSymbolDependencies(repoPath: string, options: ResolveSymbolDependenciesOptions): Promise<SymbolDependencyResult> {
  const repo = path.resolve(repoPath);
  const parsed = parseSymbolId(options.symbolId);
  const diagnostics: string[] = [];
  if (!parsed) {
    return emptyResult(repo, options.symbolId, ["Invalid symbolId"]);
  }

  const absoluteFilePath = path.join(repo, parsed.filePath);
  if (!ts.sys.fileExists(absoluteFilePath)) {
    return emptyResult(repo, options.symbolId, [`File not found: ${parsed.filePath}`]);
  }

  const project = await createLanguageServiceProject(repo);
  const sourceText = ts.sys.readFile(absoluteFilePath);
  if (!sourceText) {
    return emptyResult(repo, options.symbolId, [`File not readable: ${parsed.filePath}`]);
  }

  const position = findSymbolNamePosition(sourceText, absoluteFilePath, parsed);
  if (position === undefined) {
    return emptyResult(repo, options.symbolId, [`Symbol not found in working tree: ${options.symbolId}`]);
  }

  const prepared = project.languageService.prepareCallHierarchy(absoluteFilePath, position);
  const item = Array.isArray(prepared) ? prepared.find((candidate) => candidate.name === parsed.name) ?? prepared[0] : prepared;
  if (!item) {
    return emptyResult(repo, options.symbolId, [`Call hierarchy not available: ${options.symbolId}`]);
  }

  const nodeMap = new Map<string, SymbolDependencyNode>();
  const edgeMap = new Map<string, SymbolDependencyEdge>();
  const selectedNode = nodeFromCallHierarchyItem(repo, item, options.symbolId);
  nodeMap.set(selectedNode.id, selectedNode);

  const outgoing = project.languageService.provideCallHierarchyOutgoingCalls(absoluteFilePath, position).filter((call) => shouldIncludeCallHierarchyItem(repo, call.to)).slice(0, options.maxOutgoing ?? 24);
  for (const call of outgoing) {
    const target = nodeFromCallHierarchyItem(repo, call.to);
    nodeMap.set(target.id, target);
    const edge = {
      id: `call:${selectedNode.id}->${target.id}:outgoing`,
      kind: "call" as const,
      direction: "outgoing" as const,
      fromSymbolId: selectedNode.id,
      toSymbolId: target.id,
      callCount: call.fromSpans.length,
      locations: call.fromSpans.map((span) => locationFromTextSpan(repo, item.file, span)),
    };
    edgeMap.set(edge.id, edge);
  }

  const incoming = project.languageService.provideCallHierarchyIncomingCalls(absoluteFilePath, position).filter((call) => shouldIncludeCallHierarchyItem(repo, call.from)).slice(0, options.maxIncoming ?? 24);
  for (const call of incoming) {
    const source = nodeFromCallHierarchyItem(repo, call.from);
    nodeMap.set(source.id, source);
    const edge = {
      id: `call:${source.id}->${selectedNode.id}:incoming`,
      kind: "call" as const,
      direction: "incoming" as const,
      fromSymbolId: source.id,
      toSymbolId: selectedNode.id,
      callCount: call.fromSpans.length,
      locations: call.fromSpans.map((span) => locationFromTextSpan(repo, call.from.file, span)),
    };
    edgeMap.set(edge.id, edge);
  }

  return {
    schemaVersion: 1,
    source: "typescript-language-service",
    repoPath: repo,
    symbolId: options.symbolId,
    nodes: [...nodeMap.values()].sort((a, b) => a.filePath.localeCompare(b.filePath) || a.startLine - b.startLine || a.name.localeCompare(b.name)),
    edges: [...edgeMap.values()].sort((a, b) => a.direction.localeCompare(b.direction) || a.fromSymbolId.localeCompare(b.fromSymbolId) || a.toSymbolId.localeCompare(b.toSymbolId)),
    diagnostics,
  };
}

function emptyResult(repoPath: string, symbolId: string, diagnostics: string[]): SymbolDependencyResult {
  return {
    schemaVersion: 1,
    source: "typescript-language-service",
    repoPath,
    symbolId,
    nodes: [],
    edges: [],
    diagnostics,
  };
}

async function createLanguageServiceProject(repo: string) {
  const configPath = ts.findConfigFile(repo, ts.sys.fileExists, "tsconfig.json");
  const parsedConfig = configPath ? parseTsConfig(configPath) : await fallbackConfig(repo);
  const fileNames = parsedConfig.fileNames.map((file) => path.resolve(file));
  const versions = new Map(fileNames.map((file) => [file, "0"]));
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => parsedConfig.options,
    getScriptFileNames: () => fileNames,
    getScriptVersion: (fileName) => versions.get(path.resolve(fileName)) ?? "0",
    getScriptSnapshot: (fileName) => {
      if (!ts.sys.fileExists(fileName)) {
        return undefined;
      }
      const content = ts.sys.readFile(fileName);
      return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content);
    },
    getCurrentDirectory: () => repo,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };
  return {
    languageService: ts.createLanguageService(host),
  };
}

function parseTsConfig(configPath: string): ts.ParsedCommandLine {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  }
  return ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath), fallbackCompilerOptions());
}

async function fallbackConfig(repo: string): Promise<ts.ParsedCommandLine> {
  const fileNames = (
    await fg(SOURCE_PATTERNS, {
      cwd: repo,
      onlyFiles: true,
      unique: true,
      ignore: DEFAULT_IGNORES,
      absolute: true,
    })
  ).sort();
  return {
    options: fallbackCompilerOptions(),
    fileNames,
    errors: [],
    wildcardDirectories: {},
    compileOnSave: false,
  };
}

function fallbackCompilerOptions(): ts.CompilerOptions {
  return {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: false,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
  };
}

function parseSymbolId(symbolId: string): ParsedSymbolId | undefined {
  if (!symbolId.startsWith("symbol:")) {
    return undefined;
  }
  const parts = symbolId.slice("symbol:".length).split(":");
  if (parts.length < 4) {
    return undefined;
  }
  const startLineText = parts.pop();
  const name = parts.pop();
  const kind = parts.pop() as CodeSymbolKind | undefined;
  const filePath = parts.join(":");
  const startLine = Number(startLineText);
  if (!filePath || !name || !kind || !Number.isFinite(startLine)) {
    return undefined;
  }
  return {
    filePath,
    kind,
    name,
    startLine,
  };
}

function findSymbolNamePosition(content: string, fileName: string, parsed: ParsedSymbolId): number | undefined {
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  let fallback: number | undefined;

  for (const statement of sourceFile.statements) {
    const declaration = namedDeclarationFromTopLevelStatement(statement, parsed.name);
    if (!declaration) {
      continue;
    }
    const statementStartLine = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
    const name = declarationName(declaration);
    if (!name) {
      continue;
    }
    fallback ??= name.getStart(sourceFile);
    if (statementStartLine === parsed.startLine && declarationKind(declaration, statement) === parsed.kind) {
      return name.getStart(sourceFile);
    }
  }

  return fallback;
}

function namedDeclarationFromTopLevelStatement(statement: ts.Statement, name: string): ts.Declaration | undefined {
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)) &&
    statement.name?.text === name
  ) {
    return statement;
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name);
  }
  return undefined;
}

function declarationKind(declaration: ts.Declaration, statement: ts.Statement): CodeSymbolKind {
  if (ts.isFunctionDeclaration(declaration)) {
    return "function";
  }
  if (ts.isClassDeclaration(declaration)) {
    return "class";
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return "interface";
  }
  if (ts.isEnumDeclaration(declaration)) {
    return "enum";
  }
  if (ts.isTypeAliasDeclaration(declaration)) {
    return "type";
  }
  if (ts.isVariableDeclaration(declaration)) {
    const initializer = declaration.initializer;
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return "function";
    }
    if (initializer && ts.isClassExpression(initializer)) {
      return "class";
    }
  }
  void statement;
  return "variable";
}

function declarationName(declaration: ts.Declaration): ts.Identifier | undefined {
  if (
    (ts.isFunctionDeclaration(declaration) ||
      ts.isClassDeclaration(declaration) ||
      ts.isInterfaceDeclaration(declaration) ||
      ts.isEnumDeclaration(declaration) ||
      ts.isTypeAliasDeclaration(declaration)) &&
    declaration.name
  ) {
    return declaration.name;
  }
  if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
    return declaration.name;
  }
  return undefined;
}

function nodeFromCallHierarchyItem(repo: string, item: ts.CallHierarchyItem, forcedId?: string): SymbolDependencyNode {
  const relativePath = normalizePath(path.relative(repo, item.file));
  const sourceText = ts.sys.readFile(item.file) ?? "";
  const sourceFile = ts.createSourceFile(item.file, sourceText, ts.ScriptTarget.Latest, true, scriptKindFor(item.file));
  const line = sourceFile.getLineAndCharacterOfPosition(item.span.start);
  return {
    id: forcedId ?? symbolId(relativePath, callHierarchyKind(item.kind), item.name, line.line + 1),
    name: item.name,
    kind: item.kind,
    filePath: relativePath,
    startLine: line.line + 1,
    startColumn: line.character + 1,
  };
}

function shouldIncludeCallHierarchyItem(repo: string, item: ts.CallHierarchyItem): boolean {
  const relativePath = normalizePath(path.relative(repo, item.file));
  if (!relativePath || relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
    return false;
  }
  if (relativePath.endsWith(".d.ts")) {
    return false;
  }
  const parts = relativePath.split("/");
  return !parts.includes("node_modules") && !parts.includes(".codesprawl");
}

function locationFromTextSpan(repo: string, fileName: string, span: ts.TextSpan): SymbolDependencyLocation {
  const sourceText = ts.sys.readFile(fileName) ?? "";
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
  const start = sourceFile.getLineAndCharacterOfPosition(span.start);
  const end = sourceFile.getLineAndCharacterOfPosition(span.start + span.length);
  return {
    filePath: normalizePath(path.relative(repo, fileName)),
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

function callHierarchyKind(kind: string): CodeSymbolKind {
  switch (kind) {
    case ts.ScriptElementKind.classElement:
      return "class";
    case ts.ScriptElementKind.interfaceElement:
      return "interface";
    case ts.ScriptElementKind.enumElement:
      return "enum";
    case ts.ScriptElementKind.typeElement:
      return "type";
    case ts.ScriptElementKind.constElement:
    case ts.ScriptElementKind.letElement:
    case ts.ScriptElementKind.variableElement:
      return "variable";
    default:
      return "function";
  }
}

function symbolId(relativePath: string, kind: CodeSymbolKind, name: string, startLine: number): string {
  return `symbol:${relativePath}:${kind}:${name}:${startLine}`;
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
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
