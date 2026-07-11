import { summarizeSamples } from "@sprawlens/layout";

export type RepositoryCostMeasurement = {
  repository: string;
  caseName: string;
  seed: number;
  repetition: number;
  baselineMs: number;
  stableMs: number;
  baselineSteps: number;
  stableSteps: number;
  baselineWeightedSolves: number;
  stableWeightedSolves: number;
};

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** Summarize paired timings without treating cases or repetitions as independent repositories. */
export function summarizeRepositoryEvaluationCost(
  measurements: readonly RepositoryCostMeasurement[],
) {
  if (measurements.length === 0)
    throw new Error("cost benchmark requires at least one measurement");
  for (const measurement of measurements) {
    if (
      !Number.isFinite(measurement.baselineMs) ||
      !Number.isFinite(measurement.stableMs) ||
      measurement.baselineMs <= 0 ||
      measurement.stableMs <= 0
    ) {
      throw new Error("cost benchmark timings must be finite and positive");
    }
  }
  const repositoryNames = [...new Set(measurements.map(({ repository }) => repository))].sort();
  const repositories = repositoryNames.map((repository) => {
    const entries = measurements.filter((entry) => entry.repository === repository);
    return {
      repository,
      cases: new Set(entries.map((entry) => entry.caseName)).size,
      seeds: new Set(entries.map((entry) => entry.seed)).size,
      repetitions: new Set(entries.map((entry) => entry.repetition)).size,
      measurements: entries.length,
      baselineMs: mean(entries.map((entry) => entry.baselineMs)),
      stableMs: mean(entries.map((entry) => entry.stableMs)),
      runtimeRatio: mean(entries.map((entry) => entry.stableMs / entry.baselineMs)),
      runtimeOverheadMs: mean(entries.map((entry) => entry.stableMs - entry.baselineMs)),
      stepOverhead: mean(entries.map((entry) => entry.stableSteps - entry.baselineSteps)),
      weightedSolveOverhead: mean(
        entries.map((entry) => entry.stableWeightedSolves - entry.baselineWeightedSolves),
      ),
    };
  });
  return {
    repositories,
    repositorySummary: {
      unit: "repository mean paired cost" as const,
      interval: "two-sided Student t 95%" as const,
      repositories: repositories.length,
      baselineMs: summarizeSamples(repositories.map((entry) => entry.baselineMs)),
      stableMs: summarizeSamples(repositories.map((entry) => entry.stableMs)),
      runtimeRatio: summarizeSamples(repositories.map((entry) => entry.runtimeRatio)),
      runtimeOverheadMs: summarizeSamples(repositories.map((entry) => entry.runtimeOverheadMs)),
      stepOverhead: summarizeSamples(repositories.map((entry) => entry.stepOverhead)),
      weightedSolveOverhead: summarizeSamples(
        repositories.map((entry) => entry.weightedSolveOverhead),
      ),
    },
  };
}
