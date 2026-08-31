import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { affineBarycenter, weightedBarycenter } from "./barycenter.ts";

type RationalPoint = {
  xNumerator: number;
  xDenominator: number;
  yNumerator: number;
  yDenominator: number;
};

type Fixture = {
  schemaVersion: 1;
  weightedCases: Array<{
    name: string;
    samples: Array<{ x: number; y: number; weight: number }>;
    expected: RationalPoint | null;
  }>;
  affineCases: Array<{
    name: string;
    current: { x: number; y: number };
    previous: { x: number; y: number };
    mixNumerator: number;
    mixDenominator: number;
    expected: RationalPoint;
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/temporal-barycenter.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

const expectedPoint = (point: RationalPoint) => ({
  x: point.xNumerator / point.xDenominator,
  y: point.yNumerator / point.yDenominator,
});

describe("Lean/TypeScript temporal barycenter conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.weightedCases)("weighted: $name", ({ samples, expected }) => {
    const actual = weightedBarycenter(
      samples.map(({ x, y, weight }) => ({ point: { x, y }, weight })),
    );
    if (expected === null) expect(actual).toBeUndefined();
    else expect(actual).toEqual(expectedPoint(expected));
  });

  it.each(fixture.affineCases)(
    "affine: $name",
    ({ current, previous, mixNumerator, mixDenominator, expected }) => {
      expect(affineBarycenter(current, previous, mixNumerator / mixDenominator)).toEqual(
        expectedPoint(expected),
      );
    },
  );
});
