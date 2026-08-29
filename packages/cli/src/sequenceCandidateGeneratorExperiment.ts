import {
  createStableVoronoiCandidateGenerator,
  runStableNeighborhoodSequence,
  summarizeSamples,
  type LayoutGraphSequence,
  type StableNeighborhoodCandidateGenerator,
} from "@sprawlens/layout";

export type SequenceCandidateGeneratorDataset = {
  repository: string;
  sequences: readonly LayoutGraphSequence[];
};

export type SequenceCandidateGeneratorExperimentOptions = {
  seeds: readonly number[];
  generator?: StableNeighborhoodCandidateGenerator;
  onRepository?: (progress: {
    index: number;
    total: number;
    repository: string;
    sequences: number;
  }) => void;
};

const EFFECT_KEYS = [
  "meanAddedCandidates",
  "eligibleAddedGeneratorRate",
  "selectedAddedGeneratorRate",
  "addedGeneratorDisplacementPenalty",
  "addedGeneratorAdjacencyGain",
  "addedGeneratorPathMaxReduction",
  "eligibleAddedGeneratorDisplacementWinRate",
  "eligibleAddedGeneratorDisplacementTieRate",
  "siteDisplacementReduction",
  "boundaryDisplacementReduction",
  "adjacencyGain",
  "pathMaxReduction",
  "initialToFinalSiteDisplacementReduction",
  "initialToFinalBoundaryDisplacementReduction",
] as const;
type EffectKey = (typeof EFFECT_KEYS)[number];
type Effects = Record<EffectKey, number>;

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const summarizeEffect = (values: readonly number[]) => ({
  ...summarizeSamples(values),
  signs: {
    positive: values.filter((value) => value > 1e-12).length,
    zero: values.filter((value) => Math.abs(value) <= 1e-12).length,
    negative: values.filter((value) => value < -1e-12).length,
  },
});

const pairedEffects = (
  internal: ReturnType<typeof runStableNeighborhoodSequence>,
  portfolio: ReturnType<typeof runStableNeighborhoodSequence>,
  generatorId: string,
): Effects => {
  if (internal.transitions.length !== portfolio.transitions.length) {
    throw new Error("candidate-generator paired rollouts have different transition counts");
  }
  const transitions = internal.transitions.map((internalTransition, index) => {
    const portfolioTransition = portfolio.transitions[index]!;
    const internalMetrics = internalTransition.conditions.stableNeighborhood;
    const portfolioMetrics = portfolioTransition.conditions.stableNeighborhood;
    const addedCandidate = portfolioTransition.stableSelection.candidateDiagnostics.find(
      (candidate) => candidate.generatorId === generatorId,
    );
    if (!addedCandidate) {
      throw new Error("candidate-generator rollout is missing the added candidate diagnostics");
    }
    const bestInternalCandidate = portfolioTransition.stableSelection.candidateDiagnostics
      .filter((candidate) => candidate.generatorId !== generatorId && candidate.eligible)
      .sort((left, right) => left.displacement - right.displacement)[0];
    if (!bestInternalCandidate) {
      throw new Error("candidate-generator rollout is missing an eligible internal candidate");
    }
    const displacementDifference = addedCandidate.displacement - bestInternalCandidate.displacement;
    return {
      addedCandidates:
        portfolioTransition.stableSelection.candidateCount -
        internalTransition.stableSelection.candidateCount,
      eligibleAddedGenerator: portfolioTransition.stableSelection.eligibleCandidateKeys.some(
        (key) => key.startsWith(`${generatorId}:`),
      )
        ? 1
        : 0,
      selectedAddedGenerator:
        portfolioTransition.stableSelection.generatorId === generatorId ? 1 : 0,
      addedGeneratorDisplacementPenalty: displacementDifference,
      addedGeneratorAdjacencyGain: addedCandidate.adjacency - bestInternalCandidate.adjacency,
      addedGeneratorPathMaxReduction:
        bestInternalCandidate.constraintPathMax - addedCandidate.constraintPathMax,
      eligibleAddedGeneratorDisplacementWin:
        addedCandidate.eligible && displacementDifference < -1e-12 ? 1 : 0,
      eligibleAddedGeneratorDisplacementTie:
        addedCandidate.eligible && Math.abs(displacementDifference) <= 1e-12 ? 1 : 0,
      siteDisplacementReduction:
        internalMetrics.siteDisplacement - portfolioMetrics.siteDisplacement,
      boundaryDisplacementReduction:
        internalMetrics.boundaryDisplacement - portfolioMetrics.boundaryDisplacement,
      adjacencyGain: portfolioMetrics.adjacency - internalMetrics.adjacency,
      pathMaxReduction: internalMetrics.constraintPathMax - portfolioMetrics.constraintPathMax,
    };
  });
  const internalFinal = internal.summary.stableNeighborhood.initialToFinal;
  const portfolioFinal = portfolio.summary.stableNeighborhood.initialToFinal;
  return {
    meanAddedCandidates: mean(transitions.map((value) => value.addedCandidates)),
    eligibleAddedGeneratorRate: mean(transitions.map((value) => value.eligibleAddedGenerator)),
    selectedAddedGeneratorRate: mean(transitions.map((value) => value.selectedAddedGenerator)),
    addedGeneratorDisplacementPenalty: mean(
      transitions.map((value) => value.addedGeneratorDisplacementPenalty),
    ),
    addedGeneratorAdjacencyGain: mean(
      transitions.map((value) => value.addedGeneratorAdjacencyGain),
    ),
    addedGeneratorPathMaxReduction: mean(
      transitions.map((value) => value.addedGeneratorPathMaxReduction),
    ),
    eligibleAddedGeneratorDisplacementWinRate:
      transitions.reduce((sum, value) => sum + value.eligibleAddedGeneratorDisplacementWin, 0) /
      Math.max(1, transitions.filter((value) => value.eligibleAddedGenerator === 1).length),
    eligibleAddedGeneratorDisplacementTieRate:
      transitions.reduce((sum, value) => sum + value.eligibleAddedGeneratorDisplacementTie, 0) /
      Math.max(1, transitions.filter((value) => value.eligibleAddedGenerator === 1).length),
    siteDisplacementReduction: mean(transitions.map((value) => value.siteDisplacementReduction)),
    boundaryDisplacementReduction: mean(
      transitions.map((value) => value.boundaryDisplacementReduction),
    ),
    adjacencyGain: mean(transitions.map((value) => value.adjacencyGain)),
    pathMaxReduction: mean(transitions.map((value) => value.pathMaxReduction)),
    initialToFinalSiteDisplacementReduction:
      internalFinal.siteDisplacement - portfolioFinal.siteDisplacement,
    initialToFinalBoundaryDisplacementReduction:
      internalFinal.boundaryDisplacement - portfolioFinal.boundaryDisplacement,
  };
};

/** Compare one selector over the internal candidate set and an augmented set. */
export function runSequenceCandidateGeneratorExperiment(
  datasets: readonly SequenceCandidateGeneratorDataset[],
  options: SequenceCandidateGeneratorExperimentOptions,
) {
  if (options.seeds.length === 0) {
    throw new Error("candidate-generator experiment requires non-empty seeds");
  }
  const repositoryNames = datasets.map(({ repository }) => repository);
  if (new Set(repositoryNames).size !== repositoryNames.length) {
    throw new Error("candidate-generator experiment has a duplicate repository");
  }
  const generator = options.generator ?? createStableVoronoiCandidateGenerator();
  const generatorMetadata = {
    id: generator.id,
    revision: generator.revision,
    parameters: generator.parameters,
  };

  const repositories = datasets.flatMap((dataset, datasetIndex) => {
    if (dataset.sequences.length === 0) return [];
    const effects: Effects[] = [];
    let evaluatedTransitions = 0;
    let adjacencyFloorViolations = 0;
    for (const sequence of dataset.sequences) {
      for (const seed of options.seeds) {
        const internal = runStableNeighborhoodSequence(sequence.snapshots, { seed });
        const portfolio = runStableNeighborhoodSequence(sequence.snapshots, {
          seed,
          stableCandidateGenerators: [generator],
        });
        effects.push(pairedEffects(internal, portfolio, generator.id));
        evaluatedTransitions += portfolio.transitions.length;
        adjacencyFloorViolations += portfolio.adjacencyFloorViolations;
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
        adjacencyFloorViolations,
        ...Object.fromEntries(
          EFFECT_KEYS.map((key) => [key, mean(effects.map((effect) => effect[key]))]),
        ),
      } as {
        repository: string;
        sequences: number;
        runs: number;
        evaluatedTransitions: number;
        adjacencyFloorViolations: number;
      } & Effects,
    ];
  });

  return {
    schemaVersion: 1 as const,
    status: "post-hoc candidate-generator portfolio development experiment" as const,
    unit: "repository mean sequence-seed paired difference" as const,
    generator: generatorMetadata,
    seeds: [...options.seeds],
    repositories,
    summary: {
      repositories: repositories.length,
      excludedRepositories: datasets.length - repositories.length,
      sequences: repositories.reduce((sum, repository) => sum + repository.sequences, 0),
      evaluatedTransitions: repositories.reduce(
        (sum, repository) => sum + repository.evaluatedTransitions,
        0,
      ),
      adjacencyFloorViolations: repositories.reduce(
        (sum, repository) => sum + repository.adjacencyFloorViolations,
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
      adjacencyFloorViolations: number;
    } & Record<EffectKey, ReturnType<typeof summarizeEffect>>,
  };
}
