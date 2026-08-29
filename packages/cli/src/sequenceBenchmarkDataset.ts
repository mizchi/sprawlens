import { runStableNeighborhoodSequence, summarizeSamples } from "@sprawlens/layout";
import type { LoadedDataset } from "./deltaBenchmarkDataset.ts";

const DEFAULT_SEEDS = [3, 7, 11] as const;
const METRICS = [
  "siteDisplacement",
  "centroidDisplacement",
  "boundaryDisplacement",
  "polygonIoULoss",
  "relativeDirectionChange",
  "distanceChangeFaithfulnessError",
] as const;
type SequenceMetric = (typeof METRICS)[number];
type SequenceRun = ReturnType<typeof runStableNeighborhoodSequence>;

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const summarizeEffects = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 0
        ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
        : (sorted[middle] ?? 0);
  const epsilon = 1e-12;
  return {
    ...summarizeSamples(values),
    median,
    signs: {
      positive: values.filter((value) => value > epsilon).length,
      zero: values.filter((value) => Math.abs(value) <= epsilon).length,
      negative: values.filter((value) => value < -epsilon).length,
    },
  };
};

const repositoryContrast = (
  runs: readonly SequenceRun[],
  baseline: "neighborhoodSwap" | "computeMatchedNeighborhood" | "warmStart" | "anchorOnly",
) => ({
  cumulative: Object.fromEntries(
    METRICS.map((metric) => [
      `${metric}Reduction`,
      mean(
        runs.map(
          (run) =>
            run.summary[baseline].cumulative[metric] -
            run.summary.stableNeighborhood.cumulative[metric],
        ),
      ),
    ]),
  ) as Record<`${SequenceMetric}Reduction`, number>,
  perTransition: Object.fromEntries(
    METRICS.map((metric) => [
      `${metric}Reduction`,
      mean(
        runs.map(
          (run) => run.summary[baseline].mean[metric] - run.summary.stableNeighborhood.mean[metric],
        ),
      ),
    ]),
  ) as Record<`${SequenceMetric}Reduction`, number>,
  initialToFinal: Object.fromEntries(
    METRICS.map((metric) => [
      `${metric}Reduction`,
      mean(
        runs.map(
          (run) =>
            run.summary[baseline].initialToFinal[metric] -
            run.summary.stableNeighborhood.initialToFinal[metric],
        ),
      ),
    ]),
  ) as Record<`${SequenceMetric}Reduction`, number>,
  structure: {
    meanAdjacencyGain: mean(
      runs.map(
        (run) => run.summary.stableNeighborhood.meanAdjacency - run.summary[baseline].meanAdjacency,
      ),
    ),
    minimumAdjacencyGain: mean(
      runs.map(
        (run) =>
          run.summary.stableNeighborhood.minimumAdjacency - run.summary[baseline].minimumAdjacency,
      ),
    ),
    finalAdjacencyGain: mean(
      runs.map(
        (run) =>
          run.summary.stableNeighborhood.finalAdjacency - run.summary[baseline].finalAdjacency,
      ),
    ),
    nonconvergedRateReduction: mean(
      runs.map(
        (run) =>
          (run.summary[baseline].nonconvergedTransitions -
            run.summary.stableNeighborhood.nonconvergedTransitions) /
          Math.max(1, run.snapshots - 1),
      ),
    ),
  },
});

export function runRepositorySequenceBenchmarkBatch(
  datasets: readonly LoadedDataset[],
  options: { seeds?: readonly number[] } = {},
) {
  const seeds = [...(options.seeds ?? DEFAULT_SEEDS)];
  if (seeds.length === 0) throw new Error("sequence benchmark requires at least one seed");
  const repositories = datasets.map((dataset) => {
    const runs = dataset.sequences.flatMap((sequence) =>
      seeds.map((seed) => ({
        sequence: sequence.name,
        snapshots: sequence.snapshots.length,
        result: runStableNeighborhoodSequence(sequence.snapshots, { seed }),
      })),
    );
    const matchedRuns = runs
      .filter(({ result }) => result.budget.shortfallTransitions === 0)
      .map(({ result }) => result);
    const allRuns = runs.map(({ result }) => result);
    return {
      repository: dataset.repository,
      sequences: dataset.sequences.length,
      longSequences: dataset.sequences.filter((sequence) => sequence.snapshots.length >= 6).length,
      transitions: dataset.sequences.reduce(
        (sum, sequence) => sum + sequence.snapshots.length - 1,
        0,
      ),
      budget: {
        matchedRuns: matchedRuns.length,
        shortfallRuns: runs.length - matchedRuns.length,
      },
      runs,
      contrasts:
        allRuns.length === 0
          ? null
          : {
              stableVsNeighborhoodSwap: repositoryContrast(allRuns, "neighborhoodSwap"),
              stableVsComputeMatched:
                matchedRuns.length === 0
                  ? null
                  : repositoryContrast(matchedRuns, "computeMatchedNeighborhood"),
              stableVsWarmStart: repositoryContrast(allRuns, "warmStart"),
              stableVsAnchorOnly: repositoryContrast(allRuns, "anchorOnly"),
            },
    };
  });
  const analyzed = repositories.filter(
    (
      repository,
    ): repository is (typeof repositories)[number] & {
      contrasts: NonNullable<(typeof repositories)[number]["contrasts"]>;
    } => repository.contrasts !== null,
  );
  const summarizeContrast = (
    name:
      | "stableVsNeighborhoodSwap"
      | "stableVsComputeMatched"
      | "stableVsWarmStart"
      | "stableVsAnchorOnly",
    scope: "cumulative" | "perTransition" | "initialToFinal",
  ) =>
    Object.fromEntries(
      METRICS.map((metric) => {
        const key = `${metric}Reduction` as const;
        return [
          key,
          summarizeEffects(
            analyzed.flatMap((repository) => {
              const contrast = repository.contrasts[name];
              return contrast ? [contrast[scope][key]] : [];
            }),
          ),
        ];
      }),
    );
  const longSequenceRepositories = repositories.filter(
    (repository) => repository.longSequences > 0,
  ).length;
  const summarizeStructure = (
    name:
      | "stableVsNeighborhoodSwap"
      | "stableVsComputeMatched"
      | "stableVsWarmStart"
      | "stableVsAnchorOnly",
  ) =>
    Object.fromEntries(
      [
        "meanAdjacencyGain",
        "minimumAdjacencyGain",
        "finalAdjacencyGain",
        "nonconvergedRateReduction",
      ].map((key) => [
        key,
        summarizeEffects(
          analyzed.flatMap((repository) => {
            const contrast = repository.contrasts[name];
            return contrast ? [contrast.structure[key as keyof typeof contrast.structure]] : [];
          }),
        ),
      ]),
    ) as Record<
      | "meanAdjacencyGain"
      | "minimumAdjacencyGain"
      | "finalAdjacencyGain"
      | "nonconvergedRateReduction",
      ReturnType<typeof summarizeEffects>
    >;
  return {
    schemaVersion: 4 as const,
    seeds,
    repositories,
    summary: {
      unit: "repository mean sequence-seed difference" as const,
      includedRepositories: analyzed.length,
      excludedRepositories: repositories.length - analyzed.length,
      sequences: repositories.reduce((sum, repository) => sum + repository.sequences, 0),
      transitions: repositories.reduce((sum, repository) => sum + repository.transitions, 0),
      longSequenceRepositories,
      goGateCorpusSatisfied: longSequenceRepositories >= 10,
      contrasts: {
        stableVsNeighborhoodSwap: {
          cumulative: summarizeContrast("stableVsNeighborhoodSwap", "cumulative"),
          perTransition: summarizeContrast("stableVsNeighborhoodSwap", "perTransition"),
          initialToFinal: summarizeContrast("stableVsNeighborhoodSwap", "initialToFinal"),
          structure: summarizeStructure("stableVsNeighborhoodSwap"),
        },
        stableVsComputeMatched: {
          cumulative: summarizeContrast("stableVsComputeMatched", "cumulative"),
          perTransition: summarizeContrast("stableVsComputeMatched", "perTransition"),
          initialToFinal: summarizeContrast("stableVsComputeMatched", "initialToFinal"),
          structure: summarizeStructure("stableVsComputeMatched"),
        },
        stableVsWarmStart: {
          cumulative: summarizeContrast("stableVsWarmStart", "cumulative"),
          perTransition: summarizeContrast("stableVsWarmStart", "perTransition"),
          initialToFinal: summarizeContrast("stableVsWarmStart", "initialToFinal"),
          structure: summarizeStructure("stableVsWarmStart"),
        },
        stableVsAnchorOnly: {
          cumulative: summarizeContrast("stableVsAnchorOnly", "cumulative"),
          perTransition: summarizeContrast("stableVsAnchorOnly", "perTransition"),
          initialToFinal: summarizeContrast("stableVsAnchorOnly", "initialToFinal"),
          structure: summarizeStructure("stableVsAnchorOnly"),
        },
      },
    },
  };
}
