import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { signedTwiceArea } from "./polygon.ts";

type Point = { x: number; y: number };

type Fixture = {
  schemaVersion: 1;
  cases: Array<{ name: string; vertices: Point[]; expectedTwiceArea: number }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/polygon-signed-area.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

describe("Lean/TypeScript polygon signed-area conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("area: $name", ({ vertices, expectedTwiceArea }) => {
    expect(signedTwiceArea(vertices)).toBe(expectedTwiceArea);
  });
});
