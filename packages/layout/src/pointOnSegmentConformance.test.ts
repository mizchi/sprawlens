import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pointInOpenSegment } from "./pointOnSegment.ts";

type Point = { x: number; y: number };

type Fixture = {
  schemaVersion: 1;
  cases: Array<{
    name: string;
    a: Point;
    b: Point;
    point: Point;
    expected: boolean;
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/point-in-open-segment.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

describe("Lean/TypeScript point-in-open-segment conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("contact: $name", ({ a, b, point, expected }) => {
    expect(pointInOpenSegment(a, b, point)).toBe(expected);
  });
});
