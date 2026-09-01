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

describe("point-to-segment projection scale stability", () => {
  it("does not overflow the projection ratio for a large finite segment", () => {
    const distance = pointToSegmentDistance(
      { x: 5e199, y: 1e199 },
      { x: 0, y: 0 },
      { x: 1e200, y: 0 },
    );

    expect(Number.isFinite(distance)).toBe(true);
    expect(distance / 1e199).toBeCloseTo(1, 12);
  });

  it("does not mistake a tiny non-degenerate segment for a point", () => {
    const distance = pointToSegmentDistance(
      { x: 5e-201, y: 1e-200 },
      { x: 0, y: 0 },
      { x: 1e-200, y: 0 },
    );

    expect(distance / 1e-200).toBeCloseTo(1, 12);
  });

  it("normalizes coordinates before subtracting opposite-sign extremes", () => {
    const distance = pointToSegmentDistance(
      { x: 0, y: 1 },
      { x: -1e308, y: 0 },
      { x: 1e308, y: 0 },
    );

    expect(distance).toBeCloseTo(1, 12);
  });
});
