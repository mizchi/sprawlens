import { symbolDiffProjectionWorkRatio } from "../packages/viz/src/diffStats.ts";

export type AstDiffThresholdCalibrationComparison = {
  symbolCount: number;
  hunkCount: number;
  indexedP50Ms: number;
  naiveP50Ms: number;
};

export type AstDiffThresholdCalibration = {
  threshold: number;
  materialAdvantageRatio: number;
  naiveFasterScenarios: number;
  indexedFasterScenarios: number;
  ambiguousScenarios: number;
  maxNaiveWorkRatio: number;
  minIndexedWorkRatio: number;
};

export function calibrateAstDiffAdaptiveThreshold(
  comparisons: readonly AstDiffThresholdCalibrationComparison[],
  materialAdvantageRatio = 1.1,
): AstDiffThresholdCalibration {
  if (comparisons.length === 0) throw new Error("calibration comparisons must not be empty");
  if (!Number.isFinite(materialAdvantageRatio) || materialAdvantageRatio <= 1) {
    throw new Error("materialAdvantageRatio must be greater than 1");
  }
  const seen = new Set<string>();
  const naiveWorkRatios: number[] = [];
  const indexedWorkRatios: number[] = [];
  let ambiguousScenarios = 0;
  for (const comparison of comparisons) {
    validateComparison(comparison);
    const key = `${comparison.symbolCount}:${comparison.hunkCount}`;
    if (seen.has(key)) throw new Error(`duplicate calibration scenario: ${key}`);
    seen.add(key);
    const workRatio = symbolDiffProjectionWorkRatio(comparison.symbolCount, comparison.hunkCount);
    const naiveOverIndexed = comparison.naiveP50Ms / comparison.indexedP50Ms;
    if (naiveOverIndexed >= materialAdvantageRatio) {
      indexedWorkRatios.push(workRatio);
    } else if (naiveOverIndexed <= 1 / materialAdvantageRatio) {
      naiveWorkRatios.push(workRatio);
    } else {
      ambiguousScenarios += 1;
    }
  }
  if (naiveWorkRatios.length === 0 || indexedWorkRatios.length === 0) {
    throw new Error("calibration requires materially faster scenarios for both kernels");
  }
  const maxNaiveWorkRatio = Math.max(...naiveWorkRatios);
  const minIndexedWorkRatio = Math.min(...indexedWorkRatios);
  if (maxNaiveWorkRatio >= minIndexedWorkRatio) {
    throw new Error(
      `non-monotone calibration classes overlap: naive<=${maxNaiveWorkRatio}, indexed>=${minIndexedWorkRatio}`,
    );
  }
  return {
    threshold: (maxNaiveWorkRatio + minIndexedWorkRatio) / 2,
    materialAdvantageRatio,
    naiveFasterScenarios: naiveWorkRatios.length,
    indexedFasterScenarios: indexedWorkRatios.length,
    ambiguousScenarios,
    maxNaiveWorkRatio,
    minIndexedWorkRatio,
  };
}

function validateComparison(comparison: AstDiffThresholdCalibrationComparison): void {
  if (!Number.isSafeInteger(comparison.symbolCount) || comparison.symbolCount < 1) {
    throw new Error("calibration symbolCount must be a positive safe integer");
  }
  if (!Number.isSafeInteger(comparison.hunkCount) || comparison.hunkCount < 1) {
    throw new Error("calibration hunkCount must be a positive safe integer");
  }
  if (!Number.isFinite(comparison.indexedP50Ms) || comparison.indexedP50Ms <= 0) {
    throw new Error("calibration indexedP50Ms must be positive");
  }
  if (!Number.isFinite(comparison.naiveP50Ms) || comparison.naiveP50Ms <= 0) {
    throw new Error("calibration naiveP50Ms must be positive");
  }
}
