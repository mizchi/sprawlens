import {
  buildControlledSequenceProbe,
  CONTROLLED_RECOVERY_NAMES,
  CONTROLLED_REPEATABILITY_PATH_NAMES,
  runControlledSequenceProbe,
  SEQUENCE_CONDITION_NAMES,
  summarizeSamples,
  type LayoutSequenceGraph,
  type ControlledRecoveryName,
  type SequenceConditionName,
} from "@sprawlens/layout";
import {
  computeExcessDefect,
  computeExcessDefectInterval,
  empiricalNearestRankQuantile,
  representationReliabilityMetricContractV1,
  type CertifiedNonnegativeInterval,
} from "@sprawlens/contracts";

const METRICS = [
  "siteDisplacement",
  "centroidDisplacement",
  "boundaryDisplacement",
  "polygonIoULoss",
  "relativeDirectionChange",
] as const;
type Metric = (typeof METRICS)[number];

type Dataset = {
  repository: string;
  sequences: ReadonlyArray<{ name: string; snapshots: readonly LayoutSequenceGraph[] }>;
};

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

export function meanBySequenceThenRepository<T extends { sequence: string }>(
  samples: readonly T[],
  valueOf: (sample: T) => number,
) {
  if (samples.length === 0) throw new RangeError("nested aggregation requires a sample");
  const bySequence = new Map<string, number[]>();
  for (const sample of samples) {
    const value = valueOf(sample);
    if (!Number.isFinite(value)) throw new RangeError("nested aggregation requires finite values");
    const values = bySequence.get(sample.sequence) ?? [];
    values.push(value);
    bySequence.set(sample.sequence, values);
  }
  return mean([...bySequence.values()].map(mean));
}

export function runControlledSequenceExperiment(
  datasets: readonly Dataset[],
  options: {
    seeds?: readonly number[];
    stableHistoryFreeReferenceWeight?: number;
    reliabilityMargin?: number;
  } = {},
) {
  const seeds = [...(options.seeds ?? [3, 7, 11])];
  if (seeds.length === 0) throw new Error("controlled sequence experiment requires a seed");
  const reliabilityMargin =
    options.reliabilityMargin ?? representationReliabilityMetricContractV1.metrics.D_excess.margin;
  if (!Number.isFinite(reliabilityMargin) || reliabilityMargin < 0) {
    throw new RangeError("reliabilityMargin must be finite and non-negative");
  }
  const repositories = datasets.map((dataset) => {
    const exclusions: Array<{ sequence: string; reason: string }> = [];
    const probes = dataset.sequences.flatMap((sequence) => {
      const base = sequence.snapshots[0];
      if (!base) {
        exclusions.push({ sequence: sequence.name, reason: "missing base snapshot" });
        return [];
      }
      try {
        const probe = buildControlledSequenceProbe(base);
        return seeds.map((seed) => ({
          sequence: sequence.name,
          seed,
          result: runControlledSequenceProbe(probe, {
            seed,
            stableHistoryFreeReferenceWeight: options.stableHistoryFreeReferenceWeight,
            captureRepeatability: true,
          }),
        }));
      } catch (error) {
        exclusions.push({
          sequence: sequence.name,
          reason: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    });
    if (probes.length === 0) {
      return { repository: dataset.repository, probes, exclusions, means: null };
    }
    const recoveryMetricMean = (
      recovery: ControlledRecoveryName,
      condition: SequenceConditionName,
      metric: Metric,
    ) =>
      meanBySequenceThenRepository(
        probes,
        (probe) => probe.result.recovery[recovery][condition][metric],
      );
    const pathDependenceMetricMean = (condition: SequenceConditionName, metric: Metric) =>
      meanBySequenceThenRepository(
        probes,
        (probe) => probe.result.pathDependence[condition][metric],
      );
    const noiseFloor = Object.fromEntries(
      SEQUENCE_CONDITION_NAMES.map((condition) => {
        const repeatabilitySamples = probes.flatMap((probe) => {
          const repeatability = probe.result.repeatability;
          if (!repeatability) throw new Error("controlled experiment requires repeatability runs");
          return CONTROLLED_REPEATABILITY_PATH_NAMES.map(
            (path) => repeatability[path][condition].boundaryDisplacement,
          );
        });
        return [
          condition,
          empiricalNearestRankQuantile(
            repeatabilitySamples,
            representationReliabilityMetricContractV1.metrics.D_repeat.quantile.probability,
          ),
        ];
      }),
    ) as Record<SequenceConditionName, number>;
    const repeatabilityIntervals = Object.fromEntries(
      SEQUENCE_CONDITION_NAMES.map((condition) => [
        condition,
        probes.flatMap((probe) => {
          const repeatability = probe.result.repeatability;
          if (!repeatability) throw new Error("controlled experiment requires repeatability runs");
          return CONTROLLED_REPEATABILITY_PATH_NAMES.map((path) => {
            const interval = repeatability[path][condition].boundaryHausdorffInterval;
            return { lowerBound: interval.lowerBound, upperBound: interval.upperBound };
          });
        }),
      ]),
    ) as Record<SequenceConditionName, CertifiedNonnegativeInterval[]>;
    const confirmatoryNoiseFloor = Object.fromEntries(
      SEQUENCE_CONDITION_NAMES.map((condition) => {
        const intervals = repeatabilityIntervals[condition];
        const probability =
          representationReliabilityMetricContractV1.metrics.D_repeat.quantile.probability;
        return [
          condition,
          {
            lowerBound: empiricalNearestRankQuantile(
              intervals.map((interval) => interval.lowerBound),
              probability,
            ),
            upperBound: empiricalNearestRankQuantile(
              intervals.map((interval) => interval.upperBound),
              probability,
            ),
          },
        ];
      }),
    ) as Record<SequenceConditionName, CertifiedNonnegativeInterval>;
    const aggregateExcessIntervals = (
      condition: SequenceConditionName,
      pathInterval: (probe: (typeof probes)[number]) => CertifiedNonnegativeInterval,
    ) => {
      const samples = probes.map((probe) => ({
        sequence: probe.sequence,
        interval: computeExcessDefectInterval(
          pathInterval(probe),
          repeatabilityIntervals[condition],
          reliabilityMargin,
        ),
      }));
      return {
        lowerBound: meanBySequenceThenRepository(samples, (sample) => sample.interval.lowerBound),
        upperBound: meanBySequenceThenRepository(samples, (sample) => sample.interval.upperBound),
      };
    };
    const confirmatoryCommutatorExcess = Object.fromEntries(
      SEQUENCE_CONDITION_NAMES.map((condition) => [
        condition,
        aggregateExcessIntervals(
          condition,
          (probe) => probe.result.pathDependence[condition].boundaryHausdorffInterval,
        ),
      ]),
    ) as Record<SequenceConditionName, CertifiedNonnegativeInterval>;
    const confirmatoryLoopExcess = Object.fromEntries(
      CONTROLLED_RECOVERY_NAMES.map((recovery) => [
        recovery,
        Object.fromEntries(
          SEQUENCE_CONDITION_NAMES.map((condition) => [
            condition,
            aggregateExcessIntervals(
              condition,
              (probe) => probe.result.recovery[recovery][condition].boundaryHausdorffInterval,
            ),
          ]),
        ) as Record<SequenceConditionName, CertifiedNonnegativeInterval>,
      ]),
    ) as Record<
      ControlledRecoveryName,
      Record<SequenceConditionName, CertifiedNonnegativeInterval>
    >;
    const commutatorExcess = Object.fromEntries(
      SEQUENCE_CONDITION_NAMES.map((condition) => [
        condition,
        meanBySequenceThenRepository(probes, (probe) =>
          computeExcessDefect(
            probe.result.pathDependence[condition].boundaryDisplacement,
            noiseFloor[condition],
            reliabilityMargin,
          ),
        ),
      ]),
    ) as Record<SequenceConditionName, number>;
    const loopExcess = Object.fromEntries(
      CONTROLLED_RECOVERY_NAMES.map((recovery) => [
        recovery,
        Object.fromEntries(
          SEQUENCE_CONDITION_NAMES.map((condition) => [
            condition,
            meanBySequenceThenRepository(probes, (probe) =>
              computeExcessDefect(
                probe.result.recovery[recovery][condition].boundaryDisplacement,
                noiseFloor[condition],
                reliabilityMargin,
              ),
            ),
          ]),
        ) as Record<SequenceConditionName, number>,
      ]),
    ) as Record<ControlledRecoveryName, Record<SequenceConditionName, number>>;
    return {
      repository: dataset.repository,
      probes,
      exclusions,
      means: {
        recovery: Object.fromEntries(
          CONTROLLED_RECOVERY_NAMES.map((recovery) => [
            recovery,
            Object.fromEntries(
              SEQUENCE_CONDITION_NAMES.map((condition) => [
                condition,
                Object.fromEntries(
                  METRICS.map((metric) => [
                    metric,
                    recoveryMetricMean(recovery, condition, metric),
                  ]),
                ) as Record<Metric, number>,
              ]),
            ) as Record<SequenceConditionName, Record<Metric, number>>,
          ]),
        ) as Record<ControlledRecoveryName, Record<SequenceConditionName, Record<Metric, number>>>,
        pathDependence: Object.fromEntries(
          SEQUENCE_CONDITION_NAMES.map((condition) => [
            condition,
            Object.fromEntries(
              METRICS.map((metric) => [metric, pathDependenceMetricMean(condition, metric)]),
            ) as Record<Metric, number>,
          ]),
        ) as Record<SequenceConditionName, Record<Metric, number>>,
        developmentReliability: {
          discrepancy: "sampled-mean-boundary-displacement-v1" as const,
          repeatabilityQuantile: "empirical-nearest-rank-0.95" as const,
          margin: reliabilityMargin,
          noiseFloor,
          commutatorExcess,
          loopExcess,
        },
        confirmatoryReliability: {
          discrepancy: representationReliabilityMetricContractV1.observation.discrepancy,
          estimator: representationReliabilityMetricContractV1.observation.estimator,
          repeatabilityQuantile: "empirical-nearest-rank-0.95" as const,
          margin: reliabilityMargin,
          noiseFloor: confirmatoryNoiseFloor,
          commutatorExcess: confirmatoryCommutatorExcess,
          loopExcess: confirmatoryLoopExcess,
        },
      },
    };
  });
  const included = repositories.filter(
    (
      repository,
    ): repository is typeof repository & { means: NonNullable<typeof repository.means> } =>
      repository.means !== null,
  );
  const summarizeConditionMetrics = (
    values: (
      repository: (typeof included)[number],
    ) => Record<SequenceConditionName, Record<Metric, number>>,
  ) =>
    Object.fromEntries(
      SEQUENCE_CONDITION_NAMES.map((condition) => [
        condition,
        Object.fromEntries(
          METRICS.map((metric) => [
            metric,
            summarizeSamples(included.map((repository) => values(repository)[condition][metric])),
          ]),
        ) as Record<Metric, ReturnType<typeof summarizeSamples>>,
      ]),
    ) as Record<SequenceConditionName, Record<Metric, ReturnType<typeof summarizeSamples>>>;
  return {
    schemaVersion: 4 as const,
    seeds,
    stableHistoryFreeReferenceWeight: options.stableHistoryFreeReferenceWeight ?? 0,
    repositories,
    summary: {
      unit: "repository mean controlled-probe effect" as const,
      repositories: included.length,
      excludedRepositories: repositories.length - included.length,
      probes: repositories.reduce((sum, repository) => sum + repository.probes.length, 0),
      floorViolations: repositories.reduce(
        (sum, repository) =>
          sum +
          repository.probes.reduce((probeSum, probe) => probeSum + probe.result.floorViolations, 0),
        0,
      ),
      budgetShortfalls: repositories.reduce(
        (sum, repository) =>
          sum +
          repository.probes.reduce(
            (probeSum, probe) => probeSum + probe.result.budgetShortfalls,
            0,
          ),
        0,
      ),
      recovery: Object.fromEntries(
        CONTROLLED_RECOVERY_NAMES.map((recovery) => [
          recovery,
          summarizeConditionMetrics((repository) => repository.means.recovery[recovery]),
        ]),
      ) as Record<
        ControlledRecoveryName,
        Record<SequenceConditionName, Record<Metric, ReturnType<typeof summarizeSamples>>>
      >,
      pathDependence: summarizeConditionMetrics((repository) => repository.means.pathDependence),
      developmentReliability: {
        discrepancy: "sampled-mean-boundary-displacement-v1" as const,
        repeatabilityQuantile: "empirical-nearest-rank-0.95" as const,
        margin: reliabilityMargin,
        noiseFloor: Object.fromEntries(
          SEQUENCE_CONDITION_NAMES.map((condition) => [
            condition,
            summarizeSamples(
              included.map(
                (repository) => repository.means.developmentReliability.noiseFloor[condition],
              ),
            ),
          ]),
        ) as Record<SequenceConditionName, ReturnType<typeof summarizeSamples>>,
        commutatorExcess: Object.fromEntries(
          SEQUENCE_CONDITION_NAMES.map((condition) => [
            condition,
            summarizeSamples(
              included.map(
                (repository) => repository.means.developmentReliability.commutatorExcess[condition],
              ),
            ),
          ]),
        ) as Record<SequenceConditionName, ReturnType<typeof summarizeSamples>>,
        loopExcess: Object.fromEntries(
          CONTROLLED_RECOVERY_NAMES.map((recovery) => [
            recovery,
            Object.fromEntries(
              SEQUENCE_CONDITION_NAMES.map((condition) => [
                condition,
                summarizeSamples(
                  included.map(
                    (repository) =>
                      repository.means.developmentReliability.loopExcess[recovery][condition],
                  ),
                ),
              ]),
            ) as Record<SequenceConditionName, ReturnType<typeof summarizeSamples>>,
          ]),
        ) as Record<
          ControlledRecoveryName,
          Record<SequenceConditionName, ReturnType<typeof summarizeSamples>>
        >,
      },
      confirmatoryReliability: {
        discrepancy: representationReliabilityMetricContractV1.observation.discrepancy,
        estimator: representationReliabilityMetricContractV1.observation.estimator,
        repeatabilityQuantile: "empirical-nearest-rank-0.95" as const,
        margin: reliabilityMargin,
        noiseFloor: Object.fromEntries(
          SEQUENCE_CONDITION_NAMES.map((condition) => [
            condition,
            {
              lowerBound: summarizeSamples(
                included.map(
                  (repository) =>
                    repository.means.confirmatoryReliability.noiseFloor[condition].lowerBound,
                ),
              ),
              upperBound: summarizeSamples(
                included.map(
                  (repository) =>
                    repository.means.confirmatoryReliability.noiseFloor[condition].upperBound,
                ),
              ),
            },
          ]),
        ) as Record<
          SequenceConditionName,
          Record<keyof CertifiedNonnegativeInterval, ReturnType<typeof summarizeSamples>>
        >,
        commutatorExcess: Object.fromEntries(
          SEQUENCE_CONDITION_NAMES.map((condition) => [
            condition,
            {
              lowerBound: summarizeSamples(
                included.map(
                  (repository) =>
                    repository.means.confirmatoryReliability.commutatorExcess[condition].lowerBound,
                ),
              ),
              upperBound: summarizeSamples(
                included.map(
                  (repository) =>
                    repository.means.confirmatoryReliability.commutatorExcess[condition].upperBound,
                ),
              ),
            },
          ]),
        ) as Record<
          SequenceConditionName,
          Record<keyof CertifiedNonnegativeInterval, ReturnType<typeof summarizeSamples>>
        >,
        loopExcess: Object.fromEntries(
          CONTROLLED_RECOVERY_NAMES.map((recovery) => [
            recovery,
            Object.fromEntries(
              SEQUENCE_CONDITION_NAMES.map((condition) => [
                condition,
                {
                  lowerBound: summarizeSamples(
                    included.map(
                      (repository) =>
                        repository.means.confirmatoryReliability.loopExcess[recovery][condition]
                          .lowerBound,
                    ),
                  ),
                  upperBound: summarizeSamples(
                    included.map(
                      (repository) =>
                        repository.means.confirmatoryReliability.loopExcess[recovery][condition]
                          .upperBound,
                    ),
                  ),
                },
              ]),
            ),
          ]),
        ) as Record<
          ControlledRecoveryName,
          Record<
            SequenceConditionName,
            Record<keyof CertifiedNonnegativeInterval, ReturnType<typeof summarizeSamples>>
          >
        >,
      },
    },
  };
}
