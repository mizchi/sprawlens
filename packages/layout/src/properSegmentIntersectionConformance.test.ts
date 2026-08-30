import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { properSegmentsIntersect } from "./properSegmentIntersection.ts";

type Point = { x: number; y: number };

type Fixture = {
  schemaVersion: 1;
  cases: Array<{
    name: string;
    a: Point;
    b: Point;
    c: Point;
    d: Point;
    expected: boolean;
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/proper-segment-intersection.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

describe("Lean/TypeScript proper segment intersection conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("intersection: $name", ({ a, b, c, d, expected }) => {
    expect(properSegmentsIntersect(a, b, c, d)).toBe(expected);
  });
});
