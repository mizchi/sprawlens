import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collinearOpenSegmentsOverlap } from "./collinearOverlap.ts";

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
    new URL("../../../formal/TestVectors/collinear-open-overlap.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

describe("Lean/TypeScript collinear open-overlap conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("overlap: $name", ({ a, b, c, d, expected }) => {
    expect(collinearOpenSegmentsOverlap(a, b, c, d)).toBe(expected);
  });
});
