import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pointToSegmentDistance } from "./boundaryHausdorff.ts";

type Rational = { numerator: number; denominator: number };

type Fixture = {
  schemaVersion: 1;
  cases: Array<{
    name: string;
    point: { x: number; y: number };
    start: { x: number; y: number };
    finish: { x: number; y: number };
    expectedSquaredDistance: Rational;
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/point-segment-projection.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

describe("Lean/TypeScript point-to-segment projection conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)(
    "projection: $name",
    ({ point, start, finish, expectedSquaredDistance }) => {
      const distance = pointToSegmentDistance(point, start, finish);
      expect(distance * distance).toBeCloseTo(
        expectedSquaredDistance.numerator / expectedSquaredDistance.denominator,
        12,
      );
    },
  );
});
