import { describe, expect, it } from "vitest";
import {
  parseAstDiffRepositoryFixture,
  runAstDiffRepositoryCase,
  summarizeAstDiffRepositoryMeasurements,
  type AstDiffRepositoryCaseFixture,
  type AstDiffRepositoryMeasurement,
} from "./astDiffRepositoryBenchmark.ts";

describe("AST diff repository benchmark contract", () => {
  it("parses a development fixture and rejects confirmatory holdout input", () => {
    const fixture = {
      schemaVersion: 1,
      sourceDatasetId: "ast-diff-confirmatory-v1-phase1",
      status: "post-hoc development corpus; not confirmatory evidence",
      cases: [repositoryCase()],
    };

    expect(parseAstDiffRepositoryFixture(fixture)).toEqual(fixture);
    expect(() =>
      parseAstDiffRepositoryFixture({
        ...fixture,
        sourceDatasetId: "ast-diff-confirmatory-v2-holdout",
      }),
    ).toThrow(/holdout/i);
  });
});

describe("runAstDiffRepositoryCase", () => {
  it("keeps indexed and naive projection equivalent across multiple files", () => {
    const testCase = repositoryCase();

    expect([...runAstDiffRepositoryCase(testCase, "projection-indexed")]).toEqual([
      ...runAstDiffRepositoryCase(testCase, "projection-naive"),
    ]);
  });

  it("runs parent-aware tree diff for the whole commit", () => {
    expect([...runAstDiffRepositoryCase(repositoryCase(), "parent-aware")]).toEqual([
      ["src/a.ts\0symbol:src/a.ts:function:a:2", "modified"],
      ["src/b.ts\0symbol:src/b.ts:function:b:1", "added"],
    ]);
  });
});

describe("summarizeAstDiffRepositoryMeasurements", () => {
  it("uses cases as paired units and repositories as the outer summary unit", () => {
    const measurements = [
      measurement("case-a", "owner/repo-a", "projection-indexed", 1, 2),
      measurement("case-a", "owner/repo-a", "projection-indexed", 2, 4),
      measurement("case-a", "owner/repo-a", "projection-naive", 1, 8),
      measurement("case-a", "owner/repo-a", "projection-naive", 2, 10),
      measurement("case-a", "owner/repo-a", "parent-aware", 1, 5, "tree-a"),
      measurement("case-a", "owner/repo-a", "parent-aware", 2, 7, "tree-a"),
      measurement("case-b", "owner/repo-a", "projection-indexed", 1, 4),
      measurement("case-b", "owner/repo-a", "projection-indexed", 2, 6),
      measurement("case-b", "owner/repo-a", "projection-naive", 1, 18),
      measurement("case-b", "owner/repo-a", "projection-naive", 2, 22),
      measurement("case-b", "owner/repo-a", "parent-aware", 1, 9, "tree-b"),
      measurement("case-b", "owner/repo-a", "parent-aware", 2, 11, "tree-b"),
    ];

    const summary = summarizeAstDiffRepositoryMeasurements(measurements);
    expect(summary.projectionComparisons).toEqual([
      expect.objectContaining({ caseId: "case-a", indexedP50Ms: 3, naiveP50Ms: 9, speedup: 3 }),
      expect.objectContaining({ caseId: "case-b", indexedP50Ms: 5, naiveP50Ms: 20, speedup: 4 }),
    ]);
    expect(summary.repositories).toEqual([
      expect.objectContaining({
        repository: "owner/repo-a",
        caseCount: 2,
        projectionCaseCount: 2,
        medianProjectionSpeedup: 3.5,
        parentAwareMedianCaseP50Ms: 8,
      }),
    ]);
  });

  it("fails closed when paired projection outputs differ", () => {
    expect(() =>
      summarizeAstDiffRepositoryMeasurements([
        measurement("case-a", "owner/repo-a", "projection-indexed", 1, 2),
        measurement("case-a", "owner/repo-a", "projection-naive", 1, 8, "different"),
      ]),
    ).toThrow(/digest/i);
  });
});

function repositoryCase(): AstDiffRepositoryCaseFixture {
  return {
    id: "case-a",
    repository: "owner/repo-a",
    beforeRevision: "a".repeat(40),
    afterRevision: "b".repeat(40),
    files: [
      {
        changeStatus: "modified",
        beforePath: "src/a.ts",
        afterPath: "src/a.ts",
        before: [symbol("src/a.ts", "a", 1, "old")],
        after: [symbol("src/a.ts", "a", 2, "new")],
        hunks: [{ oldStart: 1, oldLines: 1, newStart: 2, newLines: 1 }],
      },
      {
        changeStatus: "added",
        beforePath: null,
        afterPath: "src/b.ts",
        before: [],
        after: [symbol("src/b.ts", "b", 1, "added")],
        hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 2 }],
      },
    ],
  };
}

function symbol(path: string, name: string, line: number, fingerprint: string) {
  return {
    id: `symbol:${path}:function:${name}:${line}`,
    name,
    kind: "function",
    startLine: line,
    endLine: line + 1,
    loc: 2,
    complexity: 1,
    fingerprint,
  };
}

function measurement(
  caseId: string,
  repository: string,
  condition: AstDiffRepositoryMeasurement["condition"],
  repetition: number,
  durationPerIterationMs: number,
  outputDigest = `projection-${caseId}`,
): AstDiffRepositoryMeasurement {
  return {
    schemaVersion: 1,
    caseId,
    repository,
    condition,
    repetition,
    warmupIterations: 2,
    batchIterations: 10,
    fileCount: 2,
    beforeSymbolCount: 2,
    afterSymbolCount: 3,
    hunkCount: 4,
    status: "ok",
    durationMs: durationPerIterationMs * 10,
    durationPerIterationMs,
    maxRssKb: 100,
    outputDigest,
    outputItems: 2,
    error: null,
  };
}
