export type AstDiffRepositoryChangedFile = {
  status: "modified" | "added" | "deleted" | "renamed" | "copied";
  beforePath: string | null;
  afterPath: string | null;
};

export type AstDiffRepositoryDevelopmentManifest = {
  schemaVersion: 1;
  datasetId: "ast-diff-confirmatory-v1-phase1";
  cases: Array<{
    id: string;
    repository: string;
    repositoryPath: string;
    beforeRevision: string;
    afterRevision: string;
  }>;
};

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"] as const;

const IGNORED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".git",
  ".codesprawl",
  "vendor",
  "vendors",
  "third_party",
  "third-party",
  "fixtures",
  "__fixtures__",
]);

/** The repository benchmark must never consume the blinded v2 holdout. */
export function parseAstDiffRepositoryDevelopmentManifest(
  value: unknown,
): AstDiffRepositoryDevelopmentManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("development manifest must be an object");
  }
  const root = value as Record<string, unknown>;
  if (root.schemaVersion !== 1) throw new Error("development manifest schemaVersion must be 1");
  if (root.datasetId !== "ast-diff-confirmatory-v1-phase1") {
    throw new Error("only the fixed v1 development corpus is allowed; holdout input is forbidden");
  }
  if (!Array.isArray(root.cases) || root.cases.length === 0) {
    throw new Error("development manifest cases must be a non-empty array");
  }
  const ids = new Set<string>();
  const cases = root.cases.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`development manifest cases[${index}] must be an object`);
    }
    const item = value as Record<string, unknown>;
    const parsed = {
      id: requiredString(item.id, `cases[${index}].id`),
      repository: requiredString(item.repository, `cases[${index}].repository`),
      repositoryPath: requiredString(item.repositoryPath, `cases[${index}].repositoryPath`),
      beforeRevision: requiredString(item.beforeRevision, `cases[${index}].beforeRevision`),
      afterRevision: requiredString(item.afterRevision, `cases[${index}].afterRevision`),
    };
    if (ids.has(parsed.id)) throw new Error(`duplicate development case: ${parsed.id}`);
    ids.add(parsed.id);
    return parsed;
  });
  return {
    schemaVersion: 1,
    datasetId: root.datasetId,
    cases,
  };
}

/**
 * Parse `git diff --name-status` while fixing the source-file inclusion rule
 * before a repository benchmark is run. A rename is retained when either
 * side is analyzable so source additions/removals are not silently lost.
 */
export function parseAstDiffRepositoryChangedFiles(output: string): AstDiffRepositoryChangedFile[] {
  const files: AstDiffRepositoryChangedFile[] = [];
  for (const line of output.split("\n")) {
    if (!line) continue;
    const fields = line.split("\t");
    const rawStatus = fields[0] ?? "";
    const code = rawStatus[0];
    let file: AstDiffRepositoryChangedFile;
    if (code === "M" || code === "T") {
      const path = requiredPath(fields[1], line);
      file = { status: "modified", beforePath: path, afterPath: path };
    } else if (code === "A") {
      file = { status: "added", beforePath: null, afterPath: requiredPath(fields[1], line) };
    } else if (code === "D") {
      file = { status: "deleted", beforePath: requiredPath(fields[1], line), afterPath: null };
    } else if (code === "R" || code === "C") {
      file = {
        status: code === "R" ? "renamed" : "copied",
        beforePath: requiredPath(fields[1], line),
        afterPath: requiredPath(fields[2], line),
      };
    } else {
      throw new Error(`unsupported git name-status row: ${line}`);
    }
    if (
      (file.beforePath && isAstDiffRepositorySourcePath(file.beforePath)) ||
      (file.afterPath && isAstDiffRepositorySourcePath(file.afterPath))
    ) {
      files.push(file);
    }
  }
  return files;
}

export function isAstDiffRepositorySourcePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  if (/\.d\.(?:ts|mts|cts)$/.test(lower)) return false;
  if (!SOURCE_EXTENSIONS.some((extension) => lower.endsWith(extension))) return false;
  const segments = lower.split("/");
  if (segments.some((segment) => IGNORED_SEGMENTS.has(segment))) return false;
  for (let index = 1; index < segments.length; index += 1) {
    if (
      segments[index] === "assets" &&
      ["test", "tests", "__tests__"].includes(segments[index - 1]!)
    ) {
      return false;
    }
  }
  return true;
}

function requiredPath(value: string | undefined, row: string): string {
  if (!value) throw new Error(`malformed git name-status row: ${row}`);
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}
