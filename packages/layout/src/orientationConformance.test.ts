import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { orientationDeterminant } from "./orientation.ts";

type Point = { x: number; y: number };

type Fixture = {
  schemaVersion: 1;
  cases: Array<{
    name: string;
    a: Point;
    b: Point;
    c: Point;
    expected: number;
  }>;
};

const fixture = JSON.parse(
  readFileSync(new URL("../../../formal/TestVectors/orientation.json", import.meta.url), "utf8"),
) as Fixture;

describe("Lean/TypeScript orientation determinant conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("orientation: $name", ({ a, b, c, expected }) => {
    expect(orientationDeterminant(a, b, c)).toBe(expected);
  });
});
