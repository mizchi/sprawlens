import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyHalfPlaneEdge,
  emitHalfPlaneClipStep,
  type HalfPlaneEdgeClass,
} from "./halfPlaneClipStep.ts";

type Fixture = {
  schemaVersion: 1;
  cases: Array<{
    name: string;
    currentDistance: number;
    nextDistance: number;
    expectedClass: HalfPlaneEdgeClass;
    expectedOutputDistances: number[];
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/half-plane-edge-classification.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

describe("Lean/TypeScript half-plane edge classification conformance", () => {
  it("uses the pinned schema", () => expect(fixture.schemaVersion).toBe(1));

  it.each(fixture.cases)("edge: $name", (testCase) => {
    expect(classifyHalfPlaneEdge(testCase.currentDistance, testCase.nextDistance)).toBe(
      testCase.expectedClass,
    );
    const output = emitHalfPlaneClipStep(
      { x: testCase.currentDistance, y: 0 },
      { x: testCase.nextDistance, y: 0 },
      testCase.currentDistance,
      testCase.nextDistance,
    );
    expect(output.map((point) => point.x)).toEqual(testCase.expectedOutputDistances);
  });
});
