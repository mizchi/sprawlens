export type AstDiffHoldoutFileMetadata = {
  path: string;
  added: number;
  deleted: number;
};

export type AstDiffHoldoutCommitMetadata = {
  revision: string;
  parents: string[];
  files: AstDiffHoldoutFileMetadata[];
};

export type AstDiffHoldoutSelectedFile = {
  beforeRevision: string;
  afterRevision: string;
  file: string;
  addedLines: number;
  deletedLines: number;
};

export type AstDiffHoldoutSelectionAudit = {
  commitsVisited: number;
  mergeCommits: number;
  excludedByPath: number;
  excludedBySize: number;
  excludedPriorCases: number;
  excludedRepeatedFiles: number;
};

export function parseGitCommitParents(
  value: string,
): Array<{ revision: string; parents: string[] }> {
  return value
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [revision = "", rawParents = ""] = line.split("\t", 2);
      return { revision, parents: rawParents.split(" ").filter(Boolean) };
    })
    .filter((item) => item.revision.length > 0);
}

export function parseGitNumstat(value: string): AstDiffHoldoutFileMetadata[] {
  const files: AstDiffHoldoutFileMetadata[] = [];
  for (const line of value.split("\n")) {
    if (!line) continue;
    const [rawAdded, rawDeleted, ...pathParts] = line.split("\t");
    const added = Number.parseInt(rawAdded ?? "", 10);
    const deleted = Number.parseInt(rawDeleted ?? "", 10);
    const path = pathParts.join("\t");
    if (!Number.isFinite(added) || !Number.isFinite(deleted) || path.length === 0) continue;
    files.push({ path, added, deleted });
  }
  return files;
}

export function selectAstDiffHoldoutFiles(
  commits: readonly AstDiffHoldoutCommitMetadata[],
  options: {
    count: number;
    minChangedLines: number;
    maxChangedLines: number;
    excludedCaseKeys?: ReadonlySet<string>;
  },
): { cases: AstDiffHoldoutSelectedFile[]; audit: AstDiffHoldoutSelectionAudit } {
  const audit: AstDiffHoldoutSelectionAudit = {
    commitsVisited: 0,
    mergeCommits: 0,
    excludedByPath: 0,
    excludedBySize: 0,
    excludedPriorCases: 0,
    excludedRepeatedFiles: 0,
  };
  const selected: AstDiffHoldoutSelectedFile[] = [];
  const selectedFiles = new Set<string>();
  const excludedCaseKeys = options.excludedCaseKeys ?? new Set<string>();

  for (const commit of commits) {
    if (selected.length >= options.count) break;
    audit.commitsVisited++;
    if (commit.parents.length !== 1) {
      audit.mergeCommits++;
      continue;
    }
    const eligible: AstDiffHoldoutFileMetadata[] = [];
    for (const file of [...commit.files].sort((a, b) => a.path.localeCompare(b.path))) {
      if (!isEligibleTypeScriptSourcePath(file.path)) {
        audit.excludedByPath++;
        continue;
      }
      const changedLines = file.added + file.deleted;
      if (changedLines < options.minChangedLines || changedLines > options.maxChangedLines) {
        audit.excludedBySize++;
        continue;
      }
      if (excludedCaseKeys.has(`${commit.revision}\0${file.path}`)) {
        audit.excludedPriorCases++;
        continue;
      }
      if (selectedFiles.has(file.path)) {
        audit.excludedRepeatedFiles++;
        continue;
      }
      eligible.push(file);
    }
    const file = eligible[0];
    if (!file) continue;
    selectedFiles.add(file.path);
    selected.push({
      beforeRevision: commit.parents[0]!,
      afterRevision: commit.revision,
      file: file.path,
      addedLines: file.added,
      deletedLines: file.deleted,
    });
  }
  return { cases: selected, audit };
}

export function isEligibleTypeScriptSourcePath(path: string): boolean {
  const lower = path.toLowerCase();
  if (!/\.(?:[cm]?ts|tsx)$/.test(lower) || lower.endsWith(".d.ts")) return false;
  if (
    /(?:^|\/)(?:__tests__|tests?|fixtures?|generated|vendor|dist|build|coverage|node_modules)(?:\/|$)/.test(
      lower,
    )
  ) {
    return false;
  }
  return !/\.(?:test|spec|stories|vitest|config|setup|mock(?:-[^.]+)*)\.[cm]?tsx?$/.test(lower);
}
