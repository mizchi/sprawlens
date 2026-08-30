import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appendDistinctPoints, removeCyclicDuplicate } from "./cyclicRingOutput.ts";

type Fixture = {
  schemaVersion: 1;
  cases: Array<{
    name: string;
    chunks: number[][];
    expectedOutput: number[];
    expectedClosedOutput: number[];
  }>;
};

const fixture = JSON.parse(
  readFileSync(new URL("../../../formal/TestVectors/half-plane-clip-fold.json", import.meta.url), "utf8"),
) as Fixture;

describe("Lean/TypeScript half-plane clip fold conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("fold: $name", ({ chunks, expectedOutput, expectedClosedOutput }) => {
    const output: Array<{ x: number; y: number }> = [];
    for (const chunk of chunks)
      appendDistinctPoints(
        output,
        chunk.map((distance) => ({ x: distance, y: 0 })),
      );
    expect(output.map((point) => point.x)).toEqual(expectedOutput);
    expect(output.every((point) => point.x <= 0)).toBe(true);
    removeCyclicDuplicate(output);
    expect(output.map((point) => point.x)).toEqual(expectedClosedOutput);
  });
});
