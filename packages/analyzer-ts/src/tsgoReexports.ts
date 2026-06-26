import { readFileSync } from "node:fs";
import path from "node:path";
import { API } from "@typescript/native-preview/unstable/sync";

/**
 * Build-aware re-export precision via tsgo (`@typescript/native-preview`).
 *
 * The syntactic pass resolves only one hop of a re-export and skips `export *`,
 * so barrel files (`index.ts` doing `export * from "./x"`) lose every symbol —
 * and most cross-package imports go through a barrel. Here the tsgo type checker
 * follows each barrel's exports to their original declaration (file + line),
 * expanding `export *`, chasing transitive chains, and tracking `as` renames.
 *
 * tsgo has no `getAliasedSymbol`, so this is a hybrid: `getExports()` lists a
 * module's exports but leaves `export *` as a synthetic marker and named
 * re-exports as alias symbols, both unresolved. `export *` is expanded by
 * walking the file's AST for `export * from "x"` and recursing into x; a named
 * re-export is followed via its `ExportSpecifier`'s module specifier back to the
 * original name. Returns null (caller falls back to the syntactic resolver) when
 * the repo isn't built into tsconfig projects or tsgo can't start.
 */

// symbol flags from @typescript/native-preview/dist/enums/symbolFlags.enum.js
const FLAG_ALIAS = 2097152; // named re-export (export { x } from ...)
const FLAG_EXPORT_STAR = 8388608; // synthetic marker for export * from ...
const KIND_EXPORT_DECLARATION = 279; // SyntaxKind.ExportDeclaration in tsgo's AST

export type ReexportTarget = {
  /** repo-relative file of the original declaration */
  file: string;
  /** 1-based line of the declaration's name token */
  line: number;
  /** original name for `export { a as b } from`, when renamed */
  renamedFrom?: string;
};

// The unstable tsgo API ships loose AST/symbol shapes; these capture just the
// fields used here. RemoteSourceFile getters like `.modifiers`/`.getStart()`
// crash on decode, so they are deliberately never touched.
type RemoteNode = { pos: number; name?: { pos: number } };
type DeclHandle = { path: string; kind: number; resolve(project: unknown): RemoteNode | undefined };
type Sym = {
  name: string;
  flags: number;
  declarations?: DeclHandle[];
  valueDeclaration?: DeclHandle;
  getExports(): Sym[];
};

function lineOf(content: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < pos && i < content.length; i++) if (content[i] === "\n") line++;
  return line;
}

export async function resolveBarrelReexports(
  repoRoot: string,
  barrelAbsPaths: string[],
  tsconfigAbsPaths: string[],
): Promise<Map<string, Map<string, ReexportTarget>> | null> {
  if (tsconfigAbsPaths.length === 0 || barrelAbsPaths.length === 0) return null;

  const fileCache = new Map<string, string>();
  const readFile = (file: string): string => {
    let content = fileCache.get(file);
    if (content === undefined) {
      try {
        content = readFileSync(file, "utf8");
      } catch {
        content = "";
      }
      fileCache.set(file, content);
    }
    return content;
  };
  // tsgo lowercases the drive/root on case-insensitive filesystems (/Users ->
  // /users), so a plain path.relative breaks; strip the repo prefix case-
  // insensitively (the suffix keeps its real case and matches the file nodes).
  const rootPosix = repoRoot.split(path.sep).join("/");
  const rootLower = rootPosix.toLowerCase();
  const rel = (abs: string): string => {
    const posix = abs.split(path.sep).join("/");
    if (posix.toLowerCase().startsWith(rootLower)) {
      return posix.slice(rootPosix.length).replace(/^\/+/, "");
    }
    return posix;
  };

  // the unstable tsgo API publishes no usable types for these project/snapshot
  // handles, so they are described inline and used through narrow shapes
  let api: { updateSnapshot(p: { openProject: string }): unknown; close?(): void } | undefined;
  try {
    api = new API({ cwd: repoRoot }) as typeof api;
    let snapshot: unknown;
    for (const config of tsconfigAbsPaths) snapshot = api!.updateSnapshot({ openProject: config });
    const projects = (snapshot as { getProjects(): Project[] }).getProjects();
    if (projects.length === 0) return null;

    const result = new Map<string, Map<string, ReexportTarget>>();
    for (const barrel of barrelAbsPaths) {
      const project = projects.find((p) => p.program.getSourceFile(barrel));
      if (!project) continue;
      const resolved = resolveModule(project, barrel, new Set(), readFile, rel);
      if (resolved.size > 0) result.set(rel(barrel), resolved);
    }
    return result;
  } catch {
    return null; // tsgo missing / not built / API shape changed → syntactic fallback
  } finally {
    api?.close?.();
  }
}

type Project = {
  checker: Checker;
  program: { getSourceFile(file: string): RemoteSourceFile | undefined };
};
type Checker = {
  getSymbolAtLocation(node: unknown): Sym | undefined;
  getSymbolAtPosition(file: string, pos: number): Sym | undefined;
};
type RemoteSourceFile = { statements: RemoteStatement[] };
type RemoteStatement = {
  kind: number;
  exportClause?: { elements?: ExportSpecifier[] } | undefined;
  moduleSpecifier?: { pos: number };
};
type ExportSpecifier = { name?: { text: string }; propertyName?: { text: string } };

/** Original-declaration file:line of a non-alias, non-star export symbol. */
function declSite(
  sym: Sym,
  project: Project,
  readFile: (file: string) => string,
  rel: (abs: string) => string,
): ReexportTarget | null {
  const decl = sym.valueDeclaration ?? sym.declarations?.[0];
  if (!decl) return null;
  const node = decl.resolve(project);
  const pos = node?.name?.pos ?? node?.pos ?? 0;
  return { file: rel(decl.path), line: lineOf(readFile(decl.path), pos) };
}

/** The target-module files of every `export * from "..."` in `file`. */
function starTargets(checker: Checker, sourceFile: RemoteSourceFile, file: string): string[] {
  const targets: string[] = [];
  for (const statement of sourceFile.statements) {
    if (
      statement.kind === KIND_EXPORT_DECLARATION &&
      !statement.exportClause &&
      statement.moduleSpecifier
    ) {
      const moduleSym = checker.getSymbolAtPosition(file, statement.moduleSpecifier.pos + 1);
      const targetFile = moduleSym?.declarations?.[0]?.path ?? moduleSym?.valueDeclaration?.path;
      if (targetFile) targets.push(targetFile);
    }
  }
  return targets;
}

/** Follow a named re-export alias (`export { local as exported } from "x"`). */
function followAlias(
  checker: Checker,
  project: Project,
  sym: Sym,
  exportedName: string,
  recurse: (file: string) => Map<string, ReexportTarget>,
): ReexportTarget | null {
  const decl = sym.declarations?.[0];
  if (!decl) return null;
  const sourceFile = project.program.getSourceFile(decl.path);
  for (const statement of sourceFile?.statements ?? []) {
    if (
      statement.kind !== KIND_EXPORT_DECLARATION ||
      !statement.exportClause?.elements ||
      !statement.moduleSpecifier
    ) {
      continue;
    }
    for (const element of statement.exportClause.elements) {
      if (element.name?.text !== exportedName) continue;
      const moduleSym = checker.getSymbolAtPosition(decl.path, statement.moduleSpecifier.pos + 1);
      const targetFile = moduleSym?.declarations?.[0]?.path ?? moduleSym?.valueDeclaration?.path;
      if (!targetFile) return null;
      const localName = element.propertyName?.text ?? exportedName;
      const origin = recurse(targetFile).get(localName);
      if (!origin) return null;
      return { ...origin, renamedFrom: element.propertyName ? localName : origin.renamedFrom };
    }
  }
  return null;
}

/** Resolved exports of a module: export name → original declaration site. */
function resolveModule(
  project: Project,
  file: string,
  seen: Set<string>,
  readFile: (file: string) => string,
  rel: (abs: string) => string,
): Map<string, ReexportTarget> {
  const out = new Map<string, ReexportTarget>();
  if (seen.has(file)) return out; // guard re-export cycles
  seen.add(file);
  const sourceFile = project.program.getSourceFile(file);
  if (!sourceFile) return out;
  const moduleSym = project.checker.getSymbolAtLocation(sourceFile);
  if (!moduleSym) return out;

  for (const sym of moduleSym.getExports()) {
    const name = sym.name;
    if (sym.flags & FLAG_EXPORT_STAR) {
      for (const targetFile of starTargets(project.checker, sourceFile, file)) {
        for (const [exportName, target] of resolveModule(
          project,
          targetFile,
          seen,
          readFile,
          rel,
        )) {
          if (!out.has(exportName)) out.set(exportName, target);
        }
      }
      continue;
    }
    if (sym.flags & FLAG_ALIAS) {
      const origin = followAlias(project.checker, project, sym, name, (targetFile) =>
        resolveModule(project, targetFile, seen, readFile, rel),
      );
      if (origin) out.set(name, origin);
      continue;
    }
    const site = declSite(sym, project, readFile, rel);
    if (site) out.set(name, site);
  }
  return out;
}
