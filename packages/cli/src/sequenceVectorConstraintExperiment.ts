import {
  runStableNeighborhoodSequence,
  summarizeSamples,
  type LayoutGraphSequence,
  type StableNeighborhoodProtectedConstraint,
} from "@sprawlens/layout";

export type SequenceVectorConstraintDataset = {
  repository: string;
  sequences: readonly LayoutGraphSequence[];
};

export type SequenceVectorConstraintExperimentOptions = {
  seeds: readonly number[];
  profile?: readonly StableNeighborhoodProtectedConstraint[];
  onRepository?: (progress: {
    index: number;
    total: number;
    repository: string;
    sequences: number;
  }) => void;
};

const DEFAULT_PROFILE = ["constraintPathMax"] as const;
const EFFECT_KEYS = [
  "eligibleCandidateReduction",
  "eligibleCandidateReductionRate",
  "selectedTransitionChangeRate",
  "scalarFallbackRate",
  "vectorFallbackRate",
  "siteDisplacementPenalty",
  "boundaryDisplacementPenalty",
  "adjacencyLoss",
  "pathMedianReduction",
  "pathMaxReduction",
  "disconnectedRateReduction",
  "initialToFinalSiteDisplacementPenalty",
  "initialToFinalBoundaryDisplacementPenalty",
] as const;
type EffectKey = (typeof EFFECT_KEYS)[number];
type Effects = Record<EffectKey, number>;

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

const pairedEffects = (
  scalar: ReturnType<typeof runStableNeighborhoodSequence>,
  vector: ReturnType<typeof runStableNeighborhoodSequence>,
): Effects => {
  if (scalar.transitions.length !== vector.transitions.length) {
    throw new Error("vector-constraint paired rollouts have different transition counts");
  }
  const transitions = scalar.transitions.map((scalarTransition, index) => {
    const vectorTransition = vector.transitions[index]!;
    const scalarMetrics = scalarTransition.conditions.stableNeighborhood;
    const vectorMetrics = vectorTransition.conditions.stableNeighborhood;
    const scalarEligible = scalarTransition.stableSelection.eligibleCandidates;
    const vectorEligible = vectorTransition.stableSelection.eligibleCandidates;
    return {
      eligibleCandidateReduction: scalarEligible - vectorEligible,
      eligibleCandidateReductionRate:
        (scalarEligible - vectorEligible) / Math.max(1, scalarEligible),
      selectedTransitionChange:
        scalarTransition.stableSelection.anchorMix !== vectorTransition.stableSelection.anchorMix ||
        scalarTransition.stableSelection.swapPasses !== vectorTransition.stableSelection.swapPasses
          ? 1
          : 0,
      scalarFallback: scalarTransition.stableSelection.usedFallback ? 1 : 0,
      vectorFallback: vectorTransition.stableSelection.usedFallback ? 1 : 0,
      siteDisplacementPenalty: vectorMetrics.siteDisplacement - scalarMetrics.siteDisplacement,
      boundaryDisplacementPenalty:
        vectorMetrics.boundaryDisplacement - scalarMetrics.boundaryDisplacement,
      adjacencyLoss: scalarMetrics.adjacency - vectorMetrics.adjacency,
      pathMedianReduction: scalarMetrics.constraintPathMedian - vectorMetrics.constraintPathMedian,
      pathMaxReduction: scalarMetrics.constraintPathMax - vectorMetrics.constraintPathMax,
      disconnectedRateReduction:
        scalarMetrics.constraintDisconnectedRate - vectorMetrics.constraintDisconnectedRate,
    };
  });
  const scalarFinal = scalar.summary.stableNeighborhood.initialToFinal;
  const vectorFinal = vector.summary.stableNeighborhood.initialToFinal;
  return {
    eligibleCandidateReduction: mean(
      transitions.map((effect) => effect.eligibleCandidateReduction),
    ),
    eligibleCandidateReductionRate: mean(
      transitions.map((effect) => effect.eligibleCandidateReductionRate),
    ),
    selectedTransitionChangeRate: mean(
      transitions.map((effect) => effect.selectedTransitionChange),
    ),
    scalarFallbackRate: mean(transitions.map((effect) => effect.scalarFallback)),
    vectorFallbackRate: mean(transitions.map((effect) => effect.vectorFallback)),
    siteDisplacementPenalty: mean(transitions.map((effect) => effect.siteDisplacementPenalty)),
    boundaryDisplacementPenalty: mean(
      transitions.map((effect) => effect.boundaryDisplacementPenalty),
    ),
    adjacencyLoss: mean(transitions.map((effect) => effect.adjacencyLoss)),
    pathMedianReduction: mean(transitions.map((effect) => effect.pathMedianReduction)),
    pathMaxReduction: mean(transitions.map((effect) => effect.pathMaxReduction)),
    disconnectedRateReduction: mean(transitions.map((effect) => effect.disconnectedRateReduction)),
    initialToFinalSiteDisplacementPenalty:
      vectorFinal.siteDisplacement - scalarFinal.siteDisplacement,
    initialToFinalBoundaryDisplacementPenalty:
      vectorFinal.boundaryDisplacement - scalarFinal.boundaryDisplacement,
  };
};

export function runSequenceVectorConstraintExperiment(
  datasets: readonly SequenceVectorConstraintDataset[],
  options: SequenceVectorConstraintExperimentOptions,
) {
  if (options.seeds.length === 0) {
    throw new Error("vector-constraint experiment requires non-empty seeds");
  }
  const repositoryNames = datasets.map(({ repository }) => repository);
  if (new Set(repositoryNames).size !== repositoryNames.length) {
    throw new Error("vector-constraint experiment has a duplicate repository");
  }
  const profile = [...(options.profile ?? DEFAULT_PROFILE)];
  if (profile.length === 0) {
    throw new Error("vector-constraint experiment requires a non-empty profile");
  }

  const repositories = datasets.flatMap((dataset, datasetIndex) => {
    if (dataset.sequences.length === 0) return [];
    const effects: Effects[] = [];
    let evaluatedTransitions = 0;
    let topologyFloorViolations = 0;
    for (const sequence of dataset.sequences) {
      for (const seed of options.seeds) {
        const scalar = runStableNeighborhoodSequence(sequence.snapshots, { seed });
        const vector = runStableNeighborhoodSequence(sequence.snapshots, {
          seed,
          stableProtectedConstraints: profile,
        });
        effects.push(pairedEffects(scalar, vector));
        evaluatedTransitions += vector.transitions.length;
        topologyFloorViolations += vector.topologyFloorViolations;
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
        evaluatedTransitions,
        topologyFloorViolations,
        ...Object.fromEntries(
          EFFECT_KEYS.map((key) => [key, mean(effects.map((effect) => effect[key]))]),
        ),
      } as {
        repository: string;
        sequences: number;
        runs: number;
        evaluatedTransitions: number;
        topologyFloorViolations: number;
      } & Effects,
    ];
  });

  return {
    schemaVersion: 1 as const,
    status: "post-hoc sequence vector-constraint development experiment" as const,
    unit: "repository mean sequence-seed paired difference" as const,
    seeds: [...options.seeds],
    profile,
    repositories,
    summary: {
      repositories: repositories.length,
      excludedRepositories: datasets.length - repositories.length,
      sequences: repositories.reduce((sum, repository) => sum + repository.sequences, 0),
      evaluatedTransitions: repositories.reduce(
        (sum, repository) => sum + repository.evaluatedTransitions,
        0,
      ),
      topologyFloorViolations: repositories.reduce(
        (sum, repository) => sum + repository.topologyFloorViolations,
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
      evaluatedTransitions: number;
      topologyFloorViolations: number;
    } & Record<EffectKey, ReturnType<typeof summarizeEffect>>,
  };
}
