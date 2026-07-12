import { describe, expect, it } from "vitest";
import { compareAstDiffVariants } from "./astDiffVariantComparison.ts";
import type { AstDiffEvaluationReport } from "./astSymbolDiffEvaluation.ts";

const report = (
  datasetId: string,
  args: { expected: number; covered: number; changed: number },
): AstDiffEvaluationReport => ({
  schemaVersion: 1,
  datasetId,
  micro: {
    cases: 2,
    expected: args.expected,
    predicted: args.expected,
    truePositive: args.expected,
    falsePositive: 0,
    falseNegative: 0,
    precision: 1,
    recall: 1,
    f1: 1,
    statusCorrect: args.expected,
    statusAccuracy: 1,
  },
  byLanguage: {},
  byRepository: {},
  byChangeKind: {},
  cases: [],
  representation: {
    micro: {
      cases: 2,
      changedAfterLines: args.changed,
      coveredAfterLines: args.covered,
      coverage: args.covered / args.changed,
    },
    byRepository: {},
    cases: [],
  },
});

describe("compareAstDiffVariants", () => {
  it("reports coverage gain alongside symbol-density cost against the first variant", () => {
    const comparison = compareAstDiffVariants([
      {
        label: "v1",
        report: report("v1", { expected: 10, covered: 50, changed: 100 }),
        afterSymbols: 100,
      },
      {
        label: "v2",
        report: report("v2", { expected: 12, covered: 60, changed: 100 }),
        afterSymbols: 110,
      },
    ]);

    expect(comparison.variants[0]).toMatchObject({
      label: "v1",
      coverage: 0.5,
      coverageDelta: 0,
      afterSymbols: 100,
      afterSymbolsDelta: 0,
    });
    expect(comparison.variants[1]).toMatchObject({
      label: "v2",
      coverage: 0.6,
      afterSymbols: 110,
      afterSymbolsDelta: 10,
      afterSymbolsDeltaRatio: 0.1,
    });
    expect(comparison.variants[1]!.coverageDelta).toBeCloseTo(0.1);
  });
});
