import { describe, expect, it } from "vitest";
import {
  assertConditionMemoryWorkload,
  compareConditionMemory,
  summarizeConditionMemoryPairs,
} from "./repositoryEvaluationMemory.ts";

describe("condition-isolated memory comparison", () => {
  it("compares processes only when their fixed workloads match", () => {
    expect(
      compareConditionMemory(
        { condition: "baseline", repositories: 20, cases: 182, calls: 546, maxRssKb: 500_000 },
        { condition: "stable", repositories: 20, cases: 182, calls: 546, maxRssKb: 750_000 },
      ),
    ).toEqual({
      unit: "condition-isolated Node.js process peak RSS",
      baselineMaxRssKb: 500_000,
      stableMaxRssKb: 750_000,
      overheadKb: 250_000,
      ratio: 1.5,
      repositories: 20,
      cases: 182,
      calls: 546,
    });
  });

  it("rejects mismatched or reversed conditions", () => {
    const baseline = {
      condition: "baseline" as const,
      repositories: 20,
      cases: 182,
      calls: 546,
      maxRssKb: 500_000,
    };
    expect(() =>
      compareConditionMemory(baseline, {
        condition: "stable",
        repositories: 19,
        cases: 182,
        calls: 546,
        maxRssKb: 700_000,
      }),
    ).toThrow(/workload/);
    expect(() => compareConditionMemory({ ...baseline, condition: "stable" }, baseline)).toThrow(
      /condition/,
    );
  });

  it("summarizes paired repetitions using the median ratio and observed range", () => {
    const baseline = (maxRssKb: number) => ({
      condition: "baseline" as const,
      repositories: 20,
      cases: 182,
      calls: 546,
      maxRssKb,
    });
    const stable = (maxRssKb: number) => ({
      condition: "stable" as const,
      repositories: 20,
      cases: 182,
      calls: 546,
      maxRssKb,
    });

    expect(
      summarizeConditionMemoryPairs([
        { baseline: baseline(100), stable: stable(120) },
        { baseline: baseline(200), stable: stable(180) },
        { baseline: baseline(400), stable: stable(420) },
      ]),
    ).toEqual({
      unit: "condition-isolated Node.js process peak RSS",
      repetitions: 3,
      baselineMedianMaxRssKb: 200,
      stableMedianMaxRssKb: 180,
      medianOverheadKb: 20,
      medianRatio: 1.05,
      ratioRange: [0.9, 1.2],
      repositories: 20,
      cases: 182,
      calls: 546,
    });
  });

  it("requires at least three paired repetitions with one shared workload", () => {
    const pair = {
      baseline: {
        condition: "baseline" as const,
        repositories: 20,
        cases: 182,
        calls: 546,
        maxRssKb: 100,
      },
      stable: {
        condition: "stable" as const,
        repositories: 20,
        cases: 182,
        calls: 546,
        maxRssKb: 120,
      },
    };
    expect(() => summarizeConditionMemoryPairs([pair, pair])).toThrow(/three/);
    expect(() =>
      summarizeConditionMemoryPairs([
        pair,
        pair,
        {
          ...pair,
          stable: { ...pair.stable, calls: 545 },
        },
      ]),
    ).toThrow(/workload/);
  });

  it("rejects a measurement that drifts from the frozen primary workload", () => {
    const measurement = {
      condition: "stable" as const,
      repositories: 20,
      cases: 182,
      calls: 546,
      maxRssKb: 700_000,
    };
    expect(() =>
      assertConditionMemoryWorkload(measurement, {
        repositories: 20,
        cases: 182,
        calls: 546,
      }),
    ).not.toThrow();
    expect(() =>
      assertConditionMemoryWorkload(measurement, {
        repositories: 20,
        cases: 183,
        calls: 549,
      }),
    ).toThrow(/frozen primary workload/);
  });
});
