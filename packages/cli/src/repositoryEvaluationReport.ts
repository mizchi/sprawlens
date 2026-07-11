import {
  REPOSITORY_LANGUAGES,
  REPOSITORY_SIZE_BANDS,
  type RepositoryEvaluationManifest,
  type RepositoryLanguage,
  type RepositorySizeBand,
} from "./repositoryEvaluationManifest.ts";
import { summarizeSamples } from "@sprawlens/layout";

type SampleSummary = {
  n: number;
  mean: number;
  sd: number;
  ci95: readonly [number, number];
};

type PrimaryDecisionInput = {
  includedRepositories: number;
  displacementReduction: SampleSummary;
  adjacencyGain: SampleSummary;
};

const MINIMUM_ELIGIBLE_REPOSITORIES = 10;
const ADJACENCY_NON_INFERIORITY_MARGIN = -0.01;

/** Apply the preregistered co-primary decision rule without inspecting secondary metrics. */
export function decideRepositoryEvaluationClaim(input: PrimaryDecisionInput) {
  const eligibleForPrimaryInference = input.includedRepositories >= MINIMUM_ELIGIBLE_REPOSITORIES;
  const displacementSuperiority = input.displacementReduction.ci95[0] > 0;
  const adjacencyNonInferiority = input.adjacencyGain.ci95[0] > ADJACENCY_NON_INFERIORITY_MARGIN;
  const status = !eligibleForPrimaryInference
    ? ("pilot-only" as const)
    : displacementSuperiority && adjacencyNonInferiority
      ? ("primary-supported" as const)
      : displacementSuperiority || adjacencyNonInferiority
        ? ("partial-support" as const)
        : ("not-supported" as const);
  return {
    minimumEligibleRepositories: MINIMUM_ELIGIBLE_REPOSITORIES,
    adjacencyNonInferiorityMargin: ADJACENCY_NON_INFERIORITY_MARGIN,
    eligibleForPrimaryInference,
    displacementSuperiority,
    adjacencyNonInferiority,
    status,
  };
}

type CollectionEntry = {
  fullName: string;
  status: string;
  error?: string;
};
type EvaluationFailure = { fullName: string; error: string };
type BenchmarkRepository = {
  dataset: {
    repository: string;
    selection: { included: number };
  };
  benchmark: null | {
    scenarios: ReadonlyArray<{
      trials: ReadonlyArray<{
        conditions: {
          stableNeighborhood: {
            adjacency: number;
            displacement: number;
            converged: boolean;
          };
          neighborhoodSwap: {
            adjacency: number;
            displacement: number;
            converged: boolean;
          };
        };
      }>;
    }>;
    aggregate: {
      contrasts: {
        stableNeighborhoodVsNeighborhoodSwap: {
          adjacencyGain: SampleSummary;
          displacementReduction: SampleSummary;
          stepReduction: SampleSummary;
        };
      };
    };
  };
  exclusion: null | { code: string };
};
type BenchmarkBatch = {
  repositories: readonly BenchmarkRepository[];
  repositorySummary: {
    includedRepositories: number;
    excludedRepositories: number;
    contrasts: null | {
      stableNeighborhoodVsNeighborhoodSwap: {
        displacementReduction: SampleSummary;
        adjacencyGain: SampleSummary;
      };
    };
    stableSelection?: unknown;
  };
};
type StratumSummary = {
  registered: number;
  collectionFailed: number;
  benchmarkExcluded: number;
  analyzed: number;
  cases: number;
};

const emptyStratum = (): StratumSummary => ({
  registered: 0,
  collectionFailed: 0,
  benchmarkExcluded: 0,
  analyzed: 0,
  cases: 0,
});

/** Join frozen registration, collection status, and benchmark output into an auditable flow. */
export function summarizeRepositoryEvaluation(input: {
  manifest: RepositoryEvaluationManifest;
  collectionEntries: readonly CollectionEntry[];
  batch: BenchmarkBatch;
  evaluationFailures?: readonly EvaluationFailure[];
}) {
  const collectionByName = new Map(input.collectionEntries.map((entry) => [entry.fullName, entry]));
  const benchmarkByName = new Map(
    input.batch.repositories.map((entry) => [entry.dataset.repository, entry]),
  );
  const evaluationFailureByName = new Map(
    (input.evaluationFailures ?? []).map((entry) => [entry.fullName, entry.error]),
  );
  const repositories = input.manifest.repositories.map((registered) => {
    const metadata = {
      fullName: registered.fullName,
      language: registered.language,
      sizeBand: registered.sizeBand,
    };
    const collection = collectionByName.get(registered.fullName);
    if (!collection) {
      return { ...metadata, status: "collection-missing" as const, cases: 0 };
    }
    if (collection.status === "failed") {
      return {
        ...metadata,
        status: "collection-failed" as const,
        cases: 0,
        reason: collection.error ?? "collection failed without an error message",
      };
    }
    const evaluationFailure = evaluationFailureByName.get(registered.fullName);
    if (evaluationFailure) {
      return {
        ...metadata,
        status: "evaluation-failed" as const,
        cases: 0,
        reason: evaluationFailure,
      };
    }
    const benchmark = benchmarkByName.get(registered.fullName);
    if (!benchmark) {
      return {
        ...metadata,
        status: "evaluation-missing" as const,
        cases: 0,
        reason: "no benchmark result for collected repository",
      };
    }
    if (benchmark.benchmark === null) {
      return {
        ...metadata,
        status: "benchmark-excluded" as const,
        cases: 0,
        reason: benchmark.exclusion?.code ?? "unknown-exclusion",
      };
    }
    return {
      ...metadata,
      status: "analyzed" as const,
      cases: benchmark.dataset.selection.included,
      trials: benchmark.benchmark.scenarios.reduce(
        (count, scenario) => count + scenario.trials.length,
        0,
      ),
    };
  });
  const summarizeStrata = <T extends RepositoryLanguage | RepositorySizeBand>(keys: readonly T[]) =>
    Object.fromEntries(
      keys.map((key) => {
        const entries = repositories.filter(
          (entry) => entry.language === key || entry.sizeBand === key,
        );
        return [
          key,
          entries.reduce<StratumSummary>((summary, entry) => {
            summary.registered++;
            if (entry.status === "collection-failed") summary.collectionFailed++;
            if (entry.status === "benchmark-excluded") summary.benchmarkExcluded++;
            if (entry.status === "analyzed") {
              summary.analyzed++;
              summary.cases += entry.cases;
            }
            return summary;
          }, emptyStratum()),
        ];
      }),
    );
  const contrasts = input.batch.repositorySummary.contrasts;
  const primary = contrasts?.stableNeighborhoodVsNeighborhoodSwap;
  const analyzedBenchmarks = input.batch.repositories.filter(
    (
      entry,
    ): entry is BenchmarkRepository & {
      benchmark: NonNullable<BenchmarkRepository["benchmark"]>;
    } => entry.benchmark !== null,
  );
  const trials = analyzedBenchmarks.flatMap((entry) =>
    entry.benchmark.scenarios.flatMap((scenario) => scenario.trials),
  );
  const adjacencyDominanceViolations = trials.filter(
    (trial) =>
      trial.conditions.stableNeighborhood.adjacency + 1e-12 <
      trial.conditions.neighborhoodSwap.adjacency,
  ).length;
  const displacementDominanceViolations = trials.filter(
    (trial) =>
      trial.conditions.stableNeighborhood.displacement >
      trial.conditions.neighborhoodSwap.displacement + 1e-12,
  ).length;
  const contractAudit = {
    trials: trials.length,
    adjacencyDominanceViolations,
    displacementDominanceViolations,
    stableNonconvergedTrials: trials.filter(
      (trial) => !trial.conditions.stableNeighborhood.converged,
    ).length,
    baselineNonconvergedTrials: trials.filter(
      (trial) => !trial.conditions.neighborhoodSwap.converged,
    ).length,
    passed:
      adjacencyDominanceViolations === 0 &&
      displacementDominanceViolations === 0 &&
      trials.every(
        (trial) =>
          trial.conditions.stableNeighborhood.converged &&
          trial.conditions.neighborhoodSwap.converged,
      ),
  };
  const summarizeEffects = <T extends RepositoryLanguage | RepositorySizeBand>(
    keys: readonly T[],
    field: "language" | "sizeBand",
  ) =>
    Object.fromEntries(
      keys.map((key) => {
        const effects = input.manifest.repositories
          .filter((repository) => repository[field] === key)
          .flatMap((repository) => {
            const benchmark = benchmarkByName.get(repository.fullName)?.benchmark;
            return benchmark
              ? [benchmark.aggregate.contrasts.stableNeighborhoodVsNeighborhoodSwap]
              : [];
          });
        return [
          key,
          effects.length === 0
            ? {
                repositories: 0,
                adjacencyGain: null,
                displacementReduction: null,
                stepReduction: null,
              }
            : {
                repositories: effects.length,
                adjacencyGain: summarizeSamples(effects.map((effect) => effect.adjacencyGain.mean)),
                displacementReduction: summarizeSamples(
                  effects.map((effect) => effect.displacementReduction.mean),
                ),
                stepReduction: summarizeSamples(effects.map((effect) => effect.stepReduction.mean)),
              },
        ];
      }),
    );
  const decision = primary
    ? decideRepositoryEvaluationClaim({
        includedRepositories: input.batch.repositorySummary.includedRepositories,
        displacementReduction: primary.displacementReduction,
        adjacencyGain: primary.adjacencyGain,
      })
    : {
        minimumEligibleRepositories: MINIMUM_ELIGIBLE_REPOSITORIES,
        adjacencyNonInferiorityMargin: ADJACENCY_NON_INFERIORITY_MARGIN,
        eligibleForPrimaryInference: false,
        displacementSuperiority: false,
        adjacencyNonInferiority: false,
        status: "pilot-only" as const,
      };
  return {
    flow: {
      registeredRepositories: repositories.length,
      collectedRepositories: repositories.filter(
        (entry) => entry.status !== "collection-failed" && entry.status !== "collection-missing",
      ).length,
      collectionFailedRepositories: repositories.filter(
        (entry) => entry.status === "collection-failed",
      ).length,
      collectionMissingRepositories: repositories.filter(
        (entry) => entry.status === "collection-missing",
      ).length,
      evaluationFailedRepositories: repositories.filter(
        (entry) => entry.status === "evaluation-failed" || entry.status === "evaluation-missing",
      ).length,
      benchmarkExcludedRepositories: repositories.filter(
        (entry) => entry.status === "benchmark-excluded",
      ).length,
      analyzedRepositories: repositories.filter((entry) => entry.status === "analyzed").length,
      cases: repositories.reduce((count, entry) => count + entry.cases, 0),
      trials: repositories.reduce(
        (count, entry) => count + (entry.status === "analyzed" ? entry.trials : 0),
        0,
      ),
    },
    repositories,
    byLanguage: summarizeStrata(REPOSITORY_LANGUAGES) as Record<RepositoryLanguage, StratumSummary>,
    bySizeBand: summarizeStrata(REPOSITORY_SIZE_BANDS) as Record<
      RepositorySizeBand,
      StratumSummary
    >,
    effectsByLanguage: summarizeEffects(REPOSITORY_LANGUAGES, "language"),
    effectsBySizeBand: summarizeEffects(REPOSITORY_SIZE_BANDS, "sizeBand"),
    contractAudit,
    coPrimary: primary ?? null,
    stableSelection: input.batch.repositorySummary.stableSelection ?? null,
    decision,
  };
}
