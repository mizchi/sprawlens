import { describe, expect, it } from "vitest";
import { chooseSymbolDiffProjectionStrategy } from "../packages/viz/src/diffStats.ts";
import { astDiffScalingProfileDefaults } from "./ast-diff-scaling-profiles.ts";

describe("astDiffScalingProfileDefaults", () => {
  it("keeps the v1 stress matrix fixed under the current adaptive threshold", () => {
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
    expect(strategies.filter((strategy) => strategy === "naive")).toHaveLength(0);
    expect(strategies.filter((strategy) => strategy === "indexed")).toHaveLength(12);
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

  it("keeps the post-stop low-hunk calibration disjoint from both frozen grids", () => {
    const originalKeys = new Set(
      astDiffScalingProfileDefaults("calibration").projectionScenarios.map(
        ({ symbolCount, hunkCount }) => `${symbolCount}:${hunkCount}`,
      ),
    );
    const validationKeys = new Set(
      astDiffScalingProfileDefaults("validation").projectionScenarios.map(
        ({ symbolCount, hunkCount }) => `${symbolCount}:${hunkCount}`,
      ),
    );
    const low = astDiffScalingProfileDefaults("calibration-low");
    const lowKeys = low.projectionScenarios.map(
      ({ symbolCount, hunkCount }) => `${symbolCount}:${hunkCount}`,
    );

    expect(low).toMatchObject({
      repetitions: 7,
      warmupIterations: 10,
      batchIterations: 20,
      symbolTreeScenarios: [],
    });
    expect(low.projectionScenarios).toHaveLength(24);
    expect(lowKeys.every((key) => !originalKeys.has(key) && !validationKeys.has(key))).toBe(true);
  });
});
