import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { halfPlaneBoundaryParameter } from "./halfPlaneIntersection.ts";

type BoundaryCase = {
  name: string;
  currentDistance: number;
  nextDistance: number;
  expectedNumerator: number;
  expectedDenominator: number;
};

type Fixture = { schemaVersion: 1; cases: BoundaryCase[] };

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/half-plane-boundary-parameter.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

describe("Lean/TypeScript half-plane boundary-parameter conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("boundary parameter: $name", (testCase) => {
    const parameter = halfPlaneBoundaryParameter(testCase.currentDistance, testCase.nextDistance);
    expect(parameter).toBeCloseTo(testCase.expectedNumerator / testCase.expectedDenominator);
    expect(parameter).toBeGreaterThanOrEqual(0);
    expect(parameter).toBeLessThanOrEqual(1);
    expect(
      testCase.currentDistance + (testCase.nextDistance - testCase.currentDistance) * parameter,
    ).toBeCloseTo(0);
  });
});
