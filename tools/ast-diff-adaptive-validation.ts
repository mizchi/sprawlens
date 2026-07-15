export type AstDiffAdaptiveValidationStrategy = "naive" | "indexed";

export type AstDiffAdaptiveValidationComparison = {
  symbolCount: number;
  hunkCount: number;
  indexedP50Ms: number;
  naiveP50Ms: number;
  speedup: number;
  adaptiveOverBest: number;
  adaptiveStrategy: AstDiffAdaptiveValidationStrategy;
};

export type AstDiffAdaptiveValidationGroup = {
  kernel: "hunk-projection" | "symbol-tree";
  condition: "indexed" | "naive" | "adaptive" | "parent-aware";
  symbolCount: number;
  hunkCount: number;
  repetitions: number;
  successfulRepetitions: number;
  failures: number;
  timeouts: number;
  outputDigest: string | null;
  outputItems: number | null;
  maxRssKb: { max: number } | null;
};

export type AstDiffAdaptiveValidationInput = {
  projectionComparisons: readonly AstDiffAdaptiveValidationComparison[];
  groups: readonly AstDiffAdaptiveValidationGroup[];
};

export type AstDiffAdaptiveValidationAssessment = {
  passed: boolean;
  gates: {
    outputExactness: {
      passed: boolean;
      matchingScenarios: number;
      requiredScenarios: 18;
    };
    branchCoverage: {
      passed: boolean;
      minimumPerBranch: 3;
      naiveScenarios: number;
      indexedScenarios: number;
    };
    overallTracking: {
      passed: boolean;
      withinBound: number;
      required: 15;
      total: 18;
    };
    branchTracking: {
      passed: boolean;
      branches: Array<{
        strategy: AstDiffAdaptiveValidationStrategy;
        withinBound: number;
        required: number;
        total: number;
        passed: boolean;
      }>;
    };
  };
  diagnostics: {
    choiceAgreement: number;
    adaptiveOverBest: { min: number; max: number };
    naiveOverIndexed: { min: number; max: number };
    failures: number;
    timeouts: number;
    peakRssKb: number | null;
  };
};

const EXPECTED_SCENARIOS = 18;
const MINIMUM_PER_BRANCH = 3;
const TRACKING_BOUND = 1.25;
const MINIMUM_OVERALL_WITHIN_BOUND = 15;
const MINIMUM_BRANCH_FRACTION = 0.8;

export function assessAstDiffAdaptiveValidation(
  input: AstDiffAdaptiveValidationInput,
): AstDiffAdaptiveValidationAssessment {
  validateComparisons(input.projectionComparisons);
  const projectionGroups = input.groups.filter((group) => group.kernel === "hunk-projection");
  const groupsByScenario = new Map<string, AstDiffAdaptiveValidationGroup[]>();
  for (const group of projectionGroups) {
    const key = scenarioKey(group);
    const groups = groupsByScenario.get(key) ?? [];
    groups.push(group);
    groupsByScenario.set(key, groups);
  }
  const matchingScenarios = [...groupsByScenario.values()].filter(outputExact).length;
  const outputExactness = {
    passed: matchingScenarios === EXPECTED_SCENARIOS,
    matchingScenarios,
    requiredScenarios: EXPECTED_SCENARIOS,
  } as const;

  const naiveScenarios = input.projectionComparisons.filter(
    ({ adaptiveStrategy }) => adaptiveStrategy === "naive",
  ).length;
  const indexedScenarios = EXPECTED_SCENARIOS - naiveScenarios;
  const branchCoverage = {
    passed: naiveScenarios >= MINIMUM_PER_BRANCH && indexedScenarios >= MINIMUM_PER_BRANCH,
    minimumPerBranch: MINIMUM_PER_BRANCH,
    naiveScenarios,
    indexedScenarios,
  } as const;

  const overallWithinBound = input.projectionComparisons.filter(
    ({ adaptiveOverBest }) => adaptiveOverBest <= TRACKING_BOUND,
  ).length;
  const overallTracking = {
    passed: overallWithinBound >= MINIMUM_OVERALL_WITHIN_BOUND,
    withinBound: overallWithinBound,
    required: MINIMUM_OVERALL_WITHIN_BOUND,
    total: EXPECTED_SCENARIOS,
  } as const;

  const branches = (["naive", "indexed"] as const).flatMap((strategy) => {
    const comparisons = input.projectionComparisons.filter(
      ({ adaptiveStrategy }) => adaptiveStrategy === strategy,
    );
    if (comparisons.length === 0) return [];
    const withinBound = comparisons.filter(
      ({ adaptiveOverBest }) => adaptiveOverBest <= TRACKING_BOUND,
    ).length;
    const required = Math.ceil(MINIMUM_BRANCH_FRACTION * comparisons.length);
    return [
      {
        strategy,
        withinBound,
        required,
        total: comparisons.length,
        passed: withinBound >= required,
      },
    ];
  });
  const branchTracking = {
    passed: branches.every(({ passed }) => passed),
    branches,
  };

  const adaptiveOverBest = input.projectionComparisons.map(
    (comparison) => comparison.adaptiveOverBest,
  );
  const naiveOverIndexed = input.projectionComparisons.map((comparison) => comparison.speedup);
  const peakRssValues = input.groups.flatMap((group) =>
    group.maxRssKb ? [group.maxRssKb.max] : [],
  );
  const gates = { outputExactness, branchCoverage, overallTracking, branchTracking };
  return {
    passed: Object.values(gates).every(({ passed }) => passed),
    gates,
    diagnostics: {
      choiceAgreement: input.projectionComparisons.filter((comparison) =>
        comparison.adaptiveStrategy === "indexed"
          ? comparison.indexedP50Ms <= comparison.naiveP50Ms
          : comparison.naiveP50Ms <= comparison.indexedP50Ms,
      ).length,
      adaptiveOverBest: range(adaptiveOverBest),
      naiveOverIndexed: range(naiveOverIndexed),
      failures: input.groups.reduce((sum, group) => sum + group.failures, 0),
      timeouts: input.groups.reduce((sum, group) => sum + group.timeouts, 0),
      peakRssKb: peakRssValues.length > 0 ? Math.max(...peakRssValues) : null,
    },
  };
}

export function renderAstDiffAdaptiveValidationAssessment(
  assessment: AstDiffAdaptiveValidationAssessment,
): string {
  const { gates, diagnostics } = assessment;
  const gate = (passed: boolean) => (passed ? "PASS" : "FAIL");
  const branchTracking = gates.branchTracking.branches
    .map(
      ({ strategy, withinBound, required, total }) =>
        `${strategy} ${withinBound}/${total} (required ${required})`,
    )
    .join("; ");
  return `Overall: **${assessment.passed ? "PASSED" : "FAILED"}**

| Gate | Result | Observation |
|---|:---:|---|
| 1. Output exactness | ${gate(gates.outputExactness.passed)} | ${gates.outputExactness.matchingScenarios}/${gates.outputExactness.requiredScenarios} matching scenarios |
| 2. Branch coverage | ${gate(gates.branchCoverage.passed)} | naive ${gates.branchCoverage.naiveScenarios}; indexed ${gates.branchCoverage.indexedScenarios}; required ≥${gates.branchCoverage.minimumPerBranch} each |
| 3. Overall tracking | ${gate(gates.overallTracking.passed)} | ${gates.overallTracking.withinBound}/${gates.overallTracking.total} within 1.25; required ${gates.overallTracking.required} |
| 4. Per-selected-branch tracking | ${gate(gates.branchTracking.passed)} | ${branchTracking} |

- Fastest-kernel choice agreement: ${diagnostics.choiceAgreement}/${gates.overallTracking.total}
- Adaptive/best range: ${diagnostics.adaptiveOverBest.min.toFixed(3)}–${diagnostics.adaptiveOverBest.max.toFixed(3)}
- Naive/indexed range: ${diagnostics.naiveOverIndexed.min.toFixed(3)}–${diagnostics.naiveOverIndexed.max.toFixed(3)}
- Peak RSS: ${diagnostics.peakRssKb === null ? "unavailable" : `${diagnostics.peakRssKb.toLocaleString("en-US")} KiB`}
- Failures: ${diagnostics.failures}; timeouts: ${diagnostics.timeouts}
`;
}

function outputExact(groups: readonly AstDiffAdaptiveValidationGroup[]): boolean {
  if (groups.length !== 3) return false;
  const conditions = new Set(groups.map(({ condition }) => condition));
  if (!["indexed", "naive", "adaptive"].every((condition) => conditions.has(condition))) {
    return false;
  }
  if (groups.some((group) => group.successfulRepetitions !== group.repetitions)) return false;
  if (
    groups.some((group) => typeof group.outputDigest !== "string" || group.outputItems === null)
  ) {
    return false;
  }
  return (
    new Set(groups.map(({ outputDigest }) => outputDigest)).size === 1 &&
    new Set(groups.map(({ outputItems }) => outputItems)).size === 1
  );
}

function validateComparisons(comparisons: readonly AstDiffAdaptiveValidationComparison[]): void {
  if (comparisons.length !== EXPECTED_SCENARIOS) {
    throw new Error(`validation must contain exactly ${EXPECTED_SCENARIOS} projection comparisons`);
  }
  const seen = new Set<string>();
  for (const comparison of comparisons) {
    const key = scenarioKey(comparison);
    if (seen.has(key)) throw new Error(`duplicate validation scenario: ${key}`);
    seen.add(key);
    if (
      !Number.isSafeInteger(comparison.symbolCount) ||
      comparison.symbolCount < 1 ||
      !Number.isSafeInteger(comparison.hunkCount) ||
      comparison.hunkCount < 1
    ) {
      throw new Error("validation dimensions must be positive safe integers");
    }
    for (const value of [
      comparison.indexedP50Ms,
      comparison.naiveP50Ms,
      comparison.speedup,
      comparison.adaptiveOverBest,
    ]) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("validation timing ratios must be positive finite numbers");
      }
    }
  }
}

function scenarioKey(value: { symbolCount: number; hunkCount: number }): string {
  return `${value.symbolCount}:${value.hunkCount}`;
}

function range(values: readonly number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}
