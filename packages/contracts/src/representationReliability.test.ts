import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeExcessDefect,
  computeExcessDefectInterval,
  empiricalNearestRankQuantile,
  parseRepresentationReliabilityMetricContractV1,
  selectAdaptiveHausdorffTargetFromSesoi,
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
    expect(validContract.inputEndpoint).toMatchObject({
      graphSchema: "ordered-layout-sequence-graph-v1",
      order: "node-and-edge-array-order-significant",
      mismatch: "fail-closed-before-layout",
    });
    expect(validContract.observation.representationEquivalence).toEqual({
      exactBoundarySet: ["cyclic-seam-rotation", "winding-reversal", "on-edge-vertex-insertion"],
      fixedEdgeSampler:
        "zero-distance-preserved-but-interval-width-may-change-after-on-edge-vertex-insertion",
      adaptiveEdgeSampler: "target-width-preserved-not-bitwise-identical-interval",
    });
    expect(validContract.observation.transformationLaws).toEqual({
      commonRigidTransform: "exact-distance-and-normalized-interval-invariant",
      commonUniformScale:
        "exact-distance-and-absolute-interval-scale-by-absolute-factor-normalized-interval-invariant",
      zeroScale: "outside-domain-fail-closed",
    });
    expect(validContract.adaptivePrecisionSelection).toEqual({
      status: "pending-preregistered-sesoi",
      candidateTargets: [0.03, 0.02, 0.01],
      derivedWidthUpperBound: "path-target-plus-noise-target",
      uncertaintyBudget: "derived-sampling-width-at-most-sesoi-half",
      eligibilityRule: "target-at-most-sesoi-quarter",
      selectionRule: "largest-eligible-preregistered-target",
      observedEffectDependence: "forbidden",
    });
  });

  it("rejects weakening ordered endpoint equality", () => {
    expect(() =>
      parseRepresentationReliabilityMetricContractV1({
        ...validContract,
        inputEndpoint: { ...validContract.inputEndpoint, order: "unordered-node-set" },
      }),
    ).toThrow(/inputEndpoint.order/);
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

describe("SESOI-driven adaptive Hausdorff target selection", () => {
  it("selects the coarsest preregistered target satisfying target <= SESOI / 4", () => {
    expect(selectAdaptiveHausdorffTargetFromSesoi(0.08, [0.01, 0.03, 0.02])).toEqual({
      sesoi: 0.08,
      maximumDerivedSamplingUncertainty: 0.04,
      maximumPerIntervalTarget: 0.02,
      selectedTarget: 0.02,
      eligibleTargets: [0.02, 0.01],
    });
  });

  it("selects 0.01 when a 0.04 SESOI is preregistered", () => {
    expect(selectAdaptiveHausdorffTargetFromSesoi(0.04, [0.03, 0.02, 0.01]).selectedTarget).toBe(
      0.01,
    );
  });

  it("fails closed when no candidate can meet the uncertainty budget", () => {
    expect(() => selectAdaptiveHausdorffTargetFromSesoi(0.02, [0.03, 0.02, 0.01])).toThrow(
      /no preregistered adaptive target satisfies SESOI \/ 4/,
    );
  });

  it("rejects invalid SESOI values and candidate sets", () => {
    expect(() => selectAdaptiveHausdorffTargetFromSesoi(0, [0.01])).toThrow(
      /positive finite SESOI/,
    );
    expect(() => selectAdaptiveHausdorffTargetFromSesoi(0.08, [])).toThrow(
      /at least one preregistered adaptive target/,
    );
    expect(() => selectAdaptiveHausdorffTargetFromSesoi(0.08, [0.01, Number.NaN])).toThrow(
      /positive finite adaptive targets/,
    );
    expect(() => selectAdaptiveHausdorffTargetFromSesoi(0.08, [0.01, 0.01])).toThrow(
      /must be unique/,
    );
  });
});
