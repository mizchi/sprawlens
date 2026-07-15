import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import {
  AST_DIFF_REPOSITORY_CONDITIONS,
  parseAstDiffRepositoryFixture,
  summarizeAstDiffRepositoryMeasurements,
  type AstDiffRepositoryCondition,
  type AstDiffRepositoryGroup,
  type AstDiffRepositoryMeasurement,
} from "../packages/viz/src/astDiffRepositoryBenchmark.ts";

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const researchRoot = resolve(projectRoot, "research");
const profile = enumOption("--profile", ["smoke", "pilot"] as const, "smoke");
const defaults = profileDefaults(profile);
const repetitions = integerOption("--repetitions", defaults.repetitions, 1);
const warmupIterations = integerOption("--warmups", defaults.warmupIterations, 0);
const batchIterations = integerOption("--iterations", defaults.batchIterations, 1);
const timeoutMs = integerOption("--timeout-ms", defaults.timeoutMs, 1);
const fixturePath = resolve(
  option("--fixture", "research/datasets/ast-diff-repository-performance-v1.json"),
);
const outputPath = resolve(
  option("--output", "research/results/ast-diff-repository-performance-pilot.json"),
);
const markdownPath = resolve(
  option("--markdown", "research/results/ast-diff-repository-performance-pilot.md"),
);
const fixtureText = await readFile(fixturePath, "utf8");
const fixture = parseAstDiffRepositoryFixture(JSON.parse(fixtureText));
const protocol = {
  profile,
  sourceDatasetId: fixture.sourceDatasetId,
  repetitions,
  warmupIterations,
  batchIterations,
  timeoutMs,
  processIsolation: "one fresh Node.js process per case × condition × repetition" as const,
  timingScope:
    "batch of whole-commit algorithm calls after in-process warmup; fixture parsing excluded" as const,
  analysisUnit: "case paired within repository; repository is the outer summary unit" as const,
  correctnessGate:
    "indexed and naive projection output SHA-256 digests and item counts must match per case" as const,
  order: "case order and the three-condition order rotate deterministically by repetition" as const,
  conditions: AST_DIFF_REPOSITORY_CONDITIONS,
};
const protocolHash = sha256(JSON.stringify(protocol));
const [implementation, evidence] = await Promise.all([
  gitState(projectRoot),
  gitState(researchRoot),
]);
const measurements: AstDiffRepositoryMeasurement[] = [];
const startedAt = new Date().toISOString();

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const orderedCases = rotate(fixture.cases, (repetition - 1) % fixture.cases.length);
  for (let caseIndex = 0; caseIndex < orderedCases.length; caseIndex += 1) {
    const testCase = orderedCases[caseIndex]!;
    const conditions = rotate(
      [...AST_DIFF_REPOSITORY_CONDITIONS],
      (repetition + caseIndex - 1) % AST_DIFF_REPOSITORY_CONDITIONS.length,
    );
    for (const condition of conditions) {
      process.stderr.write(
        `[repository ${testCase.repository} ${testCase.id} ${condition} ${repetition}/${repetitions}]\n`,
      );
      measurements.push(
        await runWorker({
          caseId: testCase.id,
          repository: testCase.repository,
          condition,
          repetition,
          fileCount: testCase.files.length,
          beforeSymbolCount: countSymbols(testCase.files, "before"),
          afterSymbolCount: countSymbols(testCase.files, "after"),
          hunkCount: testCase.files.reduce((sum, file) => sum + file.hunks.length, 0),
        }),
      );
    }
  }
}

const summary = summarizeAstDiffRepositoryMeasurements(measurements);
const result = {
  schemaVersion: 1 as const,
  status: "exploratory multi-repository process-isolated AST diff performance pilot" as const,
  startedAt,
  finishedAt: new Date().toISOString(),
  fixture: {
    path: relative(projectRoot, fixturePath),
    sha256: sha256(fixtureText),
    sourceDatasetId: fixture.sourceDatasetId,
    repositories: new Set(fixture.cases.map((testCase) => testCase.repository)).size,
    cases: fixture.cases.length,
    files: fixture.cases.reduce((sum, testCase) => sum + testCase.files.length, 0),
  },
  protocolHash,
  protocol,
  implementation,
  evidence,
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpus: cpus().length,
  },
  measurements,
  summary,
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
      fixtureSha256: result.fixture.sha256,
      protocolHash,
      measurements: measurements.length,
      failures: measurements.filter((measurement) => measurement.status !== "ok").length,
      projectionComparisons: summary.projectionComparisons.length,
      repositories: summary.repositories.length,
    },
    null,
    2,
  )}\n`,
);

async function runWorker(input: {
  caseId: string;
  repository: string;
  condition: AstDiffRepositoryCondition;
  repetition: number;
  fileCount: number;
  beforeSymbolCount: number;
  afterSymbolCount: number;
  hunkCount: number;
}): Promise<AstDiffRepositoryMeasurement> {
  const base = {
    schemaVersion: 1 as const,
    caseId: input.caseId,
    repository: input.repository,
    condition: input.condition,
    repetition: input.repetition,
    warmupIterations,
    batchIterations,
    fileCount: input.fileCount,
    beforeSymbolCount: input.beforeSymbolCount,
    afterSymbolCount: input.afterSymbolCount,
    hunkCount: input.hunkCount,
  };
  try {
    const { stdout, stderr } = await exec(
      "pnpm",
      [
        "exec",
        "tsx",
        "tools/ast-diff-repository-worker.ts",
        "--fixture",
        fixturePath,
        "--case",
        input.caseId,
        "--condition",
        input.condition,
        "--repetition",
        String(input.repetition),
        "--warmups",
        String(warmupIterations),
        "--iterations",
        String(batchIterations),
      ],
      {
        cwd: projectRoot,
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (stderr) process.stderr.write(stderr);
    const measurement = JSON.parse(stdout) as AstDiffRepositoryMeasurement;
    assertWorkerContract(measurement, base);
    return measurement;
  } catch (error) {
    const childError = error as Error & {
      killed?: boolean;
      signal?: NodeJS.Signals;
      stderr?: string;
    };
    if (childError.stderr) process.stderr.write(childError.stderr);
    const timedOut = childError.killed === true || childError.signal === "SIGKILL";
    return {
      ...base,
      status: timedOut ? "timeout" : "error",
      durationMs: null,
      durationPerIterationMs: null,
      maxRssKb: null,
      outputDigest: null,
      outputItems: null,
      error: timedOut
        ? `timed out after ${timeoutMs} ms`
        : sanitizeError(childError.message || "worker failed"),
    };
  }
}

function assertWorkerContract(
  measurement: AstDiffRepositoryMeasurement,
  expected: Pick<
    AstDiffRepositoryMeasurement,
    | "caseId"
    | "repository"
    | "condition"
    | "repetition"
    | "warmupIterations"
    | "batchIterations"
    | "fileCount"
    | "beforeSymbolCount"
    | "afterSymbolCount"
    | "hunkCount"
  >,
): void {
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (measurement[key] !== expected[key]) throw new Error(`worker contract mismatch: ${key}`);
  }
  if (measurement.status !== "ok") throw new Error("worker did not return an ok measurement");
}

function renderMarkdown(result: {
  status: string;
  fixture: {
    path: string;
    sha256: string;
    sourceDatasetId: string;
    repositories: number;
    cases: number;
    files: number;
  };
  protocolHash: string;
  protocol: typeof protocol;
  implementation: GitState;
  evidence: GitState;
  environment: { node: string; platform: string; arch: string; cpu: string };
  summary: ReturnType<typeof summarizeAstDiffRepositoryMeasurements>;
}): string {
  const repositoryRows = result.summary.repositories.map(
    (repository) =>
      `| ${repository.repository} | ${repository.caseCount} | ${repository.projectionCaseCount} | ${formatNumber(repository.medianProjectionSpeedup, 2, "×")} | ${formatNumber(repository.parentAwareMedianCaseP50Ms, 4, " ms")} |`,
  );
  const projectionRows = result.summary.projectionComparisons.map(
    (comparison) =>
      `| ${comparison.repository} | ${comparison.caseId} | ${comparison.fileCount} | ${comparison.afterSymbolCount} | ${comparison.hunkCount} | ${comparison.indexedP50Ms.toFixed(4)} | ${comparison.naiveP50Ms.toFixed(4)} | ${comparison.speedup.toFixed(2)}× |`,
  );
  const treeRows = result.summary.groups
    .filter((group) => group.condition === "parent-aware")
    .map(
      (group) =>
        `| ${group.repository} | ${group.caseId} | ${group.fileCount} | ${group.beforeSymbolCount} | ${group.afterSymbolCount} | ${formatNumber(group.durationPerIterationMs?.p50, 4)} | ${formatNumber(group.durationPerIterationMs?.p95, 4)} | ${formatInteger(group.maxRssKb?.p50)} | ${group.outputItems ?? "–"} | ${group.failures} |`,
    );
  const failures = result.summary.groups.filter((group) => group.failures > 0);
  return `# Multi-repository AST diff performance pilot

Status: ${result.status}. The fixed v1/v3 development corpus is post-hoc and contains only four repositories, so this is not confirmatory evidence.

- Fixture: \`${result.fixture.path}\` (SHA-256 \`${result.fixture.sha256}\`)
- Source dataset: \`${result.fixture.sourceDatasetId}\`
- Corpus: ${result.fixture.repositories} repositories, ${result.fixture.cases} commit cases, ${result.fixture.files} analyzable changed files
- Protocol SHA-256: \`${result.protocolHash}\`
- Implementation: \`${result.implementation.revision}\` (dirty at run: \`${result.implementation.dirtyAtRun}\`)
- Research evidence: \`${result.evidence.revision}\` (dirty at run: \`${result.evidence.dirtyAtRun}\`)
- Environment: ${result.environment.node}, ${result.environment.platform}/${result.environment.arch}, ${result.environment.cpu}
- Isolation: ${result.protocol.processIsolation}
- Timing: ${result.protocol.timingScope}
- Analysis unit: ${result.protocol.analysisUnit}
- Repetitions: ${result.protocol.repetitions}; warmups: ${result.protocol.warmupIterations}; batch iterations: ${result.protocol.batchIterations}; timeout: ${result.protocol.timeoutMs} ms

## Repository-level descriptive summary

Each case first contributes one paired median. Repository rows summarize those case-level values; process repetitions are not treated as independent repository samples.

| Repository | Cases | Paired projection cases | Median naive/indexed speedup | Parent-aware median case p50 |
| --- | ---: | ---: | ---: | ---: |
${repositoryRows.join("\n")}

## Projection by commit case

| Repository | Case | Files | After symbols | Hunks | Indexed p50 ms | Naive p50 ms | Naive/indexed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${projectionRows.join("\n")}

All paired indexed/naive output digests and item counts must agree before this table is emitted.

## Parent-aware tree diff by commit case

| Repository | Case | Files | Before symbols | After symbols | p50 ms | p95 ms | Peak RSS p50 KiB | Output items | Failures |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${treeRows.join("\n")}

## Failures

${failures.length === 0 ? "No worker errors or timeouts." : failures.map(renderFailure).join("\n")}

Tail quantiles are descriptive interpolations over the configured process repetitions and must not be interpreted as stable production p95/p99 estimates.
`;
}

function renderFailure(group: AstDiffRepositoryGroup): string {
  return `- ${group.repository}/${group.caseId}/${group.condition}: ${group.failures} failure(s), ${group.timeouts} timeout(s)`;
}

type GitState = { revision: string; dirtyAtRun: boolean };

async function gitState(path: string): Promise<GitState> {
  const [{ stdout: revision }, { stdout: status }] = await Promise.all([
    exec("git", ["rev-parse", "HEAD"], { cwd: path }),
    exec("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: path }),
  ]);
  return { revision: revision.trim(), dirtyAtRun: status.trim().length > 0 };
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function countSymbols(
  files: (typeof fixture.cases)[number]["files"],
  side: "before" | "after",
): number {
  return files.reduce((sum, file) => sum + file[side].length, 0);
}

function rotate<T>(items: readonly T[], offset: number): T[] {
  if (items.length === 0) return [];
  const normalized = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function profileDefaults(profile: "smoke" | "pilot") {
  return profile === "smoke"
    ? { repetitions: 2, warmupIterations: 2, batchIterations: 100, timeoutMs: 30_000 }
    : { repetitions: 10, warmupIterations: 10, batchIterations: 1_000, timeoutMs: 30_000 };
}

function formatNumber(
  value: number | null | undefined,
  fractionDigits: number,
  suffix = "",
): string {
  return value === null || value === undefined ? "–" : `${value.toFixed(fractionDigits)}${suffix}`;
}

function formatInteger(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : Math.round(value).toLocaleString("en-US");
}

function sanitizeError(value: string): string {
  return value.replaceAll(projectRoot, "<project-root>").slice(0, 2_000);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function integerOption(name: string, fallback: number, minimum: number): number {
  const value = Number(option(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer >= ${minimum}`);
  }
  return value;
}

function enumOption<const T extends readonly string[]>(
  name: string,
  values: T,
  fallback: T[number],
): T[number] {
  const value = option(name, fallback);
  if (!values.includes(value)) throw new Error(`${name} must be one of: ${values.join(", ")}`);
  return value as T[number];
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}
