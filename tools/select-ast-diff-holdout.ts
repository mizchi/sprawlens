import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { promisify } from "node:util";
import {
  parseGitCommitParents,
  parseGitNumstat,
  selectAstDiffHoldoutFiles,
  type AstDiffHoldoutCommitMetadata,
} from "../packages/viz/src/astDiffHoldoutSelection.ts";

const execFileAsync = promisify(execFile);

type SelectionSpec = {
  schemaVersion: 1;
  datasetId: string;
  selectedOn: string;
  selectionProtocol: string;
  cutoff: string;
  casesPerRepository: number;
  minChangedLines: number;
  maxChangedLines: number;
  maxCommitsPerRepository: number;
  excludedCandidateManifests: string[];
  repositories: Array<{
    idPrefix: string;
    repository: string;
    repositoryPath: string;
  }>;
};

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const specPath = resolve(option("--spec", "research/ast-diff-confirmatory-v2-selection.json"));
const outputPath = resolve(option("--output", "research/ast-diff-confirmatory-v2-candidates.json"));
const auditPath = resolve(
  option("--audit", "research/ast-diff-confirmatory-v2-selection-audit.json"),
);
const spec = parseSpec(JSON.parse(await readFile(specPath, "utf8")));
const specDirectory = dirname(specPath);
const excludedCaseKeys = await readExcludedCaseKeys(specDirectory, spec.excludedCandidateManifests);
const cases: Array<Record<string, unknown>> = [];
const repositoryAudits: Array<Record<string, unknown>> = [];
const ids = new Set<string>();

for (const repository of spec.repositories) {
  const repo = resolve(specDirectory, repository.repositoryPath);
  const [head, rawCommits] = await Promise.all([
    git(repo, ["rev-parse", "HEAD"]),
    git(repo, [
      "log",
      "--first-parent",
      `--before=${spec.cutoff}`,
      `--max-count=${spec.maxCommitsPerRepository}`,
      "--format=%H%x09%P",
    ]),
  ]);
  const commitRefs = parseGitCommitParents(rawCommits);
  const commitMetadata: AstDiffHoldoutCommitMetadata[] = [];
  let selection = selectAstDiffHoldoutFiles(commitMetadata, selectionOptions());
  for (const commit of commitRefs) {
    if (selection.cases.length >= spec.casesPerRepository) break;
    const files =
      commit.parents.length === 1
        ? parseGitNumstat(
            await git(repo, [
              "diff",
              "--no-ext-diff",
              "--numstat",
              "--diff-filter=AM",
              commit.parents[0]!,
              commit.revision,
              "--",
            ]),
          )
        : [];
    commitMetadata.push({ ...commit, files });
    selection = selectAstDiffHoldoutFiles(commitMetadata, selectionOptions());
  }
  if (selection.cases.length !== spec.casesPerRepository) {
    throw new Error(
      `${repository.repository}: selected ${selection.cases.length}/${spec.casesPerRepository} cases after ${commitMetadata.length} commits`,
    );
  }
  for (const item of selection.cases) {
    const id = uniqueId(
      `${repository.idPrefix}-${item.afterRevision.slice(0, 8)}-${slugFile(item.file)}`,
      ids,
    );
    cases.push({
      id,
      language: "typescript",
      repository: repository.repository,
      repositoryPath: repository.repositoryPath,
      beforeRevision: item.beforeRevision,
      afterRevision: item.afterRevision,
      file: item.file,
      changeKinds: ["unclassified-holdout"],
      selectionMetadata: {
        addedLines: item.addedLines,
        deletedLines: item.deletedLines,
      },
    });
  }
  repositoryAudits.push({
    repository: repository.repository,
    repositoryPath: repository.repositoryPath,
    localHead: head.trim(),
    commitsScanned: commitMetadata.length,
    selectedCases: selection.cases.length,
    ...selection.audit,
  });
}

await Promise.all([
  writeAtomic(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        datasetId: spec.datasetId,
        selectionProtocol: spec.selectionProtocol,
        cases,
      },
      null,
      2,
    )}\n`,
  ),
  writeAtomic(
    auditPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        datasetId: spec.datasetId,
        selectedOn: spec.selectedOn,
        cutoff: spec.cutoff,
        casesPerRepository: spec.casesPerRepository,
        minChangedLines: spec.minChangedLines,
        maxChangedLines: spec.maxChangedLines,
        excludedCandidateManifests: spec.excludedCandidateManifests,
        excludedPriorCases: excludedCaseKeys.size,
        repositories: repositoryAudits,
        totalCases: cases.length,
      },
      null,
      2,
    )}\n`,
  ),
]);
process.stdout.write(`${spec.datasetId}: selected ${cases.length} metadata-only holdout cases\n`);

function selectionOptions() {
  return {
    count: spec.casesPerRepository,
    minChangedLines: spec.minChangedLines,
    maxChangedLines: spec.maxChangedLines,
    excludedCaseKeys,
  };
}

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

async function readExcludedCaseKeys(
  root: string,
  manifests: readonly string[],
): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const path of manifests) {
    const value = JSON.parse(await readFile(resolve(root, path), "utf8")) as {
      cases?: Array<{ afterRevision?: string; file?: string }>;
    };
    for (const item of value.cases ?? []) {
      if (item.afterRevision && item.file) keys.add(`${item.afterRevision}\0${item.file}`);
    }
  }
  return keys;
}

function slugFile(path: string): string {
  const name = basename(path, extname(path));
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "source"
  );
}

function uniqueId(candidate: string, ids: Set<string>): string {
  let id = candidate;
  let suffix = 2;
  while (ids.has(id)) id = `${candidate}-${suffix++}`;
  ids.add(id);
  return id;
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function parseSpec(value: unknown): SelectionSpec {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("selection spec must be an object");
  }
  const spec = value as SelectionSpec;
  if (spec.schemaVersion !== 1 || !spec.datasetId || !spec.selectionProtocol || !spec.cutoff) {
    throw new Error("invalid selection spec header");
  }
  if (
    !Number.isInteger(spec.casesPerRepository) ||
    spec.casesPerRepository < 1 ||
    !Number.isInteger(spec.maxCommitsPerRepository) ||
    spec.maxCommitsPerRepository < spec.casesPerRepository ||
    !Number.isFinite(spec.minChangedLines) ||
    !Number.isFinite(spec.maxChangedLines) ||
    spec.minChangedLines > spec.maxChangedLines
  ) {
    throw new Error("invalid selection bounds");
  }
  if (!Array.isArray(spec.repositories) || spec.repositories.length === 0) {
    throw new Error("selection repositories must be non-empty");
  }
  if (!Array.isArray(spec.excludedCandidateManifests)) {
    throw new Error("excludedCandidateManifests must be an array");
  }
  return spec;
}
