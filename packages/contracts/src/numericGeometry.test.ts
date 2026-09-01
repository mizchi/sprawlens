import { describe, expect, it } from "vitest";
import { parsePointSegmentProjectionContractV1 } from "./numericGeometry.ts";

const validContract = {
  schemaVersion: 1,
  operation: "point-to-segment-distance",
  coordinateDomain: "finite-number",
  nonFiniteInput: "unsupported",
  output: "euclidean-distance",
  degenerateSegment: "distance-to-start",
  parameterClamp: [0, 1],
  oracle: {
    fixture: "formal/TestVectors/point-segment-projection.json",
    exactValue: "squared-distance-rational",
  },
  comparison: {
    fixtureSquaredDistanceDecimalDigits: 12,
    boundaryRatioDecimalDigits: 12,
    propertyDecimalDigits: 12,
  },
  properties: [
    "endpoint-reversal-invariance",
    "translation-invariance",
    "positive-uniform-scale-equivariance",
  ],
  requiredBoundaryCases: [
    "zero-length-segment",
    "projection-before-start",
    "projection-after-finish",
    "squared-length-overflow",
    "squared-length-underflow",
    "endpoint-difference-overflow",
  ],
} as const;

describe("parsePointSegmentProjectionContractV1", () => {
  it("accepts the complete portable kernel contract", () => {
    expect(parsePointSegmentProjectionContractV1(validContract)).toEqual(validContract);
  });

  it("rejects an unsupported schema version", () => {
    expect(() =>
      parsePointSegmentProjectionContractV1({ ...validContract, schemaVersion: 2 }),
    ).toThrow(/schemaVersion/);
  });

  it("rejects a missing portability property", () => {
    expect(() =>
      parsePointSegmentProjectionContractV1({
        ...validContract,
        properties: validContract.properties.slice(0, 2),
      }),
    ).toThrow(/properties/);
  });

  it("rejects an undeclared field", () => {
    expect(() => parsePointSegmentProjectionContractV1({ ...validContract, extra: true })).toThrow(
      /unexpected field/,
    );
  });
});
