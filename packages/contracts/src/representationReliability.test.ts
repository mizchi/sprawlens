import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeExcessDefect,
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
});
