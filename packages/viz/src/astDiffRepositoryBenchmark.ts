import { diffAstSymbols, type AstSymbolLike } from "./astSymbolDiff.ts";
import {
  buildSymbolDiffStats,
  buildSymbolDiffStatsIndexed,
  buildSymbolDiffStatsNaive,
  type DiffHunk,
  type NodeDiffStat,
} from "./diffStats.ts";

export const AST_DIFF_REPOSITORY_CONDITIONS = [
  "projection-indexed",
  "projection-naive",
  "projection-adaptive",
  "parent-aware",
] as const;

export type AstDiffRepositoryCondition = (typeof AST_DIFF_REPOSITORY_CONDITIONS)[number];

export type AstDiffRepositoryFileFixture = {
  changeStatus: "modified" | "added" | "deleted" | "renamed" | "copied";
  beforePath: string | null;
  afterPath: string | null;
  before: AstSymbolLike[];
  after: AstSymbolLike[];
  hunks: DiffHunk[];
};

export type AstDiffRepositoryCaseFixture = {
  id: string;
  repository: string;
  beforeRevision: string;
  afterRevision: string;
  files: AstDiffRepositoryFileFixture[];
};

export type AstDiffRepositoryFixture = {
  schemaVersion: 1;
  sourceDatasetId: string;
  status:
    | "post-hoc development corpus; not confirmatory evidence"
    | "performance-only holdout fixed before adaptive benchmark execution";
  cases: AstDiffRepositoryCaseFixture[];
};

export type AstDiffRepositoryMeasurement = {
  schemaVersion: 1;
  caseId: string;
  repository: string;
  condition: AstDiffRepositoryCondition;
  repetition: number;
  warmupIterations: number;
  batchIterations: number;
  fileCount: number;
  beforeSymbolCount: number;
  afterSymbolCount: number;
  hunkCount: number;
  adaptiveNaiveFileCount: number;
  adaptiveIndexedFileCount: number;
  status: "ok" | "timeout" | "error";
  durationMs: number | null;
  durationPerIterationMs: number | null;
  maxRssKb: number | null;
  outputDigest: string | null;
  outputItems: number | null;
  error: string | null;
};

export type AstDiffRepositoryDistribution = {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
};

export type AstDiffRepositoryGroup = {
  caseId: string;
  repository: string;
  condition: AstDiffRepositoryCondition;
  fileCount: number;
  beforeSymbolCount: number;
  afterSymbolCount: number;
  hunkCount: number;
  adaptiveNaiveFileCount: number;
  adaptiveIndexedFileCount: number;
  repetitions: number;
  successfulRepetitions: number;
  failures: number;
  timeouts: number;
  durationPerIterationMs: AstDiffRepositoryDistribution | null;
  maxRssKb: AstDiffRepositoryDistribution | null;
  outputDigest: string | null;
  outputItems: number | null;
};

export type AstDiffRepositorySummary = {
  groups: AstDiffRepositoryGroup[];
  projectionComparisons: Array<{
    caseId: string;
    repository: string;
    fileCount: number;
    afterSymbolCount: number;
    hunkCount: number;
    repetitions: number;
    indexedP50Ms: number;
    naiveP50Ms: number;
    speedup: number;
    adaptiveP50Ms: number;
    adaptiveOverBest: number;
    adaptiveNaiveFileCount: number;
    adaptiveIndexedFileCount: number;
  }>;
  repositories: Array<{
    repository: string;
    caseCount: number;
    projectionCaseCount: number;
    medianProjectionSpeedup: number | null;
    medianAdaptiveOverBest: number | null;
    adaptiveWithin25PctCases: number;
    adaptiveWithin25PctRate: number | null;
    parentAwareMedianCaseP50Ms: number | null;
  }>;
};

export function parseAstDiffRepositoryFixture(value: unknown): AstDiffRepositoryFixture {
  const root = objectAt(value, "fixture");
  if (root.schemaVersion !== 1) throw new Error("fixture schemaVersion must be 1");
  const sourceDatasetId = stringAt(root.sourceDatasetId, "fixture.sourceDatasetId");
  const development = sourceDatasetId === "ast-diff-confirmatory-v1-phase1";
  const performanceHoldout = sourceDatasetId === "ast-diff-adaptive-performance-holdout-v1";
  if (!development && !performanceHoldout) {
    throw new Error("annotation holdout input is forbidden for repository performance work");
  }
  const expectedStatus = development
    ? "post-hoc development corpus; not confirmatory evidence"
    : "performance-only holdout fixed before adaptive benchmark execution";
  if (root.status !== expectedStatus) {
    throw new Error("fixture status does not match its fixed source dataset");
  }
  if (!Array.isArray(root.cases) || root.cases.length === 0) {
    throw new Error("fixture.cases must be a non-empty array");
  }
  const seenCaseIds = new Set<string>();
  const cases = root.cases.map((item, index) => {
    const testCase = parseCase(item, index);
    if (seenCaseIds.has(testCase.id)) throw new Error(`duplicate fixture case: ${testCase.id}`);
    seenCaseIds.add(testCase.id);
    return testCase;
  });
  return {
    schemaVersion: 1,
    sourceDatasetId,
    status: expectedStatus,
    cases,
  };
}

export function runAstDiffRepositoryCase(
  testCase: AstDiffRepositoryCaseFixture,
  condition: AstDiffRepositoryCondition,
): Map<string, NodeDiffStat | "added" | "modified"> {
  const output = new Map<string, NodeDiffStat | "added" | "modified">();
  for (const file of testCase.files) {
    const path = file.afterPath ?? file.beforePath;
    if (!path) continue;
    if (condition === "parent-aware") {
      for (const [symbolId, status] of diffAstSymbols(file.before, file.after)) {
        output.set(`${path}\0${symbolId}`, status);
      }
      continue;
    }
    const symbols = file.after.map((symbol) => {
      const startLine = symbol.startLine ?? lineFromId(symbol.id);
      const endLine = symbol.endLine ?? startLine + Math.max(1, symbol.loc) - 1;
      return {
        id: symbol.id,
        metrics: { loc: symbol.loc },
        sourceRange: { startLine, endLine },
      };
    });
    const stats =
      condition === "projection-indexed"
        ? buildSymbolDiffStatsIndexed(symbols, file.hunks)
        : condition === "projection-naive"
          ? buildSymbolDiffStatsNaive(symbols, file.hunks)
          : buildSymbolDiffStats(symbols, file.hunks);
    for (const [symbolId, stat] of stats) output.set(`${path}\0${symbolId}`, stat);
  }
  return output;
}

export function summarizeAstDiffRepositoryMeasurements(
  measurements: readonly AstDiffRepositoryMeasurement[],
): AstDiffRepositorySummary {
  if (measurements.length === 0) throw new Error("repository measurements must not be empty");
  const byGroup = new Map<string, AstDiffRepositoryMeasurement[]>();
  for (const measurement of measurements) {
    validateMeasurement(measurement);
    const key = groupKey(measurement);
    const group = byGroup.get(key) ?? [];
    group.push(measurement);
    byGroup.set(key, group);
  }
  const groups = [...byGroup.values()].map(summarizeGroup).sort(compareGroups);
  const projectionByCase = new Map<string, AstDiffRepositoryGroup[]>();
  for (const group of groups) {
    if (!group.condition.startsWith("projection-")) continue;
    const list = projectionByCase.get(group.caseId) ?? [];
    list.push(group);
    projectionByCase.set(group.caseId, list);
  }
  const projectionComparisons: AstDiffRepositorySummary["projectionComparisons"] = [];
  for (const scenario of projectionByCase.values()) {
    const indexed = scenario.find((group) => group.condition === "projection-indexed");
    const naive = scenario.find((group) => group.condition === "projection-naive");
    const adaptive = scenario.find((group) => group.condition === "projection-adaptive");
    if (
      indexed &&
      naive &&
      indexed.durationPerIterationMs &&
      naive.durationPerIterationMs &&
      (indexed.outputDigest !== naive.outputDigest || indexed.outputItems !== naive.outputItems)
    ) {
      throw new Error(`projection output digest mismatch for ${indexed.caseId}`);
    }
    if (
      !indexed ||
      !naive ||
      !adaptive ||
      !indexed.durationPerIterationMs ||
      !naive.durationPerIterationMs ||
      !adaptive.durationPerIterationMs
    ) {
      continue;
    }
    if (indexed.repository !== naive.repository || indexed.repository !== adaptive.repository) {
      throw new Error(`projection repository mismatch for ${indexed.caseId}`);
    }
    if (
      indexed.outputDigest !== adaptive.outputDigest ||
      indexed.outputItems !== adaptive.outputItems
    ) {
      throw new Error(`projection output digest mismatch for ${indexed.caseId}`);
    }
    projectionComparisons.push({
      caseId: indexed.caseId,
      repository: indexed.repository,
      fileCount: indexed.fileCount,
      afterSymbolCount: indexed.afterSymbolCount,
      hunkCount: indexed.hunkCount,
      repetitions: Math.min(indexed.successfulRepetitions, naive.successfulRepetitions),
      indexedP50Ms: indexed.durationPerIterationMs.p50,
      naiveP50Ms: naive.durationPerIterationMs.p50,
      speedup: naive.durationPerIterationMs.p50 / indexed.durationPerIterationMs.p50,
      adaptiveP50Ms: adaptive.durationPerIterationMs.p50,
      adaptiveOverBest:
        adaptive.durationPerIterationMs.p50 /
        Math.min(indexed.durationPerIterationMs.p50, naive.durationPerIterationMs.p50),
      adaptiveNaiveFileCount: adaptive.adaptiveNaiveFileCount,
      adaptiveIndexedFileCount: adaptive.adaptiveIndexedFileCount,
    });
  }
  projectionComparisons.sort(
    (left, right) =>
      left.repository.localeCompare(right.repository) || left.caseId.localeCompare(right.caseId),
  );
  const repositories = [...new Set(groups.map((group) => group.repository))]
    .sort((left, right) => left.localeCompare(right))
    .map((repository) => {
      const repositoryGroups = groups.filter((group) => group.repository === repository);
      const comparisons = projectionComparisons.filter((item) => item.repository === repository);
      const parentAware = repositoryGroups.filter(
        (group) => group.condition === "parent-aware" && group.durationPerIterationMs,
      );
      const adaptiveWithin25PctCases = comparisons.filter(
        (item) => item.adaptiveOverBest <= 1.25,
      ).length;
      return {
        repository,
        caseCount: new Set(repositoryGroups.map((group) => group.caseId)).size,
        projectionCaseCount: comparisons.length,
        medianProjectionSpeedup:
          comparisons.length > 0 ? median(comparisons.map((item) => item.speedup)) : null,
        medianAdaptiveOverBest:
          comparisons.length > 0 ? median(comparisons.map((item) => item.adaptiveOverBest)) : null,
        adaptiveWithin25PctCases,
        adaptiveWithin25PctRate:
          comparisons.length > 0 ? adaptiveWithin25PctCases / comparisons.length : null,
        parentAwareMedianCaseP50Ms:
          parentAware.length > 0
            ? median(parentAware.map((group) => group.durationPerIterationMs!.p50))
            : null,
      };
    });
  return { groups, projectionComparisons, repositories };
}

function parseCase(value: unknown, index: number): AstDiffRepositoryCaseFixture {
  const item = objectAt(value, `fixture.cases[${index}]`);
  const id = stringAt(item.id, `fixture.cases[${index}].id`);
  const repository = stringAt(item.repository, `${id}.repository`);
  const beforeRevision = stringAt(item.beforeRevision, `${id}.beforeRevision`);
  const afterRevision = stringAt(item.afterRevision, `${id}.afterRevision`);
  if (!Array.isArray(item.files) || item.files.length === 0) {
    throw new Error(`${id}.files must be a non-empty array`);
  }
  const files = item.files.map((file, fileIndex) => parseFile(file, id, fileIndex));
  return { id, repository, beforeRevision, afterRevision, files };
}

function parseFile(value: unknown, caseId: string, index: number): AstDiffRepositoryFileFixture {
  const path = `${caseId}.files[${index}]`;
  const item = objectAt(value, path);
  if (
    item.changeStatus !== "modified" &&
    item.changeStatus !== "added" &&
    item.changeStatus !== "deleted" &&
    item.changeStatus !== "renamed" &&
    item.changeStatus !== "copied"
  ) {
    throw new Error(`${path}.changeStatus is invalid`);
  }
  const changeStatus = item.changeStatus;
  const beforePath = nullableStringAt(item.beforePath, `${path}.beforePath`);
  const afterPath = nullableStringAt(item.afterPath, `${path}.afterPath`);
  if (!beforePath && !afterPath) throw new Error(`${path} must have a beforePath or afterPath`);
  const before = symbolsAt(item.before, `${path}.before`);
  const after = symbolsAt(item.after, `${path}.after`);
  if (!Array.isArray(item.hunks)) throw new Error(`${path}.hunks must be an array`);
  const hunks = item.hunks.map((hunk, hunkIndex) => {
    const raw = objectAt(hunk, `${path}.hunks[${hunkIndex}]`);
    return {
      oldStart: nonNegativeIntegerAt(raw.oldStart, `${path}.hunks[${hunkIndex}].oldStart`),
      oldLines: nonNegativeIntegerAt(raw.oldLines, `${path}.hunks[${hunkIndex}].oldLines`),
      newStart: nonNegativeIntegerAt(raw.newStart, `${path}.hunks[${hunkIndex}].newStart`),
      newLines: nonNegativeIntegerAt(raw.newLines, `${path}.hunks[${hunkIndex}].newLines`),
    };
  });
  return { changeStatus, beforePath, afterPath, before, after, hunks };
}

function symbolsAt(value: unknown, path: string): AstSymbolLike[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value.map((symbol, index) => {
    const raw = objectAt(symbol, `${path}[${index}]`);
    const parsed: AstSymbolLike = {
      id: stringAt(raw.id, `${path}[${index}].id`),
      name: stringAt(raw.name, `${path}[${index}].name`),
      kind: stringAt(raw.kind, `${path}[${index}].kind`),
      loc: positiveIntegerAt(raw.loc, `${path}[${index}].loc`),
    };
    for (const key of ["startLine", "endLine", "complexity"] as const) {
      if (raw[key] !== undefined) parsed[key] = nonNegativeIntegerAt(raw[key], `${path}.${key}`);
    }
    if (raw.parentClass !== undefined) {
      parsed.parentClass = stringAt(raw.parentClass, `${path}[${index}].parentClass`);
    }
    if (raw.fingerprint !== undefined) {
      parsed.fingerprint = stringAt(raw.fingerprint, `${path}[${index}].fingerprint`);
    }
    return parsed;
  });
}

function summarizeGroup(
  measurements: readonly AstDiffRepositoryMeasurement[],
): AstDiffRepositoryGroup {
  const first = measurements[0]!;
  for (const measurement of measurements) {
    for (const key of [
      "repository",
      "fileCount",
      "beforeSymbolCount",
      "afterSymbolCount",
      "hunkCount",
      "adaptiveNaiveFileCount",
      "adaptiveIndexedFileCount",
    ] as const) {
      if (measurement[key] !== first[key]) {
        throw new Error(`inconsistent ${key} in repository group ${groupKey(first)}`);
      }
    }
  }
  const successful = measurements.filter(
    (
      item,
    ): item is AstDiffRepositoryMeasurement & {
      durationPerIterationMs: number;
      maxRssKb: number;
      outputDigest: string;
      outputItems: number;
    } => item.status === "ok",
  );
  const digests = new Set(successful.map((item) => item.outputDigest));
  const outputItems = new Set(successful.map((item) => item.outputItems));
  if (digests.size > 1 || outputItems.size > 1) {
    throw new Error(`non-deterministic repository output for ${groupKey(first)}`);
  }
  return {
    caseId: first.caseId,
    repository: first.repository,
    condition: first.condition,
    fileCount: first.fileCount,
    beforeSymbolCount: first.beforeSymbolCount,
    afterSymbolCount: first.afterSymbolCount,
    hunkCount: first.hunkCount,
    adaptiveNaiveFileCount: first.adaptiveNaiveFileCount,
    adaptiveIndexedFileCount: first.adaptiveIndexedFileCount,
    repetitions: measurements.length,
    successfulRepetitions: successful.length,
    failures: measurements.length - successful.length,
    timeouts: measurements.filter((item) => item.status === "timeout").length,
    durationPerIterationMs: successful.length
      ? distribution(successful.map((item) => item.durationPerIterationMs))
      : null,
    maxRssKb: successful.length ? distribution(successful.map((item) => item.maxRssKb)) : null,
    outputDigest: successful[0]?.outputDigest ?? null,
    outputItems: successful[0]?.outputItems ?? null,
  };
}

function validateMeasurement(measurement: AstDiffRepositoryMeasurement): void {
  if (measurement.schemaVersion !== 1) throw new Error("measurement schemaVersion must be 1");
  stringAt(measurement.caseId, "measurement.caseId");
  stringAt(measurement.repository, "measurement.repository");
  if (!AST_DIFF_REPOSITORY_CONDITIONS.includes(measurement.condition)) {
    throw new Error(`unknown repository condition: ${measurement.condition}`);
  }
  positiveIntegerAt(measurement.repetition, "measurement.repetition");
  nonNegativeIntegerAt(measurement.warmupIterations, "measurement.warmupIterations");
  positiveIntegerAt(measurement.batchIterations, "measurement.batchIterations");
  positiveIntegerAt(measurement.fileCount, "measurement.fileCount");
  nonNegativeIntegerAt(measurement.beforeSymbolCount, "measurement.beforeSymbolCount");
  nonNegativeIntegerAt(measurement.afterSymbolCount, "measurement.afterSymbolCount");
  nonNegativeIntegerAt(measurement.hunkCount, "measurement.hunkCount");
  nonNegativeIntegerAt(measurement.adaptiveNaiveFileCount, "measurement.adaptiveNaiveFileCount");
  nonNegativeIntegerAt(
    measurement.adaptiveIndexedFileCount,
    "measurement.adaptiveIndexedFileCount",
  );
  if (
    measurement.adaptiveNaiveFileCount + measurement.adaptiveIndexedFileCount !==
    measurement.fileCount
  ) {
    throw new Error("measurement adaptive file counts must sum to fileCount");
  }
  if (measurement.status === "ok") {
    if (
      measurement.durationMs === null ||
      measurement.durationMs <= 0 ||
      measurement.durationPerIterationMs === null ||
      measurement.durationPerIterationMs <= 0 ||
      measurement.maxRssKb === null ||
      measurement.maxRssKb <= 0 ||
      !measurement.outputDigest ||
      measurement.outputItems === null ||
      measurement.outputItems < 0
    ) {
      throw new Error("successful repository measurement is incomplete");
    }
  }
}

function groupKey(measurement: AstDiffRepositoryMeasurement): string {
  return `${measurement.repository}\0${measurement.caseId}\0${measurement.condition}`;
}

function compareGroups(left: AstDiffRepositoryGroup, right: AstDiffRepositoryGroup): number {
  return (
    left.repository.localeCompare(right.repository) ||
    left.caseId.localeCompare(right.caseId) ||
    AST_DIFF_REPOSITORY_CONDITIONS.indexOf(left.condition) -
      AST_DIFF_REPOSITORY_CONDITIONS.indexOf(right.condition)
  );
}

function distribution(values: readonly number[]): AstDiffRepositoryDistribution {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: sorted.length,
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    min: sorted[0]!,
    max: sorted.at(-1)!,
  };
}

function median(values: readonly number[]): number {
  return quantile(
    [...values].sort((left, right) => left - right),
    0.5,
  );
}

function quantile(sorted: readonly number[], quantileValue: number): number {
  if (sorted.length === 0) throw new Error("cannot compute a quantile of no values");
  if (sorted.length === 1) return sorted[0]!;
  const position = (sorted.length - 1) * quantileValue;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function nullableStringAt(value: unknown, path: string): string | null {
  if (value === null) return null;
  return stringAt(value, path);
}

function nonNegativeIntegerAt(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative safe integer`);
  }
  return value;
}

function positiveIntegerAt(value: unknown, path: string): number {
  const parsed = nonNegativeIntegerAt(value, path);
  if (parsed === 0) throw new Error(`${path} must be positive`);
  return parsed;
}

function lineFromId(id: string): number {
  const line = Number.parseInt(id.slice(id.lastIndexOf(":") + 1), 10);
  return Number.isFinite(line) ? line : 1;
}
