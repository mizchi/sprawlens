import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSimpleOpenRing } from "./simpleRing.ts";

type Point = { x: number; y: number };

type Fixture = {
  schemaVersion: 1;
  cases: Array<{ name: string; vertices: Point[]; expected: boolean }>;
};

const fixture = JSON.parse(
  readFileSync(new URL("../../../formal/TestVectors/simple-open-ring.json", import.meta.url), "utf8"),
) as Fixture;

describe("Lean/TypeScript simple-open-ring conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("ring: $name", ({ vertices, expected }) => {
    expect(isSimpleOpenRing(vertices)).toBe(expected);
  });
});
