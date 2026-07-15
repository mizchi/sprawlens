export type AstDiffScalingProfile = "smoke" | "pilot" | "stress" | "calibration" | "validation";

export type AstDiffScalingProfileDefaults = {
  repetitions: number;
  warmupIterations: number;
  batchIterations: number;
  timeoutMs: number;
  projectionScenarios: ReadonlyArray<{ symbolCount: number; hunkCount: number }>;
  symbolTreeScenarios: ReadonlyArray<{ symbolCount: number; maxDepth: number }>;
};

const profiles = {
  smoke: {
    repetitions: 1,
    warmupIterations: 1,
    batchIterations: 1,
    timeoutMs: 10_000,
    projectionScenarios: gridProjection([100, 500], [20, 100]),
    symbolTreeScenarios: gridTree([100, 500], [1, 8]),
  },
  pilot: {
    repetitions: 3,
    warmupIterations: 2,
    batchIterations: 1,
    timeoutMs: 30_000,
    projectionScenarios: gridProjection([1_000, 5_000, 20_000], [100, 500, 2_000]),
    symbolTreeScenarios: gridTree([1_000, 5_000, 20_000], [1, 4, 16]),
  },
  stress: {
    repetitions: 7,
    warmupIterations: 10,
    batchIterations: 20,
    timeoutMs: 30_000,
    projectionScenarios: [
      { symbolCount: 1_000, hunkCount: 500 },
      { symbolCount: 1_000, hunkCount: 750 },
      { symbolCount: 1_000, hunkCount: 800 },
      { symbolCount: 1_000, hunkCount: 1_000 },
      { symbolCount: 5_000, hunkCount: 250 },
      { symbolCount: 5_000, hunkCount: 400 },
      { symbolCount: 5_000, hunkCount: 450 },
      { symbolCount: 5_000, hunkCount: 500 },
      { symbolCount: 20_000, hunkCount: 250 },
      { symbolCount: 20_000, hunkCount: 350 },
      { symbolCount: 20_000, hunkCount: 400 },
      { symbolCount: 20_000, hunkCount: 500 },
    ],
    symbolTreeScenarios: [],
  },
  calibration: {
    repetitions: 7,
    warmupIterations: 10,
    batchIterations: 20,
    timeoutMs: 30_000,
    projectionScenarios: gridProjection([1_000, 5_000, 20_000], [25, 50, 100, 150, 200, 250]),
    symbolTreeScenarios: [],
  },
  validation: {
    repetitions: 7,
    warmupIterations: 10,
    batchIterations: 20,
    timeoutMs: 30_000,
    projectionScenarios: gridProjection([2_000, 10_000, 30_000], [35, 75, 125, 175, 225, 300]),
    symbolTreeScenarios: [],
  },
} as const satisfies Record<AstDiffScalingProfile, AstDiffScalingProfileDefaults>;

export function astDiffScalingProfileDefaults(
  profile: AstDiffScalingProfile,
): AstDiffScalingProfileDefaults {
  return profiles[profile];
}

function gridProjection(
  symbolCounts: readonly number[],
  hunkCounts: readonly number[],
): Array<{ symbolCount: number; hunkCount: number }> {
  return symbolCounts.flatMap((symbolCount) =>
    hunkCounts.map((hunkCount) => ({ symbolCount, hunkCount })),
  );
}

function gridTree(
  symbolCounts: readonly number[],
  maxDepths: readonly number[],
): Array<{ symbolCount: number; maxDepth: number }> {
  return symbolCounts.flatMap((symbolCount) =>
    maxDepths
      .filter((maxDepth) => maxDepth <= symbolCount)
      .map((maxDepth) => ({ symbolCount, maxDepth })),
  );
}
