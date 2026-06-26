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

// the unstable tsgo API publishes no usable types; these narrow the shapes used
type FileChanges =
  | { changed?: string[]; created?: string[]; deleted?: string[] }
  | { invalidateAll: true };
type SnapshotHandle = { getProjects(): readonly Project[] };
type ApiHandle = {
  updateSnapshot(params: { openProject: string } | { fileChanges: FileChanges }): SnapshotHandle;
  close?(): void;
};
type Resident = {
  api: ApiHandle;
  snapshot: SnapshotHandle;
  configs: Set<string>;
  idleTimer?: ReturnType<typeof setTimeout>;
};

/** Paths (absolute) that changed since the previous analysis of a repo. */
export type ReexportFileChanges = { changed?: string[]; created?: string[]; deleted?: string[] };

// One resident tsgo process per repo, reused across analyses so the ~90ms cold
// spawn is paid only once; warm re-analysis pushes only the changed files (~1ms)
// instead of re-spawning. The process is idle-closed and dies with the parent.
const residents = new Map<string, Resident>();
const IDLE_CLOSE_MS = 5 * 60_000;

function closeResident(repoRoot: string): void {
  const resident = residents.get(repoRoot);
  if (!resident) return;
  if (resident.idleTimer) clearTimeout(resident.idleTimer);
  try {
    resident.api.close?.();
  } catch {
    // process already gone
  }
  residents.delete(repoRoot);
}

// The resident procs also die with the parent; this just closes them a bit
// sooner on a clean exit, and keeps closeResident wired to a lifecycle.
function closeAllResidents(): void {
  for (const repoRoot of residents.keys()) closeResident(repoRoot);
}
if (typeof process !== "undefined") process.once("exit", closeAllResidents);

export async function resolveBarrelReexports(
  repoRoot: string,
  barrelAbsPaths: string[],
  tsconfigAbsPaths: string[],
  changes?: ReexportFileChanges,
): Promise<Map<string, Map<string, ReexportTarget>> | null> {
  if (tsconfigAbsPaths.length === 0 || barrelAbsPaths.length === 0) return null;

  // read fresh each call so a changed file reports its new line numbers
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

  try {
    let resident = residents.get(repoRoot);
    if (!resident) {
      // first analysis for this repo: spawn once, open each package project
      const api = new API({ cwd: repoRoot }) as unknown as ApiHandle;
      let snapshot: SnapshotHandle | undefined;
      for (const config of tsconfigAbsPaths) snapshot = api.updateSnapshot({ openProject: config });
      if (!snapshot) {
        api.close?.();
        return null;
      }
      resident = { api, snapshot, configs: new Set(tsconfigAbsPaths) };
      residents.set(repoRoot, resident);
    } else {
      // warm reuse: open any newly-seen package, then push the file changes —
      // no respawn. `openProject` replaces in place by config path (no leak).
      for (const config of tsconfigAbsPaths) {
        if (!resident.configs.has(config)) {
          resident.snapshot = resident.api.updateSnapshot({ openProject: config });
          resident.configs.add(config);
        }
      }
      const touched =
        (changes?.changed?.length ?? 0) +
        (changes?.created?.length ?? 0) +
        (changes?.deleted?.length ?? 0);
      if (!changes) {
        // no diff info — re-evaluate everything (still no spawn)
        resident.snapshot = resident.api.updateSnapshot({ fileChanges: { invalidateAll: true } });
      } else if (touched > 0) {
        resident.snapshot = resident.api.updateSnapshot({ fileChanges: changes });
      }
    }

    // idle-close the process; unref so the timer never keeps the loop alive
    if (resident.idleTimer) clearTimeout(resident.idleTimer);
    resident.idleTimer = setTimeout(() => closeResident(repoRoot), IDLE_CLOSE_MS);
    resident.idleTimer.unref?.();

    const projects = resident.snapshot.getProjects();
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
    closeResident(repoRoot); // broken state → drop the resident and fall back
    return null;
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
