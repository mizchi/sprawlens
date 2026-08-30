import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { interpolatePoint } from "./halfPlaneIntersection.ts";
import { orientationDeterminant } from "./orientation.ts";

type Point = { x: number; y: number };
type Fixture = {
  schemaVersion: 1;
  cases: Array<{
    name: string;
    a: Point;
    b: Point;
    c: Point;
    parameterNumerator: number;
    parameterDenominator: number;
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/segment-interpolation-orientation.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

describe("Lean/TypeScript segment interpolation orientation conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("orientation: $name", (testCase) => {
    const parameter = testCase.parameterNumerator / testCase.parameterDenominator;
    const base = orientationDeterminant(testCase.a, testCase.b, testCase.c);
    const finishPoint = interpolatePoint(testCase.b, testCase.c, parameter);
    const startPoint = interpolatePoint(testCase.a, testCase.b, parameter);
    expect(orientationDeterminant(testCase.a, testCase.b, finishPoint)).toBeCloseTo(
      parameter * base,
    );
    expect(orientationDeterminant(startPoint, testCase.b, testCase.c)).toBeCloseTo(
      (1 - parameter) * base,
    );
    expect(orientationDeterminant(testCase.a, finishPoint, testCase.c)).toBeCloseTo(
      (1 - parameter) * base,
    );
  });
});
