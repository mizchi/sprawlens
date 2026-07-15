import { execFile } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { parseNumstat } from "../packages/server/src/workingDiff.ts";
import { parseAstDiffRepositoryChangedFiles } from "./ast-diff-repository-corpus.ts";
import {
  selectAstDiffPerformanceQuantiles,
  type AstDiffPerformanceCandidate,
} from "./ast-diff-performance-holdout-selection.ts";

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(
  option("--output", "research/ast-diff-adaptive-performance-holdout-manifest.json"),
);
const repositories = [
  repository(
    "justjavac/wechat-miniapp-radar",
    "../../../justjavac/wechat-miniapp-radar",
    "597c3e1763e5506b09037bd82d9897ca28dd6e4d",
  ),
  repository(
    "clash-verge-rev/clash-verge-rev",
    "../../../clash-verge-rev/clash-verge-rev",
    "0c86b70fe9a99c78de13f4c9d1130d06effc532d",
  ),
  repository("kazuph/yunomi", "../../../kazuph/yunomi", "25f4c4999237429beac10a970cf82080692bbb50"),
  repository("bit-vcs/bit", "../../../bit-vcs/bit", "186c50bde1c33a1df876f099b36e15800d65840b"),
  repository(
    "manaflow-ai/cmux",
    "../../../manaflow-ai/cmux",
    "ed23fabd4d26fb8eded180ac01083b99702c68f5",
  ),
  repository(
    "microsoft/waza",
    "../../../microsoft/waza",
    "bf77c759d6bee3ba578c1980fa8a176fe8d014e4",
  ),
] as const;

const candidateScans = await Promise.all(repositories.map(scanRepository));
const insufficientScans = candidateScans.filter(({ candidates }) => candidates.length < 5);
if (insufficientScans.length > 0) {
  throw new Error(
    `performance selection requires at least 5 eligible candidates per repository: ${insufficientScans
      .map(({ spec, candidates }) => `${spec.fullName}=${candidates.length}`)
      .join(", ")}`,
  );
}
const scans = candidateScans.map(({ spec, candidates }) => ({
  spec,
  candidates,
  selected: selectAstDiffPerformanceQuantiles(candidates),
}));
const cases = scans.flatMap(({ spec, selected }) =>
  selected.map((selection) => ({
    id: `${slug(spec.fullName)}-${selection.label}-${selection.afterRevision.slice(0, 8)}`,
    language: "TypeScript",
    repository: spec.fullName,
    repositoryPath: spec.repositoryPath,
    beforeRevision: selection.beforeRevision,
    afterRevision: selection.afterRevision,
    changeKinds: ["performance-only-change-size-quantile"],
    selection: {
      label: selection.label,
      quantile: selection.quantile,
      candidateRank: selection.candidateRank,
      candidateCount: selection.candidateCount,
      changedSourceFiles: selection.changedSourceFiles,
      changedLines: selection.changedLines,
    },
  })),
);
const manifest = {
  schemaVersion: 1 as const,
  datasetId: "ast-diff-adaptive-performance-holdout-v1" as const,
  selectionProtocol:
    "Six unused repositories at pinned HEAD; scan 200 non-merge first-parent commits; retain 1-50 analyzable changed source files and positive numstat; select min/q1/median/q3/max changed-line quantiles before benchmark execution.",
  repositories: repositories.map(({ fullName, repositoryPath, head }) => ({
    fullName,
    repositoryPath,
    head,
  })),
  cases,
};
await writeAtomic(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify(
    {
      output: relative(projectRoot, outputPath),
      datasetId: manifest.datasetId,
      repositories: scans.map(({ spec, candidates, selected }) => ({
        repository: spec.fullName,
        eligibleCandidates: candidates.length,
        selected: selected.map(({ label, changedSourceFiles, changedLines }) => ({
          label,
          changedSourceFiles,
          changedLines,
        })),
      })),
      cases: cases.length,
    },
    null,
    2,
  )}\n`,
);

type RepositorySpec = {
  fullName: string;
  repositoryPath: string;
  head: string;
};

function repository(fullName: string, repositoryPath: string, head: string): RepositorySpec {
  return { fullName, repositoryPath, head };
}

async function scanRepository(spec: RepositorySpec): Promise<{
  spec: RepositorySpec;
  candidates: AstDiffPerformanceCandidate[];
}> {
  const repositoryPath = resolve(projectRoot, "research", spec.repositoryPath);
  await git(repositoryPath, ["rev-parse", "--verify", `${spec.head}^{commit}`]);
  const revisions = (
    await git(repositoryPath, [
      "rev-list",
      "--first-parent",
      "--no-merges",
      "--max-count=200",
      spec.head,
    ])
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  const candidates: AstDiffPerformanceCandidate[] = [];
  for (const afterRevision of revisions) {
    let beforeRevision: string;
    try {
      beforeRevision = (
        await git(repositoryPath, ["rev-parse", "--verify", `${afterRevision}^1`])
      ).trim();
    } catch {
      continue;
    }
    const [nameStatus, numstat] = await Promise.all([
      git(repositoryPath, [
        "diff",
        "--name-status",
        "--find-renames",
        beforeRevision,
        afterRevision,
        "--",
      ]),
      git(repositoryPath, [
        "diff",
        "--numstat",
        "--find-renames",
        beforeRevision,
        afterRevision,
        "--",
      ]),
    ]);
    const changedFiles = parseAstDiffRepositoryChangedFiles(nameStatus);
    if (changedFiles.length < 1 || changedFiles.length > 50) continue;
    const stats = parseNumstat(numstat);
    const changedLines = changedFiles.reduce((sum, file) => {
      const path = file.afterPath ?? file.beforePath;
      const stat = path ? stats[path] : undefined;
      return sum + (stat ? stat.added + stat.deleted : 0);
    }, 0);
    if (changedLines < 1) continue;
    candidates.push({
      beforeRevision,
      afterRevision,
      changedSourceFiles: changedFiles.length,
      changedLines,
    });
  }
  return { spec, candidates };
}

async function git(repositoryPath: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}
