import { describe, expect, it } from "vitest";
import {
  evaluateAstDiffGoldSet,
  extendAstDiffAnnotationManifest,
  materializeAstDiffGoldSet,
  parseAstDiffAnnotationManifest,
  parseAstDiffGoldSet,
  type AstDiffGoldSet,
} from "./astSymbolDiffEvaluation.ts";

const symbol = (
  id: string,
  name: string,
  kind: string,
  startLine: number,
  options: { loc?: number; complexity?: number; fingerprint?: string } = {},
) => ({
  id,
  name,
  kind,
  startLine,
  endLine: startLine + (options.loc ?? 1) - 1,
  loc: options.loc ?? 1,
  complexity: options.complexity ?? 1,
  ...(options.fingerprint === undefined ? {} : { fingerprint: options.fingerprint }),
});

const goldSet: AstDiffGoldSet = {
  schemaVersion: 1,
  datasetId: "unit-gold",
  cases: [
    {
      id: "body-edit",
      language: "typescript",
      repository: "example/repo",
      beforeRevision: "a",
      afterRevision: "b",
      file: "src/a.ts",
      changeKinds: ["body-edit", "same-size-edit"],
      before: [symbol("before:run", "run", "function", 1, { fingerprint: "old" })],
      after: [symbol("after:run", "run", "function", 4, { fingerprint: "new" })],
      expected: [{ symbolId: "after:run", status: "modified" }],
    },
    {
      id: "addition-with-false-positive",
      language: "typescript",
      repository: "example/repo",
      beforeRevision: "b",
      afterRevision: "c",
      file: "src/b.ts",
      changeKinds: ["addition"],
      before: [],
      after: [
        symbol("after:added", "added", "function", 1),
        symbol("after:noise", "noise", "function", 3),
      ],
      expected: [{ symbolId: "after:added", status: "added" }],
    },
  ],
};

describe("evaluateAstDiffGoldSet", () => {
  it("reports reproducible micro, per-case, language, and change-kind metrics", () => {
    const report = evaluateAstDiffGoldSet(goldSet);

    expect(report.datasetId).toBe("unit-gold");
    expect(report.micro).toMatchObject({
      cases: 2,
      expected: 2,
      predicted: 3,
      truePositive: 2,
      falsePositive: 1,
      falseNegative: 0,
      precision: 2 / 3,
      recall: 1,
      f1: 0.8,
      statusCorrect: 2,
      statusAccuracy: 1,
    });
    expect(report.byLanguage.typescript).toMatchObject({ cases: 2, f1: 0.8 });
    expect(report.byRepository["example/repo"]).toMatchObject({ cases: 2, f1: 0.8 });
    expect(report.byChangeKind["body-edit"]).toMatchObject({ cases: 1, f1: 1 });
    expect(report.byChangeKind.addition).toMatchObject({
      cases: 1,
      falsePositive: 1,
      precision: 0.5,
    });
    expect(report.cases[1]).toMatchObject({
      id: "addition-with-false-positive",
      falsePositiveIds: ["after:noise"],
      falseNegativeIds: [],
    });
  });

  it("reports how many changed after-lines are representable by extracted symbol ranges", () => {
    const report = evaluateAstDiffGoldSet(
      {
        schemaVersion: 1,
        datasetId: "coverage",
        cases: [
          {
            id: "partly-covered",
            language: "typescript",
            repository: "example/repo",
            beforeRevision: "a",
            afterRevision: "b",
            file: "src/a.ts",
            changeKinds: ["body-edit"],
            before: [],
            after: [symbol("after:run", "run", "function", 4, { loc: 3 })],
            expected: [{ symbolId: "after:run", status: "added" }],
          },
        ],
      },
      new Map([["partly-covered", [3, 4, 5, 10]]]),
    );

    expect(report.representation?.micro).toEqual({
      cases: 1,
      changedAfterLines: 4,
      coveredAfterLines: 2,
      coverage: 0.5,
    });
    expect(report.representation?.cases[0]).toMatchObject({
      id: "partly-covered",
      uncoveredAfterLines: [3, 10],
    });
    expect(report.representation?.byRepository["example/repo"]?.coverage).toBe(0.5);
  });

  it("treats an empty prediction and empty gold label as a correct negative case", () => {
    const report = evaluateAstDiffGoldSet({
      schemaVersion: 1,
      datasetId: "negative",
      cases: [
        {
          id: "line-shift-only",
          language: "typescript",
          repository: "example/repo",
          beforeRevision: "a",
          afterRevision: "b",
          file: "src/a.ts",
          changeKinds: ["line-shift-only"],
          before: [symbol("before:run", "run", "function", 1)],
          after: [symbol("after:run", "run", "function", 20)],
          expected: [],
        },
      ],
    });

    expect(report.micro).toMatchObject({ precision: 1, recall: 1, f1: 1 });
  });
});

describe("parseAstDiffGoldSet", () => {
  it("rejects labels that do not reference an after symbol", () => {
    expect(() =>
      parseAstDiffGoldSet({
        ...goldSet,
        cases: [{ ...goldSet.cases[0], expected: [{ symbolId: "missing", status: "modified" }] }],
      }),
    ).toThrow(/missing.*after symbol/);
  });

  it("rejects duplicate case and symbol ids", () => {
    expect(() =>
      parseAstDiffGoldSet({ ...goldSet, cases: [goldSet.cases[0], goldSet.cases[0]] }),
    ).toThrow(/duplicate case id/);
    expect(() =>
      parseAstDiffGoldSet({
        ...goldSet,
        cases: [
          {
            ...goldSet.cases[0],
            after: [goldSet.cases[0]!.after[0]!, goldSet.cases[0]!.after[0]!],
          },
        ],
      }),
    ).toThrow(/duplicate after symbol id/);
  });
});

describe("materializeAstDiffGoldSet", () => {
  it("resolves semantic annotations to revision-specific symbol ids", async () => {
    const beforeClass = {
      ...symbol("before:class", "Service", "class", 1),
      endLine: 10,
    };
    const afterClass = {
      ...symbol("after:class", "Service", "class", 4),
      endLine: 13,
    };
    const beforeRun = {
      ...symbol("before:run", "run", "method", 2, { fingerprint: "old" }),
      parentClass: beforeClass.id,
    };
    const afterRun = {
      ...symbol("after:run", "run", "method", 5, { fingerprint: "new" }),
      parentClass: afterClass.id,
    };
    const revisions: Record<string, ReturnType<typeof symbol>[]> = {
      before: [beforeClass, beforeRun],
      after: [afterClass, afterRun],
    };

    const materialized = await materializeAstDiffGoldSet(
      {
        schemaVersion: 1,
        datasetId: "annotations",
        cases: [
          {
            id: "method-edit",
            language: "typescript",
            repository: "example/repo",
            repositoryPath: ".",
            beforeRevision: "before",
            afterRevision: "after",
            file: "src/a.ts",
            changeKinds: ["body-edit"],
            expected: [
              {
                symbol: { kind: "method", name: "run", parent: { kind: "class", name: "Service" } },
                status: "modified",
              },
              { symbol: { kind: "class", name: "Service" }, status: "modified" },
            ],
          },
        ],
      },
      async ({ revision }) => revisions[revision] ?? [],
    );

    expect(materialized.cases[0]).toMatchObject({
      before: [{ id: "before:class" }, { id: "before:run" }],
      after: [{ id: "after:class" }, { id: "after:run" }],
      expected: [
        { symbolId: "after:run", status: "modified" },
        { symbolId: "after:class", status: "modified" },
      ],
    });
  });

  it("fails closed when an annotation selector is ambiguous", async () => {
    await expect(
      materializeAstDiffGoldSet(
        {
          schemaVersion: 1,
          datasetId: "ambiguous",
          cases: [
            {
              id: "duplicate-functions",
              language: "typescript",
              repository: "example/repo",
              repositoryPath: ".",
              beforeRevision: "before",
              afterRevision: "after",
              file: "src/a.ts",
              changeKinds: ["body-edit"],
              expected: [{ symbol: { kind: "function", name: "run" }, status: "modified" }],
            },
          ],
        },
        async () => [
          symbol("after:run:1", "run", "function", 1),
          symbol("after:run:2", "run", "function", 10),
        ],
      ),
    ).rejects.toThrow(/duplicate-functions.*run.*ambiguous/);
  });
});

describe("parseAstDiffAnnotationManifest", () => {
  it("rejects invalid statuses and duplicate case ids before materialization", () => {
    const base = {
      schemaVersion: 1,
      datasetId: "annotations",
      cases: [
        {
          id: "case-a",
          language: "typescript",
          repository: "example/repo",
          repositoryPath: ".",
          beforeRevision: "a",
          afterRevision: "b",
          file: "src/a.ts",
          changeKinds: ["body-edit"],
          expected: [{ symbol: { kind: "function", name: "run" }, status: "changed" }],
        },
      ],
    };
    expect(() => parseAstDiffAnnotationManifest(base)).toThrow(/invalid.*status/);
    expect(() =>
      parseAstDiffAnnotationManifest({
        ...base,
        cases: [
          { ...base.cases[0], expected: [] },
          { ...base.cases[0], expected: [] },
        ],
      }),
    ).toThrow(/duplicate case id/);
  });
});

describe("extendAstDiffAnnotationManifest", () => {
  it("adds post-hoc labels without mutating the frozen base manifest", () => {
    const base = parseAstDiffAnnotationManifest({
      schemaVersion: 1,
      datasetId: "base",
      cases: [
        {
          id: "case-a",
          language: "typescript",
          repository: "example/repo",
          repositoryPath: ".",
          beforeRevision: "a",
          afterRevision: "b",
          file: "src/a.ts",
          changeKinds: ["body-edit"],
          expected: [{ symbol: { kind: "function", name: "run" }, status: "modified" }],
        },
      ],
    });

    const extended = extendAstDiffAnnotationManifest(base, {
      schemaVersion: 1,
      datasetId: "v2",
      baseDatasetId: "base",
      additions: [
        {
          caseId: "case-a",
          expected: [{ symbol: { kind: "variable", name: "config" }, status: "modified" }],
        },
      ],
    });

    expect(base.cases[0]!.expected).toHaveLength(1);
    expect(extended.datasetId).toBe("v2");
    expect(extended.cases[0]!.expected).toHaveLength(2);
  });

  it("rejects missing cases and duplicate semantic selectors", () => {
    const base = parseAstDiffAnnotationManifest({
      schemaVersion: 1,
      datasetId: "base",
      cases: [
        {
          id: "case-a",
          language: "typescript",
          repository: "example/repo",
          repositoryPath: ".",
          beforeRevision: "a",
          afterRevision: "b",
          file: "src/a.ts",
          changeKinds: ["body-edit"],
          expected: [{ symbol: { kind: "function", name: "run" }, status: "modified" }],
        },
      ],
    });
    expect(() =>
      extendAstDiffAnnotationManifest(base, {
        schemaVersion: 1,
        datasetId: "v2",
        baseDatasetId: "base",
        additions: [{ caseId: "missing", expected: [] }],
      }),
    ).toThrow(/missing case/);
    expect(() =>
      extendAstDiffAnnotationManifest(base, {
        schemaVersion: 1,
        datasetId: "v2",
        baseDatasetId: "base",
        additions: [
          {
            caseId: "case-a",
            expected: [{ symbol: { kind: "function", name: "run" }, status: "modified" }],
          },
        ],
      }),
    ).toThrow(/duplicate selector/);
  });
});
