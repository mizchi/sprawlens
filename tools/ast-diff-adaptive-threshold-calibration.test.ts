import { describe, expect, it } from "vitest";
import { symbolDiffProjectionWorkRatio } from "../packages/viz/src/diffStats.ts";
import { calibrateAstDiffAdaptiveThreshold } from "./ast-diff-adaptive-threshold-calibration.ts";

describe("calibrateAstDiffAdaptiveThreshold", () => {
  it("places the threshold between monotone materially faster kernel classes", () => {
    const result = calibrateAstDiffAdaptiveThreshold([
      comparison(1_000, 25, 10, 5),
      comparison(1_000, 50, 10, 9.5),
      comparison(1_000, 100, 5, 10),
    ]);
    const lower = symbolDiffProjectionWorkRatio(1_000, 25);
    const upper = symbolDiffProjectionWorkRatio(1_000, 100);

    expect(result).toMatchObject({
      materialAdvantageRatio: 1.1,
      naiveFasterScenarios: 1,
      indexedFasterScenarios: 1,
      ambiguousScenarios: 1,
      maxNaiveWorkRatio: lower,
      minIndexedWorkRatio: upper,
    });
    expect(result.threshold).toBeCloseTo((lower + upper) / 2, 12);
  });

  it("rejects non-monotone and one-sided calibration evidence", () => {
    expect(() =>
      calibrateAstDiffAdaptiveThreshold([
        comparison(1_000, 25, 5, 10),
        comparison(1_000, 100, 10, 5),
      ]),
    ).toThrow(/non-monotone/i);
    expect(() => calibrateAstDiffAdaptiveThreshold([comparison(1_000, 25, 10, 5)])).toThrow(
      /both/i,
    );
  });
});

function comparison(
  symbolCount: number,
  hunkCount: number,
  indexedP50Ms: number,
  naiveP50Ms: number,
) {
  return { symbolCount, hunkCount, indexedP50Ms, naiveP50Ms };
}
