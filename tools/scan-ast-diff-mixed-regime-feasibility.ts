import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { extractCodeSymbolsFromSource } from "../packages/analyzer-ts/src/snapshot.ts";
import { parseUnifiedDiffHunks } from "../packages/server/src/workingDiff.ts";
import {
  SYMBOL_DIFF_PROJECTION_WORK_RATIO_THRESHOLD,
  symbolDiffProjectionWorkRatio,
} from "../packages/viz/src/diffStats.ts";
import {
  assertAstDiffMixedRegimeRepositoryPins,
  summarizeAstDiffMixedRegimeFeasibility,
  type AstDiffMixedRegimeCandidate,
  type AstDiffMixedRegimeRepositoryScan,
} from "./ast-diff-mixed-regime-feasibility.ts";
import { parseAstDiffRepositoryChangedFiles } from "./ast-diff-repository-corpus.ts";

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(
  option("--output", "research/results/ast-diff-mixed-regime-feasibility-v1.json"),
);
const markdownPath = resolve(
  option("--markdown", "research/results/ast-diff-mixed-regime-feasibility-v1.md"),
);
const maximumCommits = integerOption("--max-commits", 200, 1);
const maximumChangedFiles = integerOption("--max-files", 20, 1);
const repositories = [
  repository("openai/codex", "1624de399ea3f578c0545da062ddaf91250d6db5"),
  repository("bit-vcs/workspace", "4394e4b919a9eaf060318c1fd8f5455185f350de"),
  repository("bit-vcs/bithub", "55033bbf7df3794436d9809e1b082c44dfb43581"),
  repository("vadimdemedes/ink", "2aaa8b4eaba8edcbc0d151d37ffa75f65fa9478b"),
  repository("nrslib/takt", "78dead335de8ae6d5477eac82c581ce8273ccf35"),
  repository("ogulcancelik/herdr", "28cb93184e99405e8bd673821cbaf514ab65a17c"),
] as const;
assertAstDiffMixedRegimeRepositoryPins(
  repositories.map(({ fullName, pinnedHead }) => ({ repository: fullName, pinnedHead })),
);
const protocol = {
  version: "ast-diff-mixed-regime-feasibility-v1" as const,
  timing: "no benchmark kernel or wall-clock timing is executed" as const,
  inputCharacterization:
    "static after-revision AST symbol count and zero-context diff hunk count per changed source file" as const,
  repositories: repositories.map(({ fullName, owner, pinnedHead }) => ({
    fullName,
    owner,
    pinnedHead,
  })),
  maximumCommits,
  maximumChangedFiles,
  revisionSelection:
    "first-parent, non-merge commits from pinned HEAD in descending revision order" as const,
  candidateInclusion:
    "1-20 analyzable changed source files, at least one after symbol, and at least one diff hunk" as const,
  policy: {
    workRatio: "S*H / ((S+H)*log2(H+1))" as const,
    threshold: SYMBOL_DIFF_PROJECTION_WORK_RATIO_THRESHOLD,
    indexedWhen: "work ratio > threshold" as const,
  },
  feasibilityGate: {
    branches: ["pure-naive", "pure-indexed"] as const,
    minimumCases: 15,
    minimumCasesPerRepository: 3,
    minimumRepositories: 3,
    minimumOwners: 3,
  },
};
const protocolHash = sha256(JSON.stringify(protocol));
const [{ stdout: revision }, { stdout: status }] = await Promise.all([
  exec("git", ["rev-parse", "HEAD"], { cwd: projectRoot }),
  exec("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: projectRoot }),
]);
const scans = await mapConcurrent(repositories, Math.min(3, cpus().length), scanRepository);
const feasibility = summarizeAstDiffMixedRegimeFeasibility(
  scans.map(({ scan }) => scan),
  SYMBOL_DIFF_PROJECTION_WORK_RATIO_THRESHOLD,
);
const result = {
  schemaVersion: 1 as const,
  status: "timing-free static structure feasibility scan; not a performance result" as const,
  protocolHash,
  protocol,
  implementation: {
    revision: revision.trim(),
    dirtyAtRun: status.trim().length > 0,
  },
  scans,
  feasibility,
};
await Promise.all([
  writeAtomic(outputPath, `${JSON.stringify(result, null, 2)}\n`),
  writeAtomic(markdownPath, renderMarkdown(result)),
]);
process.stdout.write(
  `${JSON.stringify(
    {
      output: relative(projectRoot, outputPath),
      markdown: relative(projectRoot, markdownPath),
      protocolHash,
      implementation: result.implementation,
      feasibility,
    },
    null,
    2,
  )}\n`,
);

type RepositorySpec = (typeof repositories)[number];

type RepositoryScanResult = {
  scan: AstDiffMixedRegimeRepositoryScan;
  scannedRevisions: number;
  exclusions: {
    noParent: number;
    changedFileCount: number;
    noAfterSymbols: number;
    noHunks: number;
    extractionError: number;
  };
};

function repository(fullName: string, pinnedHead: string) {
  return {
    fullName,
    owner: fullName.split("/")[0]!,
    repositoryPath: resolve(projectRoot, "../..", fullName),
    pinnedHead,
  };
}

async function scanRepository(spec: RepositorySpec): Promise<RepositoryScanResult> {
  await git(spec.repositoryPath, ["rev-parse", "--verify", `${spec.pinnedHead}^{commit}`]);
  const revisions = (
    await git(spec.repositoryPath, [
      "rev-list",
      "--first-parent",
      "--no-merges",
      `--max-count=${maximumCommits}`,
      spec.pinnedHead,
    ])
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  const candidates: AstDiffMixedRegimeCandidate[] = [];
  const exclusions: RepositoryScanResult["exclusions"] = {
    noParent: 0,
    changedFileCount: 0,
    noAfterSymbols: 0,
    noHunks: 0,
    extractionError: 0,
  };
  for (let index = 0; index < revisions.length; index += 1) {
    if (index % 25 === 0) {
      process.stderr.write(`[static-scan ${spec.fullName} ${index}/${revisions.length}]\n`);
    }
    const afterRevision = revisions[index]!;
    let beforeRevision: string;
    try {
      beforeRevision = (
        await git(spec.repositoryPath, ["rev-parse", "--verify", `${afterRevision}^1`])
      ).trim();
    } catch {
      exclusions.noParent += 1;
      continue;
    }
    const [nameStatus, patch] = await Promise.all([
      git(spec.repositoryPath, [
        "diff",
        "--name-status",
        "--find-renames",
        beforeRevision,
        afterRevision,
        "--",
      ]),
      git(spec.repositoryPath, [
        "diff",
        "--no-ext-diff",
        "--unified=0",
        "--find-renames",
        beforeRevision,
        afterRevision,
        "--",
      ]),
    ]);
    const changedFiles = parseAstDiffRepositoryChangedFiles(nameStatus);
    if (changedFiles.length < 1 || changedFiles.length > maximumChangedFiles) {
      exclusions.changedFileCount += 1;
      continue;
    }
    const hunksByPath = parseUnifiedDiffHunks(patch);
    try {
      const files = await Promise.all(
        changedFiles.map(async (file) => {
          const path = file.afterPath ?? file.beforePath!;
          const source = file.afterPath
            ? await sourceAtRevision(spec.repositoryPath, afterRevision, file.afterPath)
            : "";
          const symbolCount = source
            ? extractCodeSymbolsFromSource(file.afterPath!, source).length
            : 0;
          const hunkCount = file.afterPath ? (hunksByPath[file.afterPath]?.length ?? 0) : 0;
          return {
            path,
            symbolCount,
            hunkCount,
            workRatio: symbolDiffProjectionWorkRatio(symbolCount, hunkCount),
          };
        }),
      );
      if (files.reduce((sum, file) => sum + file.symbolCount, 0) === 0) {
        exclusions.noAfterSymbols += 1;
        continue;
      }
      if (files.reduce((sum, file) => sum + file.hunkCount, 0) === 0) {
        exclusions.noHunks += 1;
        continue;
      }
      candidates.push({ beforeRevision, afterRevision, files });
    } catch {
      exclusions.extractionError += 1;
    }
  }
  process.stderr.write(
    `[static-scan ${spec.fullName} done candidates=${candidates.length}/${revisions.length}]\n`,
  );
  return {
    scan: {
      repository: spec.fullName,
      owner: spec.owner,
      pinnedHead: spec.pinnedHead,
      candidates,
    },
    scannedRevisions: revisions.length,
    exclusions,
  };
}

type FeasibilityResult = typeof result;

function renderMarkdown(value: FeasibilityResult): string {
  const rows = value.feasibility.repositories
    .map(
      (repository) =>
        `| ${repository.repository} | ${repository.candidates} | ${repository.pureNaive} | ${repository.pureIndexed} | ${repository.mixed} | ${repository.workRatio ? `${repository.workRatio.min.toFixed(3)}–${repository.workRatio.max.toFixed(3)}` : "—"} |`,
    )
    .join("\n");
  const gate = (passed: boolean) => (passed ? "PASS" : "FAIL");
  return `# AST diff mixed-regime feasibility v1

Status: ${value.status}.

- Protocol SHA-256: \`${value.protocolHash}\`
- Implementation: \`${value.implementation.revision}\` (dirty at run: \`${value.implementation.dirtyAtRun}\`)
- Candidate threshold: \`${value.feasibility.threshold}\`
- Commit scan: at most ${value.protocol.maximumCommits} non-merge first-parent commits per pinned repository
- Timing: no benchmark kernel or wall-clock timing executed

Overall feasibility: **${value.feasibility.feasible ? "PASS" : "FAIL"}**

| Repository | Candidates | Pure naive | Pure indexed | Mixed | Work-ratio range |
|---|---:|---:|---:|---:|---:|
${rows}

| Gate | Result | Cases | Eligible repositories | Eligible owners |
|---|:---:|---:|---:|---:|
| Pure naive | ${gate(value.feasibility.gates.pureNaive.passed)} | ${value.feasibility.gates.pureNaive.cases} | ${value.feasibility.gates.pureNaive.eligibleRepositories} | ${value.feasibility.gates.pureNaive.eligibleOwners} |
| Pure indexed | ${gate(value.feasibility.gates.pureIndexed.passed)} | ${value.feasibility.gates.pureIndexed.cases} | ${value.feasibility.gates.pureIndexed.eligibleRepositories} | ${value.feasibility.gates.pureIndexed.eligibleOwners} |

${value.feasibility.reasons.length > 0 ? `Failure reasons:\n\n${value.feasibility.reasons.map((reason) => `- ${reason}`).join("\n")}\n` : "No fixed feasibility gate failed.\n"}
This convenience sample establishes only whether a later mixed-regime natural corpus can be constructed from the pinned local repositories. Static AST extraction is used to obtain symbol counts, so this is structure-only rather than metadata-only. No cases are selected for timing by this scan, and feasibility does not itself provide performance evidence.
`;
}

async function sourceAtRevision(
  repositoryPath: string,
  revision: string,
  path: string,
): Promise<string> {
  try {
    return await git(repositoryPath, ["show", `${revision}:${path}`]);
  } catch {
    return "";
  }
}

async function git(repositoryPath: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]!);
      }
    }),
  );
  return results;
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function integerOption(name: string, fallback: number, minimum: number): number {
  const index = process.argv.indexOf(name);
  const value = Number.parseInt(
    index === -1 ? String(fallback) : (process.argv[index + 1] ?? ""),
    10,
  );
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return value;
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}
