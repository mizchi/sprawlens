import { describe, expect, it } from "vitest";
import { chooseSymbolDiffProjectionStrategy } from "../packages/viz/src/diffStats.ts";
import { astDiffScalingProfileDefaults } from "./ast-diff-scaling-profiles.ts";

describe("astDiffScalingProfileDefaults", () => {
  it("fixes a balanced batched stress matrix on both sides of the adaptive threshold", () => {
    const profile = astDiffScalingProfileDefaults("stress");
    const strategies = profile.projectionScenarios.map(({ symbolCount, hunkCount }) =>
      chooseSymbolDiffProjectionStrategy(symbolCount, hunkCount),
    );

    expect(profile).toMatchObject({
      repetitions: 7,
      warmupIterations: 10,
      batchIterations: 20,
      timeoutMs: 30_000,
      symbolTreeScenarios: [],
    });
    expect(profile.projectionScenarios).toHaveLength(12);
    expect(
      new Set(
        profile.projectionScenarios.map(
          ({ symbolCount, hunkCount }) => `${symbolCount}:${hunkCount}`,
        ),
      ).size,
    ).toBe(12);
    expect(strategies.filter((strategy) => strategy === "naive")).toHaveLength(6);
    expect(strategies.filter((strategy) => strategy === "indexed")).toHaveLength(6);
  });

  it("keeps v2 calibration and validation scenarios disjoint before timing", () => {
    const calibration = astDiffScalingProfileDefaults("calibration");
    const validation = astDiffScalingProfileDefaults("validation");
    const calibrationKeys = new Set(
      calibration.projectionScenarios.map(
        ({ symbolCount, hunkCount }) => `${symbolCount}:${hunkCount}`,
      ),
    );
    const validationKeys = validation.projectionScenarios.map(
      ({ symbolCount, hunkCount }) => `${symbolCount}:${hunkCount}`,
    );

    expect(calibration).toMatchObject({
      repetitions: 7,
      warmupIterations: 10,
      batchIterations: 20,
      symbolTreeScenarios: [],
    });
    expect(validation).toMatchObject({
      repetitions: 7,
      warmupIterations: 10,
      batchIterations: 20,
      symbolTreeScenarios: [],
    });
    expect(calibration.projectionScenarios).toHaveLength(18);
    expect(validation.projectionScenarios).toHaveLength(18);
    expect(validationKeys.every((key) => !calibrationKeys.has(key))).toBe(true);
  });
});
