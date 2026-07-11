import { computeGraphMetrics, matchWorkspacePackage } from "@sprawlens/schema";
import type {
  CodeEdge,
  CodeNode,
  CodeSymbol,
  CodeSymbolKind,
  Snapshot,
  SnapshotCommit,
  WorkspacePackage,
} from "@sprawlens/schema";

export type GitHubRepo = { owner: string; repo: string };
export type RemoteFile = { path: string; content: string; sizeBytes: number };

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const TEXT = new TextDecoder();
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".go",
  ".rs",
  ".mbt",
]);
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const MANIFESTS = new Set([
  "package.json",
  "go.mod",
  "Cargo.toml",
  "moon.pkg",
  "moon.pkg.json",
  "moon.mod",
  "moon.mod.json",
]);
const IGNORE_SEGMENTS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "target",
  "vendor",
  "testdata",
  ".next",
  ".turbo",
]);
const MAX_FILES = 650;
const MAX_FILE_BYTES = 220_000;

export function normalizeGitHubRepo(input: string): GitHubRepo | null {
  const raw = input.trim().replace(/\.git$/, "");
  let owner = "";
  let repo = "";
  if (/^https?:\/\//.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    [owner = "", repo = ""] = parts;
  } else {
    const parts = raw.split("/");
    if (parts.length !== 2) return null;
    [owner = "", repo = ""] = parts;
  }
  const safe = /^[A-Za-z0-9_.-]+$/;
  if (!safe.test(owner) || !safe.test(repo)) return null;
  if (owner.startsWith(".") || repo.startsWith(".")) return null;
  return { owner, repo };
}

function cleanPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === ".." || IGNORE_SEGMENTS.has(part))) {
    return null;
  }
  return parts.join("/");
}

function extOf(path: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? path.slice(dot) : "";
}

function baseName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(0, slash) : "";
}

function isCodeFile(path: string): boolean {
  return SOURCE_EXTENSIONS.has(extOf(path));
}

function isCandidate(path: string, size = 0): boolean {
  if (size > MAX_FILE_BYTES) return false;
  const clean = cleanPath(path);
  if (!clean) return false;
  return isCodeFile(clean) || MANIFESTS.has(baseName(clean));
}

function lineCount(content: string): number {
  return Math.max(content.split("\n").length, 1);
}

function symbolId(
  file: string,
  kind: CodeSymbolKind,
  name: string,
  line: number,
  parentClass?: string,
): string {
  return `symbol:${file}:${kind}:${parentClass ? `${parentClass}.${name}` : name}:${line}`;
}

function exportedName(name: string): boolean {
  return name.length > 0 && name[0] === name[0]!.toUpperCase() && /[A-Z]/.test(name[0]!);
}

function blockEnd(lines: readonly string[], startIndex: number): number {
  let depth = 0;
  let sawBrace = false;
  for (let i = startIndex; i < lines.length; i++) {
    for (const ch of lines[i] ?? "") {
      if (ch === "{") {
        depth++;
        sawBrace = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    if (sawBrace && depth <= 0) return i + 1;
  }
  return startIndex + 1;
}

function complexityOf(text: string): number {
  const matches = text.match(/\b(if|for|while|case|catch|match|select)\b|\?\s|&&|\|\|/g);
  return 1 + (matches?.length ?? 0);
}

function makeSymbol(
  file: string,
  kind: CodeSymbolKind,
  name: string,
  lines: readonly string[],
  startIndex: number,
  exported: boolean,
  parentClass?: string,
): CodeSymbol {
  const endLine = blockEnd(lines, startIndex);
  const body = lines.slice(startIndex, endLine).join("\n");
  const startLine = startIndex + 1;
  return {
    id: symbolId(file, kind, name, startLine, parentClass),
    kind,
    name,
    startLine,
    endLine,
    loc: Math.max(endLine - startLine + 1, 1),
    complexity: complexityOf(body),
    exported,
    ...(parentClass ? { parentClass } : {}),
  };
}

function extractSymbols(file: string, content: string): CodeSymbol[] {
  const ext = extOf(file);
  const lines = content.split("\n");
  const symbols: CodeSymbol[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let match: RegExpMatchArray | null = null;
    if (ext === ".go") {
      match = line.match(/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (match) {
        symbols.push(makeSymbol(file, "function", match[1]!, lines, i, exportedName(match[1]!)));
        continue;
      }
      match = line.match(/^\s*type\s+([A-Za-z_][A-Za-z0-9_]*)\s+(struct|interface)?/);
      if (match) {
        const kind =
          match[2] === "struct" ? "class" : match[2] === "interface" ? "interface" : "type";
        symbols.push(makeSymbol(file, kind, match[1]!, lines, i, exportedName(match[1]!)));
      }
      continue;
    }
    if (ext === ".rs") {
      match = line.match(/^\s*(pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (match) {
        symbols.push(makeSymbol(file, "function", match[2]!, lines, i, !!match[1]));
        continue;
      }
      match = line.match(/^\s*(pub\s+)?(struct|enum|trait|type)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (match) {
        const kind = match[2] === "struct" ? "class" : match[2] === "trait" ? "interface" : "type";
        symbols.push(makeSymbol(file, kind, match[3]!, lines, i, !!match[1]));
        continue;
      }
      match = line.match(/^\s*macro_rules!\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (match) symbols.push(makeSymbol(file, "macro", match[1]!, lines, i, true));
      continue;
    }
    if (ext === ".mbt") {
      match = line.match(
        /^\s*(pub\s+)?fn\s+(?:([A-Za-z_][A-Za-z0-9_]*)::)?([A-Za-z_][A-Za-z0-9_]*)/,
      );
      if (match) {
        symbols.push(
          makeSymbol(
            file,
            match[2] ? "method" : "function",
            match[3]!,
            lines,
            i,
            !!match[1],
            match[2],
          ),
        );
        continue;
      }
      match = line.match(/^\s*(pub\s+)?(struct|enum|trait|type!?)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (match) {
        const kind =
          match[2] === "struct"
            ? "class"
            : match[2] === "enum"
              ? "enum"
              : match[2] === "trait"
                ? "interface"
                : "type";
        symbols.push(makeSymbol(file, kind, match[3]!, lines, i, !!match[1]));
      }
      continue;
    }
    match = line.match(/^\s*(export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
    if (match) {
      symbols.push(makeSymbol(file, "function", match[2]!, lines, i, !!match[1]));
      continue;
    }
    match = line.match(/^\s*(export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (match) {
      symbols.push(makeSymbol(file, "class", match[2]!, lines, i, !!match[1]));
      continue;
    }
    match = line.match(/^\s*export\s+(interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (match) {
      const kind = match[1] === "interface" ? "interface" : match[1] === "enum" ? "enum" : "type";
      symbols.push(makeSymbol(file, kind, match[2]!, lines, i, true));
      continue;
    }
    match = line.match(/^\s*(export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (match) symbols.push(makeSymbol(file, "variable", match[2]!, lines, i, !!match[1]));
  }
  return symbols;
}

function tsImports(content: string): string[] {
  const specs = new Set<string>();
  const patterns = [
    /\bimport\s+(?:[^'"()]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^'"()]+?\s+from\s+["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) specs.add(match[1]!);
  }
  return [...specs];
}

function goImports(content: string): string[] {
  const specs = new Set<string>();
  for (const match of content.matchAll(/\bimport\s+(?:[A-Za-z_.]+\s+)?["`]([^"`]+)["`]/g)) {
    specs.add(match[1]!);
  }
  for (const block of content.matchAll(/\bimport\s*\(([\s\S]*?)\)/g)) {
    for (const line of block[1]!.split("\n")) {
      const match = line.match(/^\s*(?:[A-Za-z_.]+\s+)?["`]([^"`]+)["`]/);
      if (match) specs.add(match[1]!);
    }
  }
  return [...specs];
}

function parseJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function packageEntry(dir: string, json: Record<string, unknown>): string {
  const exportsValue = json.exports;
  const dot =
    exportsValue && typeof exportsValue === "object"
      ? (exportsValue as Record<string, unknown>)["."]
      : exportsValue;
  const fromExports =
    typeof dot === "string"
      ? dot
      : dot && typeof dot === "object"
        ? ((dot as Record<string, string>).types ??
          (dot as Record<string, string>).import ??
          (dot as Record<string, string>).default)
        : undefined;
  const raw = String(json.types ?? fromExports ?? json.module ?? json.main ?? "src/index.ts");
  return [dir, raw.replace(/^\.\//, "")].filter(Boolean).join("/");
}

function detectNpmPackages(files: readonly RemoteFile[]): {
  packages: WorkspacePackage[];
  entryByName: Map<string, string>;
} {
  const packages: WorkspacePackage[] = [];
  const entryByName = new Map<string, string>();
  for (const file of files) {
    if (baseName(file.path) !== "package.json") continue;
    const json = parseJson(file.content);
    if (!json) continue;
    const name = typeof json?.name === "string" ? json.name : null;
    if (!name) continue;
    const dir = dirname(file.path);
    packages.push({ name, sourceRoot: dir });
    entryByName.set(name, packageEntry(dir, json));
  }
  packages.sort((a, b) => b.name.length - a.name.length);
  return { packages, entryByName };
}

function goModulePath(content: string): string | null {
  const match = content.match(/^\s*module\s+(\S+)/m);
  return match ? match[1]! : null;
}

function detectGoPackages(files: readonly RemoteFile[]): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];
  for (const file of files) {
    if (baseName(file.path) !== "go.mod") continue;
    const name = goModulePath(file.content);
    if (!name) continue;
    packages.push({ name, sourceRoot: dirname(file.path) });
  }
  packages.sort((a, b) => b.name.length - a.name.length);
  return packages;
}

function moonbitPkgImports(content: string): MoonbitPackageImport[] {
  return content.trimStart().startsWith("{")
    ? moonbitPkgImportsJson(content)
    : moonbitPkgImportsDsl(content);
}

function moonbitPkgImportsJson(content: string): MoonbitPackageImport[] {
  const json = parseJson(content);
  const list = Array.isArray(json?.import) ? json.import : [];
  const out: MoonbitPackageImport[] = [];
  for (const entry of list) {
    let path = "";
    let alias = "";
    if (typeof entry === "string") {
      path = entry;
    } else if (entry && typeof entry === "object" && "path" in entry) {
      path = String((entry as { path: unknown }).path);
      const rawAlias = (entry as { alias?: unknown }).alias;
      if (typeof rawAlias === "string") alias = rawAlias;
    }
    if (path) out.push({ path, alias: alias || path.split("/").pop() || path });
  }
  return out;
}

function moonbitPkgImportsDsl(content: string): MoonbitPackageImport[] {
  const out: MoonbitPackageImport[] = [];
  const block = /import\s*\{([\s\S]*?)\}(\s*for\b[^\n]*)?/g;
  const entry = /"([^"]+)"(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = block.exec(content))) {
    if (blockMatch[2]) continue;
    entry.lastIndex = 0;
    let entryMatch: RegExpExecArray | null;
    while ((entryMatch = entry.exec(blockMatch[1]!))) {
      const path = entryMatch[1]!;
      out.push({ path, alias: entryMatch[2] || path.split("/").pop() || path });
    }
  }
  return out;
}

function moonbitModuleName(files: readonly RemoteFile[]): string {
  const jsonFile = files.find((file) => file.path === "moon.mod.json");
  if (jsonFile) {
    const json = parseJson(jsonFile.content);
    if (typeof json?.name === "string") return json.name;
  }
  const tomlFile = files.find((file) => file.path === "moon.mod");
  const match = tomlFile?.content.match(/^\s*name\s*=\s*"([^"]+)"/m);
  return match ? match[1]! : "";
}

function detectMoonbitPackages(files: readonly RemoteFile[]): {
  packages: WorkspacePackage[];
  importsByDir: Map<string, MoonbitPackageImport[]>;
} {
  const moduleName = moonbitModuleName(files);
  const importsByDir = new Map<string, MoonbitPackageImport[]>();
  for (const file of files) {
    const name = baseName(file.path);
    if (name !== "moon.pkg" && name !== "moon.pkg.json") continue;
    importsByDir.set(dirname(file.path), moonbitPkgImports(file.content));
  }
  return {
    packages: moduleName ? [{ name: moduleName, sourceRoot: "" }] : [],
    importsByDir,
  };
}

function resolvePath(base: string, spec: string, fileSet: ReadonlySet<string>): string | null {
  const raw = [base, spec].filter(Boolean).join("/");
  const parts: string[] = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const path = parts.join("/");
  const candidates = [
    path,
    ...RESOLVE_EXTENSIONS.map((ext) => `${path}${ext}`),
    ...RESOLVE_EXTENSIONS.map((ext) => `${path}/index${ext}`),
  ];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function importEdge(from: string, to: string, specifier: string, resolved = true): CodeEdge {
  return {
    id: `imports:${from}->${to}:${specifier}`,
    type: "imports",
    from,
    to,
    specifier,
    resolved,
    ...(resolved ? {} : { external: true }),
  };
}

function tarString(bytes: Uint8Array, start: number, length: number): string {
  const slice = bytes.slice(start, start + length);
  const end = slice.indexOf(0);
  return TEXT.decode(end >= 0 ? slice.slice(0, end) : slice).trim();
}

export function parseTarEntries(bytes: Uint8Array): RemoteFile[] {
  const files: RemoteFile[] = [];
  for (let offset = 0; offset + 512 <= bytes.length; ) {
    const header = bytes.slice(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const rawName = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const name = [prefix, rawName].filter(Boolean).join("/");
    const size = Number.parseInt(tarString(header, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 0);
    offset += 512;
    const data = bytes.slice(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    if (type !== "0" && type !== "\0") continue;
    const withoutRoot = name.split("/").slice(1).join("/");
    const path = cleanPath(withoutRoot);
    if (!path) continue;
    files.push({ path, content: TEXT.decode(data), sizeBytes: size });
  }
  return files;
}

async function fetchJson<T>(fetcher: FetchLike, url: string, token?: string): Promise<T> {
  const res = await fetcher(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "sprawlens-worker",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub request failed: ${res.status}${text ? ` ${text.slice(0, 240)}` : ""}`);
  }
  return (await res.json()) as T;
}

type RepoResponse = { default_branch: string; pushed_at?: string };
type TreeResponse = {
  truncated?: boolean;
  tree: Array<{ path: string; type: string; size?: number }>;
};
type MoonbitPackageImport = { path: string; alias: string };

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: Array<R | null> = Array.from({ length: items.length }, () => null);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const current = index++;
      const item = items[current];
      if (item === undefined) return;
      out[current] = await fn(item);
    }
  });
  await Promise.all(workers);
  return out.filter((value): value is R => value !== null);
}

function rawUrl(repo: GitHubRepo, ref: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${encodeURIComponent(ref)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export async function fetchGitHubRemoteFiles(
  repoInput: string,
  options: { fetcher?: FetchLike; token?: string; maxFiles?: number } = {},
): Promise<{ repo: GitHubRepo; ref: string; files: RemoteFile[]; pushedAt?: string }> {
  const repo = normalizeGitHubRepo(repoInput);
  if (!repo) throw new Error("invalid GitHub repo");
  const fetcher = options.fetcher ?? fetch;
  const apiBase = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;
  const meta = await fetchJson<RepoResponse>(fetcher, apiBase, options.token);
  const ref = meta.default_branch;
  const tree = await fetchJson<TreeResponse>(
    fetcher,
    `${apiBase}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    options.token,
  );
  if (tree.truncated) throw new Error("repository tree is too large for the lightweight worker");
  const entries = tree.tree
    .filter((entry) => entry.type === "blob" && isCandidate(entry.path, entry.size ?? 0))
    .slice(0, options.maxFiles ?? MAX_FILES);
  const files = await mapLimit(entries, 8, async (entry): Promise<RemoteFile | null> => {
    const res = await fetcher(rawUrl(repo, ref, entry.path));
    if (!res.ok) return null;
    const content = await res.text();
    return {
      path: entry.path,
      content,
      sizeBytes: entry.size ?? new TextEncoder().encode(content).length,
    };
  });
  return { repo, ref, files, pushedAt: meta.pushed_at };
}

export async function snapshotFromGitHubRepo(
  repoInput: string,
  options: { fetcher?: FetchLike; token?: string } = {},
): Promise<Snapshot> {
  const downloaded = await fetchGitHubRemoteFiles(repoInput, options);
  return snapshotFromRemoteFiles(downloaded.files, {
    repo: `${downloaded.repo.owner}/${downloaded.repo.repo}`,
    ref: downloaded.ref,
    timestamp: downloaded.pushedAt,
  });
}

export function snapshotFromRemoteFiles(
  inputFiles: readonly RemoteFile[],
  options: { repo: string; ref?: string; timestamp?: string },
): Snapshot {
  const files = inputFiles
    .map((file) => ({ ...file, path: cleanPath(file.path) ?? "" }))
    .filter((file) => file.path && isCandidate(file.path, file.sizeBytes));
  const codeFiles = files.filter((file) => isCodeFile(file.path));
  const codeByPath = new Map(codeFiles.map((file) => [file.path, file]));
  const fileSet = new Set(codeByPath.keys());
  const { packages: npmPackages, entryByName } = detectNpmPackages(files);
  const goPackages = detectGoPackages(files);
  const { packages: moonbitPackages, importsByDir: moonbitImportsByDir } =
    detectMoonbitPackages(files);
  const goFilesByDir = new Map<string, string[]>();
  for (const file of codeFiles.filter((file) => extOf(file.path) === ".go")) {
    const dir = dirname(file.path);
    const list = goFilesByDir.get(dir);
    if (list) list.push(file.path);
    else goFilesByDir.set(dir, [file.path]);
  }
  const moonbitFilesByDir = new Map<string, string[]>();
  for (const file of codeFiles.filter((file) => extOf(file.path) === ".mbt")) {
    const dir = dirname(file.path);
    const list = moonbitFilesByDir.get(dir);
    if (list) list.push(file.path);
    else moonbitFilesByDir.set(dir, [file.path]);
  }

  const nodes: CodeNode[] = [{ id: "repo", type: "repo", name: options.repo }];
  const edges: CodeEdge[] = [];
  const dirs = new Set<string>();
  for (const file of codeFiles) {
    const parts = dirname(file.path).split("/").filter(Boolean);
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      dirs.add(acc);
    }
  }
  for (const dir of [...dirs].sort()) nodes.push({ id: `dir:${dir}`, type: "dir", path: dir });

  for (const file of codeFiles) {
    const id = `file:${file.path}`;
    nodes.push({
      id,
      type: "file",
      path: file.path,
      ext: extOf(file.path),
      loc: lineCount(file.content),
      sizeBytes: file.sizeBytes,
      symbols: extractSymbols(file.path, file.content),
    });
    const dir = dirname(file.path);
    edges.push({
      id: `contains:${dir ? `dir:${dir}` : "repo"}->${id}`,
      type: "contains",
      from: dir ? `dir:${dir}` : "repo",
      to: id,
    });
  }
  for (const dir of dirs) {
    const parent = dirname(dir);
    edges.push({
      id: `contains:${parent ? `dir:${parent}` : "repo"}->dir:${dir}`,
      type: "contains",
      from: parent ? `dir:${parent}` : "repo",
      to: `dir:${dir}`,
    });
  }

  for (const file of codeFiles) {
    const from = `file:${file.path}`;
    if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extOf(file.path))) {
      for (const spec of tsImports(file.content)) {
        let target: string | null = null;
        if (spec.startsWith(".")) {
          target = resolvePath(dirname(file.path), spec, fileSet);
        } else {
          const matched = matchWorkspacePackage(npmPackages, spec);
          if (matched) {
            const base =
              matched.subpath === ""
                ? entryByName.get(matched.pkg.name)
                : [matched.pkg.sourceRoot, matched.subpath].filter(Boolean).join("/");
            target = base ? resolvePath("", base, fileSet) : null;
          }
        }
        edges.push(
          target
            ? importEdge(from, `file:${target}`, spec)
            : importEdge(from, `external:${spec}`, spec, false),
        );
      }
    }
    if (extOf(file.path) === ".go") {
      for (const spec of goImports(file.content)) {
        const matched = matchWorkspacePackage(goPackages, spec);
        const localDir = matched
          ? [matched.pkg.sourceRoot, matched.subpath].filter(Boolean).join("/")
          : null;
        const targets = localDir ? (goFilesByDir.get(localDir) ?? []) : [];
        if (targets.length === 0) {
          edges.push(importEdge(from, `external:${spec}`, spec, false));
          continue;
        }
        for (const target of targets) {
          if (target !== file.path) edges.push(importEdge(from, `file:${target}`, spec));
        }
      }
    }
    if (extOf(file.path) === ".mbt") {
      const seenSpecs = new Set<string>();
      for (const imp of moonbitImportsByDir.get(dirname(file.path)) ?? []) {
        if (seenSpecs.has(imp.path)) continue;
        seenSpecs.add(imp.path);
        const matched = matchWorkspacePackage(moonbitPackages, imp.path);
        const localDir = matched
          ? [matched.pkg.sourceRoot, matched.subpath].filter(Boolean).join("/")
          : null;
        const targets = localDir
          ? (moonbitFilesByDir.get(localDir) ?? []).filter(
              (target) => !/_(test|wbtest)\.mbt$/.test(target),
            )
          : [];
        if (targets.length === 0) {
          edges.push(importEdge(from, `external:${imp.path}`, imp.path, false));
          continue;
        }
        for (const target of targets) {
          if (target !== file.path) edges.push(importEdge(from, `file:${target}`, imp.path));
        }
      }
    }
  }

  const { metrics } = computeGraphMetrics(nodes, edges);
  const commit: SnapshotCommit = {
    hash: options.ref ?? "REMOTE",
    shortHash: (options.ref ?? "remote").slice(0, 12),
    timestamp: options.timestamp ?? new Date(0).toISOString(),
    authorName: "GitHub",
    message: `Remote snapshot of ${options.repo}`,
    aiIndicators: [],
  };
  return {
    schemaVersion: 1,
    repoPath: `github:${options.repo}`,
    commit,
    nodes,
    edges,
    metrics: { ...metrics, loc: metrics.loc },
  };
}
