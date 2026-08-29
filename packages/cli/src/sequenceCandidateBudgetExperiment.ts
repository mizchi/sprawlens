import {
  runStableNeighborhoodSequence,
  summarizeSamples,
  type LayoutGraphSequence,
  type StableAnchorMixPolicy,
} from "@sprawlens/layout";

export type SequenceBudgetDataset = {
  repository: string;
  sequences: readonly LayoutGraphSequence[];
};

export type SequenceCandidateBudgetExperimentOptions = {
  seeds: readonly number[];
  profile?: StableAnchorMixPolicy;
  onRepository?: (progress: {
    index: number;
    total: number;
    repository: string;
    sequences: number;
  }) => void;
};

const FULL_ANCHOR_MIXES = [0, 0.25, 0.5, 0.75, 1] as const;
export const ENDPOINT_NON_STRUCTURAL_PROFILE: StableAnchorMixPolicy = {
  structural: FULL_ANCHOR_MIXES,
  nonStructural: [0, 1],
};

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const summarizeEffect = (values: readonly number[]) => ({
  ...summarizeSamples(values),
  median:
    values.length === 0
      ? 0
      : [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)]!,
  signs: {
    positive: values.filter((value) => value > 1e-12).length,
    zero: values.filter((value) => Math.abs(value) <= 1e-12).length,
    negative: values.filter((value) => value < -1e-12).length,
  },
});

const EFFECT_KEYS = [
  "fullCandidateCount",
  "adaptiveCandidateCount",
  "candidateCountReduction",
  "candidateCountReductionRate",
  "fullWeightedSolves",
  "adaptiveWeightedSolves",
  "weightedSolveReduction",
  "weightedSolveReductionRate",
  "siteDisplacementPenalty",
  "boundaryDisplacementPenalty",
  "changeFaithfulnessErrorPenalty",
  "adjacencyLoss",
  "initialToFinalSiteDisplacementPenalty",
  "initialToFinalBoundaryDisplacementPenalty",
  "initialToFinalChangeFaithfulnessErrorPenalty",
] as const;
type EffectKey = (typeof EFFECT_KEYS)[number];
type RunEffect = Record<EffectKey, number>;

const runEffect = (
  full: ReturnType<typeof runStableNeighborhoodSequence>,
  adaptive: ReturnType<typeof runStableNeighborhoodSequence>,
): RunEffect => {
  if (full.transitions.length !== adaptive.transitions.length) {
    throw new Error("candidate-budget paired rollouts have different transition counts");
  }
  const transitionEffects = full.transitions.map((fullTransition, index) => {
    const adaptiveTransition = adaptive.transitions[index]!;
    const fullMetrics = fullTransition.conditions.stableNeighborhood;
    const adaptiveMetrics = adaptiveTransition.conditions.stableNeighborhood;
    return {
      siteDisplacementPenalty: adaptiveMetrics.siteDisplacement - fullMetrics.siteDisplacement,
      boundaryDisplacementPenalty:
        adaptiveMetrics.boundaryDisplacement - fullMetrics.boundaryDisplacement,
      changeFaithfulnessErrorPenalty:
        adaptiveMetrics.distanceChangeFaithfulnessError -
        fullMetrics.distanceChangeFaithfulnessError,
      adjacencyLoss: fullMetrics.adjacency - adaptiveMetrics.adjacency,
    };
  });
  const fullFinal = full.summary.stableNeighborhood.initialToFinal;
  const adaptiveFinal = adaptive.summary.stableNeighborhood.initialToFinal;
  const fullCandidateCount = mean(
    full.transitions.map((transition) => transition.stableSelection.candidateCount),
  );
  const adaptiveCandidateCount = mean(
    adaptive.transitions.map((transition) => transition.stableSelection.candidateCount),
  );
  const fullWeightedSolves = mean(
    full.transitions.map((transition) => transition.stableSelection.weightedSolves),
  );
  const adaptiveWeightedSolves = mean(
    adaptive.transitions.map((transition) => transition.stableSelection.weightedSolves),
  );
  return {
    fullCandidateCount,
    adaptiveCandidateCount,
    candidateCountReduction: fullCandidateCount - adaptiveCandidateCount,
    candidateCountReductionRate:
      (fullCandidateCount - adaptiveCandidateCount) / Math.max(fullCandidateCount, 1e-12),
    fullWeightedSolves,
    adaptiveWeightedSolves,
    weightedSolveReduction: fullWeightedSolves - adaptiveWeightedSolves,
    weightedSolveReductionRate:
      (fullWeightedSolves - adaptiveWeightedSolves) / Math.max(fullWeightedSolves, 1e-12),
    siteDisplacementPenalty: mean(
      transitionEffects.map((effect) => effect.siteDisplacementPenalty),
    ),
    boundaryDisplacementPenalty: mean(
      transitionEffects.map((effect) => effect.boundaryDisplacementPenalty),
    ),
    changeFaithfulnessErrorPenalty: mean(
      transitionEffects.map((effect) => effect.changeFaithfulnessErrorPenalty),
    ),
    adjacencyLoss: mean(transitionEffects.map((effect) => effect.adjacencyLoss)),
    initialToFinalSiteDisplacementPenalty:
      adaptiveFinal.siteDisplacement - fullFinal.siteDisplacement,
    initialToFinalBoundaryDisplacementPenalty:
      adaptiveFinal.boundaryDisplacement - fullFinal.boundaryDisplacement,
    initialToFinalChangeFaithfulnessErrorPenalty:
      adaptiveFinal.distanceChangeFaithfulnessError - fullFinal.distanceChangeFaithfulnessError,
  };
};

export function runSequenceCandidateBudgetExperiment(
  datasets: readonly SequenceBudgetDataset[],
  options: SequenceCandidateBudgetExperimentOptions,
) {
  if (options.seeds.length === 0) {
    throw new Error("candidate-budget experiment requires at least one seed");
  }
  const names = datasets.map((dataset) => dataset.repository);
  if (new Set(names).size !== names.length) {
    throw new Error("candidate-budget experiment has a duplicate repository");
  }
  const profile = options.profile ?? ENDPOINT_NON_STRUCTURAL_PROFILE;
  const repositories = datasets.flatMap((dataset, datasetIndex) => {
    if (dataset.sequences.length === 0) return [];
    const effects: RunEffect[] = [];
    const transitions = dataset.sequences.reduce(
      (sum, sequence) => sum + Math.max(0, sequence.snapshots.length - 1),
      0,
    );
    let evaluatedTransitions = 0;
    let evaluatedStructuralTransitions = 0;
    let evaluatedNonStructuralTransitions = 0;
    let floorViolations = 0;
    for (const sequence of dataset.sequences) {
      for (const seed of options.seeds) {
        const full = runStableNeighborhoodSequence(sequence.snapshots, { seed });
        const adaptive = runStableNeighborhoodSequence(sequence.snapshots, {
          seed,
          stableAnchorMixPolicy: profile,
        });
        effects.push(runEffect(full, adaptive));
        evaluatedTransitions += adaptive.transitions.length;
        for (const transition of adaptive.transitions) {
          const structural = transition.change.nodeChurn || transition.change.dependencyRewire;
          if (structural) evaluatedStructuralTransitions++;
          else evaluatedNonStructuralTransitions++;
          if (
            transition.conditions.stableNeighborhood.adjacency + 1e-12 <
            transition.baselineAdjacency
          ) {
            floorViolations++;
          }
        }
      }
    }
    options.onRepository?.({
      index: datasetIndex + 1,
      total: datasets.length,
      repository: dataset.repository,
      sequences: dataset.sequences.length,
    });
    return [
      {
        repository: dataset.repository,
        sequences: dataset.sequences.length,
        runs: effects.length,
        transitions,
        evaluatedTransitions,
        evaluatedStructuralTransitions,
        evaluatedNonStructuralTransitions,
        floorViolations,
        ...Object.fromEntries(
          EFFECT_KEYS.map((key) => [key, mean(effects.map((effect) => effect[key]))]),
        ),
      } as {
        repository: string;
        sequences: number;
        runs: number;
        transitions: number;
        evaluatedTransitions: number;
        evaluatedStructuralTransitions: number;
        evaluatedNonStructuralTransitions: number;
        floorViolations: number;
      } & Record<EffectKey, number>,
    ];
  });
  return {
    schemaVersion: 1 as const,
    status: "post-hoc sequence candidate-budget development experiment" as const,
    unit: "repository mean sequence-seed paired difference" as const,
    seeds: [...options.seeds],
    profile,
    repositories,
    summary: {
      repositories: repositories.length,
      excludedRepositories: datasets.length - repositories.length,
      sequences: repositories.reduce((sum, repository) => sum + repository.sequences, 0),
      transitions: repositories.reduce((sum, repository) => sum + repository.transitions, 0),
      evaluatedTransitions: repositories.reduce(
        (sum, repository) => sum + repository.evaluatedTransitions,
        0,
      ),
      evaluatedStructuralTransitions: repositories.reduce(
        (sum, repository) => sum + repository.evaluatedStructuralTransitions,
        0,
      ),
      evaluatedNonStructuralTransitions: repositories.reduce(
        (sum, repository) => sum + repository.evaluatedNonStructuralTransitions,
        0,
      ),
      floorViolations: repositories.reduce(
        (sum, repository) => sum + repository.floorViolations,
        0,
      ),
      ...Object.fromEntries(
        EFFECT_KEYS.map((key) => [
          key,
          summarizeEffect(repositories.map((repository) => repository[key])),
        ]),
      ),
    } as {
      repositories: number;
      excludedRepositories: number;
      sequences: number;
      transitions: number;
      evaluatedTransitions: number;
      evaluatedStructuralTransitions: number;
      evaluatedNonStructuralTransitions: number;
      floorViolations: number;
    } & Record<EffectKey, ReturnType<typeof summarizeEffect>>,
  };
}
