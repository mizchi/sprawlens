import { describe, expect, it } from "vitest";
import {
  assessAstDiffAdaptiveValidation,
  renderAstDiffAdaptiveValidationAssessment,
  type AstDiffAdaptiveValidationInput,
} from "./ast-diff-adaptive-validation.ts";

describe("assessAstDiffAdaptiveValidation", () => {
  it("passes the fixed gates when correctness, branch coverage, and tracking all pass", () => {
    const input = validationInput(
      Array.from({ length: 18 }, (_, index) =>
        comparison(index, index < 9 ? "naive" : "indexed", 1.05),
      ),
    );

    expect(assessAstDiffAdaptiveValidation(input)).toMatchObject({
      passed: true,
      gates: {
        outputExactness: { passed: true, matchingScenarios: 18, requiredScenarios: 18 },
        branchCoverage: {
          passed: true,
          minimumPerBranch: 3,
          naiveScenarios: 9,
          indexedScenarios: 9,
        },
        overallTracking: { passed: true, withinBound: 18, required: 15, total: 18 },
        branchTracking: {
          passed: true,
          branches: [
            { strategy: "naive", withinBound: 9, required: 8, total: 9, passed: true },
            { strategy: "indexed", withinBound: 9, required: 8, total: 9, passed: true },
          ],
        },
      },
      diagnostics: {
        choiceAgreement: 18,
        failures: 0,
        timeouts: 0,
        peakRssKb: 120_000,
      },
    });
  });

  it("fails branch coverage without hiding otherwise successful indexed tracking", () => {
    const input = validationInput(
      Array.from({ length: 18 }, (_, index) => comparison(index, "indexed", 1.08)),
    );
    const result = assessAstDiffAdaptiveValidation(input);

    expect(result.passed).toBe(false);
    expect(result.gates.branchCoverage).toEqual({
      passed: false,
      minimumPerBranch: 3,
      naiveScenarios: 0,
      indexedScenarios: 18,
    });
    expect(result.gates.overallTracking.passed).toBe(true);
    expect(result.gates.branchTracking).toEqual({
      passed: true,
      branches: [{ strategy: "indexed", withinBound: 18, required: 15, total: 18, passed: true }],
    });
  });

  it("fails output exactness when one scenario has a digest mismatch", () => {
    const input = validationInput(
      Array.from({ length: 18 }, (_, index) =>
        comparison(index, index < 9 ? "naive" : "indexed", 1.05),
      ),
    );
    input.groups.find(
      (group) =>
        group.symbolCount === 2_000 && group.hunkCount === 35 && group.condition === "naive",
    )!.outputDigest = "different";

    const result = assessAstDiffAdaptiveValidation(input);
    expect(result.passed).toBe(false);
    expect(result.gates.outputExactness).toMatchObject({
      passed: false,
      matchingScenarios: 17,
    });
  });

  it("does not count incomplete successful outputs as exact", () => {
    const input = validationInput(
      Array.from({ length: 18 }, (_, index) =>
        comparison(index, index < 9 ? "naive" : "indexed", 1.05),
      ),
    );
    for (const group of input.groups.filter(
      (group) => group.symbolCount === 2_000 && group.hunkCount === 35,
    )) {
      group.outputDigest = null;
      group.outputItems = null;
    }

    expect(assessAstDiffAdaptiveValidation(input).gates.outputExactness).toMatchObject({
      passed: false,
      matchingScenarios: 17,
    });
  });

  it("renders a failed branch-diversity gate without describing validation as passed", () => {
    const result = assessAstDiffAdaptiveValidation(
      validationInput(Array.from({ length: 18 }, (_, index) => comparison(index, "indexed", 1.08))),
    );

    expect(renderAstDiffAdaptiveValidationAssessment(result)).toContain("Overall: **FAILED**");
    expect(renderAstDiffAdaptiveValidationAssessment(result)).toContain(
      "| 2. Branch coverage | FAIL | naive 0; indexed 18; required ≥3 each |",
    );
  });
});

function comparison(
  index: number,
  adaptiveStrategy: "naive" | "indexed",
  adaptiveOverBest: number,
) {
  const symbolCount = [2_000, 10_000, 30_000]![Math.floor(index / 6)]!;
  const hunkCount = [35, 75, 125, 175, 225, 300]![index % 6]!;
  const indexedP50Ms = adaptiveStrategy === "indexed" ? 10 : 12;
  const naiveP50Ms = adaptiveStrategy === "naive" ? 10 : 12;
  return {
    symbolCount,
    hunkCount,
    indexedP50Ms,
    naiveP50Ms,
    speedup: naiveP50Ms / indexedP50Ms,
    adaptiveOverBest,
    adaptiveStrategy,
  } as const;
}

function validationInput(
  comparisons: AstDiffAdaptiveValidationInput["projectionComparisons"],
): AstDiffAdaptiveValidationInput {
  return {
    projectionComparisons: comparisons,
    groups: comparisons.flatMap(({ symbolCount, hunkCount }) =>
      (["indexed", "naive", "adaptive"] as const).map((condition) => ({
        kernel: "hunk-projection" as const,
        condition,
        symbolCount,
        hunkCount,
        repetitions: 7,
        successfulRepetitions: 7,
        failures: 0,
        timeouts: 0,
        outputDigest: `same-${symbolCount}-${hunkCount}`,
        outputItems: hunkCount,
        maxRssKb: { max: 120_000 },
      })),
    ),
  };
}
