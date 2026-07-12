export type ConditionMemoryMeasurement = {
  condition: "baseline" | "stable";
  repositories: number;
  cases: number;
  calls: number;
  maxRssKb: number;
};

type ConditionMemoryWorkload = Pick<ConditionMemoryMeasurement, "repositories" | "cases" | "calls">;

/** Refuse post-hoc measurements that no longer represent the frozen primary workload. */
export function assertConditionMemoryWorkload(
  measurement: ConditionMemoryMeasurement,
  expected: ConditionMemoryWorkload,
) {
  if (
    measurement.repositories !== expected.repositories ||
    measurement.cases !== expected.cases ||
    measurement.calls !== expected.calls
  ) {
    throw new Error("memory measurement does not match frozen primary workload");
  }
}

/** Compare isolated processes only after verifying that they ran the same workload. */
export function compareConditionMemory(
  baseline: ConditionMemoryMeasurement,
  stable: ConditionMemoryMeasurement,
) {
  if (baseline.condition !== "baseline" || stable.condition !== "stable") {
    throw new Error("memory comparison requires baseline then stable condition");
  }
  if (
    baseline.repositories !== stable.repositories ||
    baseline.cases !== stable.cases ||
    baseline.calls !== stable.calls
  ) {
    throw new Error("memory comparison condition workload mismatch");
  }
  if (baseline.maxRssKb <= 0 || stable.maxRssKb <= 0) {
    throw new Error("memory comparison requires positive peak RSS");
  }
  return {
    unit: "condition-isolated Node.js process peak RSS" as const,
    baselineMaxRssKb: baseline.maxRssKb,
    stableMaxRssKb: stable.maxRssKb,
    overheadKb: stable.maxRssKb - baseline.maxRssKb,
    ratio: stable.maxRssKb / baseline.maxRssKb,
    repositories: baseline.repositories,
    cases: baseline.cases,
    calls: baseline.calls,
  };
}

export type ConditionMemoryPair = {
  baseline: ConditionMemoryMeasurement;
  stable: ConditionMemoryMeasurement;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
};

/** Summarize paired isolated-process measurements without pooling unlike workloads. */
export function summarizeConditionMemoryPairs(pairs: ConditionMemoryPair[]) {
  if (pairs.length < 3) {
    throw new Error("memory comparison requires at least three paired repetitions");
  }
  const comparisons = pairs.map(({ baseline, stable }) => compareConditionMemory(baseline, stable));
  const workload = comparisons[0]!;
  if (
    comparisons.some(
      (comparison) =>
        comparison.repositories !== workload.repositories ||
        comparison.cases !== workload.cases ||
        comparison.calls !== workload.calls,
    )
  ) {
    throw new Error("memory comparison repetition workload mismatch");
  }
  const ratios = comparisons.map(({ ratio }) => ratio);
  return {
    unit: workload.unit,
    repetitions: pairs.length,
    baselineMedianMaxRssKb: median(pairs.map(({ baseline }) => baseline.maxRssKb)),
    stableMedianMaxRssKb: median(pairs.map(({ stable }) => stable.maxRssKb)),
    medianOverheadKb: median(comparisons.map(({ overheadKb }) => overheadKb)),
    medianRatio: median(ratios),
    ratioRange: [Math.min(...ratios), Math.max(...ratios)] as [number, number],
    repositories: workload.repositories,
    cases: workload.cases,
    calls: workload.calls,
  };
}
