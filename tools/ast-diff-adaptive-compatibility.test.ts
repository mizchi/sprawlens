import { describe, expect, it } from "vitest";
import {
  assessAstDiffAdaptiveCompatibility,
  renderAstDiffAdaptiveCompatibilityAssessment,
  type AstDiffAdaptiveCompatibilityInput,
} from "./ast-diff-adaptive-compatibility.ts";

describe("assessAstDiffAdaptiveCompatibility", () => {
  it("separates post-hoc two-corpus compatibility from held-out policy validation", () => {
    const input = compatibilityInput();

    expect(assessAstDiffAdaptiveCompatibility(input)).toMatchObject({
      threshold: 4.6917628829515525,
      natural: {
        cases: 2,
        files: 3,
        naiveFiles: 3,
        indexedFiles: 0,
        allNaiveCases: 2,
        v1ChoicePreservedCases: 2,
        forcedNaiveFasterCases: 2,
        outputExactCases: 2,
        failures: 0,
        timeouts: 0,
      },
      synthetic: {
        scenarios: 3,
        naiveScenarios: 0,
        indexedScenarios: 3,
        fastestChoiceAgreement: 3,
        outputExactScenarios: 3,
        validationPassed: false,
      },
      combined: {
        bothStrategiesObservedAcrossSeparateCorpora: true,
        corpusLevelChoiceAgreement: true,
        validatesSingleAdaptivePolicy: false,
      },
    });
  });

  it("reports when the candidate changes a frozen natural case's v1 choices", () => {
    const input = compatibilityInput();
    input.threshold = 0.1;
    input.syntheticAssessment.policyThreshold = 0.1;

    const result = assessAstDiffAdaptiveCompatibility(input);
    expect(result.natural.indexedFiles).toBeGreaterThan(0);
    expect(result.natural.v1ChoicePreservedCases).toBeLessThan(result.natural.cases);
    expect(result.combined.corpusLevelChoiceAgreement).toBe(false);
  });

  it("does not count mismatched natural projection outputs as exact", () => {
    const input = compatibilityInput();
    input.naturalGroups.find(
      (group) => group.caseId === "case-a" && group.condition === "projection-naive",
    )!.outputDigest = "different";

    expect(assessAstDiffAdaptiveCompatibility(input).natural.outputExactCases).toBe(1);
  });

  it("renders compatibility without upgrading it to validation", () => {
    const result = assessAstDiffAdaptiveCompatibility(compatibilityInput());
    const markdown = renderAstDiffAdaptiveCompatibilityAssessment(result);

    expect(markdown).toContain("Post-hoc compatibility: **CONSISTENT**");
    expect(markdown).toContain("Single-policy validation: **NO**");
    expect(markdown).toContain("Natural frozen holdout | naive | 3 files / 2 cases");
  });
});

function compatibilityInput(): AstDiffAdaptiveCompatibilityInput {
  const cases = [
    {
      id: "case-a",
      repository: "example/a",
      files: [file(10, 2), file(20, 3)],
    },
    { id: "case-b", repository: "example/b", files: [file(30, 1)] },
  ];
  return {
    threshold: 4.6917628829515525,
    naturalCases: cases,
    naturalComparisons: cases.map(({ id, repository, files }) => ({
      caseId: id,
      repository,
      speedup: 0.8,
      adaptiveNaiveFileCount: files.length,
      adaptiveIndexedFileCount: 0,
    })),
    naturalGroups: cases.flatMap(({ id, repository }) =>
      (["projection-indexed", "projection-naive", "projection-adaptive"] as const).map(
        (condition) => ({
          caseId: id,
          repository,
          condition,
          repetitions: 10,
          successfulRepetitions: 10,
          failures: 0,
          timeouts: 0,
          outputDigest: `digest-${id}`,
          outputItems: 10,
        }),
      ),
    ),
    syntheticAssessment: {
      policyThreshold: 4.6917628829515525,
      validationPassed: false,
      outputExactScenarios: 3,
      scenarios: 3,
      naiveScenarios: 0,
      indexedScenarios: 3,
      fastestChoiceAgreement: 3,
      failures: 0,
      timeouts: 0,
    },
  };
}

function file(symbolCount: number, hunkCount: number) {
  return {
    after: Array.from({ length: symbolCount }, () => ({})),
    hunks: Array.from({ length: hunkCount }, () => ({})),
  };
}
