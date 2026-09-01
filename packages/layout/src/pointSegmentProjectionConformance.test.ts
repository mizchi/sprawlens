import { readFileSync } from "node:fs";
import {
  parsePointSegmentProjectionContractV1,
  type PointSegmentProjectionContractV1,
} from "@sprawlens/contracts";
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

const contract = parsePointSegmentProjectionContractV1(
  JSON.parse(
    readFileSync(
      new URL(
        "../../../formal/TestVectors/point-segment-projection-contract.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

type Point = Fixture["cases"][number]["point"];
type ProjectionCase = Pick<Fixture["cases"][number], "point" | "start" | "finish">;
type PropertyId = PointSegmentProjectionContractV1["properties"][number];
type BoundaryCaseId = PointSegmentProjectionContractV1["requiredBoundaryCases"][number];

describe("Lean/TypeScript point-to-segment projection conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)(
    "projection: $name",
    ({ point, start, finish, expectedSquaredDistance }) => {
      const distance = pointToSegmentDistance(point, start, finish);
      expect(distance * distance).toBeCloseTo(
        expectedSquaredDistance.numerator / expectedSquaredDistance.denominator,
        contract.comparison.fixtureSquaredDistanceDecimalDigits,
      );
    },
  );
});

const boundaryCases = {
  "zero-length-segment": {
    point: { x: 3, y: 4 },
    start: { x: 0, y: 0 },
    finish: { x: 0, y: 0 },
    expectedDistance: 5,
  },
  "projection-before-start": {
    point: { x: -3, y: 4 },
    start: { x: 0, y: 0 },
    finish: { x: 4, y: 0 },
    expectedDistance: 5,
  },
  "projection-after-finish": {
    point: { x: 6, y: 8 },
    start: { x: 0, y: 0 },
    finish: { x: 4, y: 0 },
    expectedDistance: Math.sqrt(68),
  },
  "squared-length-overflow": {
    point: { x: 5e199, y: 1e199 },
    start: { x: 0, y: 0 },
    finish: { x: 1e200, y: 0 },
    expectedDistance: 1e199,
  },
  "squared-length-underflow": {
    point: { x: 5e-201, y: 1e-200 },
    start: { x: 0, y: 0 },
    finish: { x: 1e-200, y: 0 },
    expectedDistance: 1e-200,
  },
  "endpoint-difference-overflow": {
    point: { x: 0, y: 1 },
    start: { x: -1e308, y: 0 },
    finish: { x: 1e308, y: 0 },
    expectedDistance: 1,
  },
} satisfies Record<
  BoundaryCaseId,
  ProjectionCase & {
    expectedDistance: number;
  }
>;

describe("point-to-segment projection contract boundary cases", () => {
  it.each(contract.requiredBoundaryCases)("satisfies $0", (caseId) => {
    const { point, start, finish, expectedDistance } = boundaryCases[caseId];
    const distance = pointToSegmentDistance(point, start, finish);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance / expectedDistance).toBeCloseTo(
      1,
      contract.comparison.boundaryRatioDecimalDigits,
    );
  });
});

const propertyTransforms = {
  "endpoint-reversal-invariance": ({ point, start, finish }: ProjectionCase) => ({
    point,
    start: finish,
    finish: start,
    expectedScale: 1,
  }),
  "translation-invariance": ({ point, start, finish }: ProjectionCase) => {
    const translate = ({ x, y }: Point) => ({ x: x + 17.25, y: y - 9.5 });
    return {
      point: translate(point),
      start: translate(start),
      finish: translate(finish),
      expectedScale: 1,
    };
  },
  "positive-uniform-scale-equivariance": ({ point, start, finish }: ProjectionCase) => {
    const scale = ({ x, y }: Point) => ({ x: x * 4, y: y * 4 });
    return {
      point: scale(point),
      start: scale(start),
      finish: scale(finish),
      expectedScale: 4,
    };
  },
} satisfies Record<
  PropertyId,
  (testCase: ProjectionCase) => ProjectionCase & { expectedScale: number }
>;

const propertyCases = contract.properties.flatMap((property) =>
  fixture.cases.map((testCase) => ({ property, testCase })),
);

describe("point-to-segment projection contract properties", () => {
  it.each(propertyCases)("$property: $testCase.name", ({ property, testCase }) => {
    const transformed = propertyTransforms[property](testCase);
    const originalDistance = pointToSegmentDistance(
      testCase.point,
      testCase.start,
      testCase.finish,
    );
    expect(
      pointToSegmentDistance(transformed.point, transformed.start, transformed.finish),
    ).toBeCloseTo(
      originalDistance * transformed.expectedScale,
      contract.comparison.propertyDecimalDigits,
    );
  });
});
