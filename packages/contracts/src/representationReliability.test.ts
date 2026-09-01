import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeExcessDefect,
  computeExcessDefectInterval,
  empiricalNearestRankQuantile,
  parseRepresentationReliabilityMetricContractV1,
} from "./representationReliability.ts";

const validContract = parseRepresentationReliabilityMetricContractV1(
  JSON.parse(
    readFileSync(
      new URL("../../../research/representation-reliability-metric-contract.json", import.meta.url),
      "utf8",
    ),
  ),
);

const nearestRankFixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/empirical-nearest-rank.json", import.meta.url),
    "utf8",
  ),
) as {
  schemaVersion: number;
  cases: Array<{
    name: string;
    values: number[];
    probabilityNumerator: number;
    probabilityDenominator: number;
    expected: number;
  }>;
};

describe("parseRepresentationReliabilityMetricContractV1", () => {
  it("accepts the pinned metric and aggregation contract", () => {
    expect(parseRepresentationReliabilityMetricContractV1(validContract)).toEqual(validContract);
  });

  it("rejects a different discrepancy", () => {
    expect(() =>
      parseRepresentationReliabilityMetricContractV1({
        ...validContract,
        observation: { ...validContract.observation, discrepancy: "sampled-mean" },
      }),
    ).toThrow(/observation.discrepancy/);
  });

  it("rejects a changed aggregation order", () => {
    expect(() =>
      parseRepresentationReliabilityMetricContractV1({
        ...validContract,
        aggregationOrder: [...validContract.aggregationOrder].reverse(),
      }),
    ).toThrow(/aggregationOrder/);
  });
});

describe("noise-adjusted defect primitives", () => {
  it("matches the shared empirical nearest-rank fixture", () => {
    expect(nearestRankFixture.schemaVersion).toBe(1);
    for (const testCase of nearestRankFixture.cases) {
      expect(
        empiricalNearestRankQuantile(
          testCase.values,
          testCase.probabilityNumerator / testCase.probabilityDenominator,
        ),
        testCase.name,
      ).toBe(testCase.expected);
    }
  });

  it("uses the empirical nearest-rank quantile", () => {
    expect(empiricalNearestRankQuantile([0, 1, 2, 3], 0.95)).toBe(3);
    expect(empiricalNearestRankQuantile([0, 1, 2, 3], 0.5)).toBe(1);
  });

  it("subtracts repeatability noise and margin before truncating at zero", () => {
    expect(computeExcessDefect(0.7, 0.2, 0.1)).toBeCloseTo(0.4, 12);
    expect(computeExcessDefect(0.3, 0.2, 0.1)).toBe(0);
  });

  it("rejects empty or non-finite empirical inputs", () => {
    expect(() => empiricalNearestRankQuantile([], 0.95)).toThrow(RangeError);
    expect(() => empiricalNearestRankQuantile([0, Number.NaN], 0.95)).toThrow(RangeError);
    expect(() => computeExcessDefect(1, Number.NaN, 0)).toThrow(RangeError);
  });

  it("propagates certified path and repeatability intervals conservatively", () => {
    const result = computeExcessDefectInterval(
      { lowerBound: 0.6, upperBound: 0.8 },
      [
        { lowerBound: 0.1, upperBound: 0.2 },
        { lowerBound: 0.2, upperBound: 0.3 },
      ],
      0.1,
    );

    expect(result).toMatchObject({
      repeatabilityQuantileLowerBound: 0.2,
      repeatabilityQuantileUpperBound: 0.3,
    });
    expect(result.lowerBound).toBeCloseTo(0.2, 12);
    expect(result.upperBound).toBeCloseTo(0.5, 12);
  });

  it("rejects malformed certified intervals", () => {
    expect(() =>
      computeExcessDefectInterval(
        { lowerBound: 1, upperBound: 0 },
        [{ lowerBound: 0, upperBound: 0 }],
        0,
      ),
    ).toThrow(/pathDefect interval/);
    expect(() =>
      computeExcessDefectInterval(
        { lowerBound: 0, upperBound: 1 },
        [{ lowerBound: 0, upperBound: Number.NaN }],
        0,
      ),
    ).toThrow(/repeatability interval/);
  });
});
