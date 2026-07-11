import { describe, expect, it } from "vitest";
import { summarizeRepositoryEvaluationCost } from "./repositoryEvaluationCost.ts";

describe("repository evaluation cost summary", () => {
  it("averages repetitions within repositories before forming a repository-level CI", () => {
    const summary = summarizeRepositoryEvaluationCost([
      {
        repository: "owner/a",
        caseName: "case-1",
        seed: 3,
        repetition: 0,
        baselineMs: 10,
        stableMs: 20,
        baselineSteps: 100,
        stableSteps: 250,
        baselineWeightedSolves: 1,
        stableWeightedSolves: 3,
      },
      {
        repository: "owner/a",
        caseName: "case-1",
        seed: 3,
        repetition: 1,
        baselineMs: 12,
        stableMs: 24,
        baselineSteps: 100,
        stableSteps: 250,
        baselineWeightedSolves: 1,
        stableWeightedSolves: 3,
      },
      {
        repository: "owner/b",
        caseName: "case-2",
        seed: 3,
        repetition: 0,
        baselineMs: 20,
        stableMs: 30,
        baselineSteps: 200,
        stableSteps: 300,
        baselineWeightedSolves: 1,
        stableWeightedSolves: 2,
      },
    ]);

    expect(summary.repositories).toEqual([
      expect.objectContaining({
        repository: "owner/a",
        measurements: 2,
        runtimeRatio: 2,
        runtimeOverheadMs: 11,
        stepOverhead: 150,
        weightedSolveOverhead: 2,
      }),
      expect.objectContaining({
        repository: "owner/b",
        measurements: 1,
        runtimeRatio: 1.5,
        runtimeOverheadMs: 10,
        stepOverhead: 100,
        weightedSolveOverhead: 1,
      }),
    ]);
    expect(summary.repositorySummary).toMatchObject({
      unit: "repository mean paired cost",
      repositories: 2,
      runtimeRatio: { n: 2, mean: 1.75 },
      runtimeOverheadMs: { n: 2, mean: 10.5 },
      stepOverhead: { n: 2, mean: 125 },
      weightedSolveOverhead: { n: 2, mean: 1.5 },
    });
  });

  it("rejects empty or invalid timing records", () => {
    expect(() => summarizeRepositoryEvaluationCost([])).toThrow(/at least one measurement/);
    expect(() =>
      summarizeRepositoryEvaluationCost([
        {
          repository: "owner/a",
          caseName: "case",
          seed: 3,
          repetition: 0,
          baselineMs: 0,
          stableMs: 1,
          baselineSteps: 1,
          stableSteps: 2,
          baselineWeightedSolves: 1,
          stableWeightedSolves: 2,
        },
      ]),
    ).toThrow(/positive/);
  });
});
