import {
  buildControlledSequenceProbe,
  CONTROLLED_RECOVERY_NAMES,
  runControlledSequenceProbe,
  SEQUENCE_CONDITION_NAMES,
  summarizeSamples,
  type LayoutSequenceGraph,
  type ControlledRecoveryName,
  type SequenceConditionName,
} from "@sprawlens/layout";

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

export function runControlledSequenceExperiment(
  datasets: readonly Dataset[],
  options: { seeds?: readonly number[]; stableHistoryFreeReferenceWeight?: number } = {},
) {
  const seeds = [...(options.seeds ?? [3, 7, 11])];
  if (seeds.length === 0) throw new Error("controlled sequence experiment requires a seed");
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
    const recoveryMetricMean = (
      recovery: ControlledRecoveryName,
      condition: SequenceConditionName,
      metric: Metric,
    ) => mean(probes.map((probe) => probe.result.recovery[recovery][condition][metric]));
    const pathDependenceMetricMean = (condition: SequenceConditionName, metric: Metric) =>
      mean(probes.map((probe) => probe.result.pathDependence[condition][metric]));
    return {
      repository: dataset.repository,
      probes,
      exclusions,
      means:
        probes.length === 0
          ? null
          : {
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
              ) as Record<
                ControlledRecoveryName,
                Record<SequenceConditionName, Record<Metric, number>>
              >,
              pathDependence: Object.fromEntries(
                SEQUENCE_CONDITION_NAMES.map((condition) => [
                  condition,
                  Object.fromEntries(
                    METRICS.map((metric) => [metric, pathDependenceMetricMean(condition, metric)]),
                  ) as Record<Metric, number>,
                ]),
              ) as Record<SequenceConditionName, Record<Metric, number>>,
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
    schemaVersion: 2 as const,
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
    },
  };
}
