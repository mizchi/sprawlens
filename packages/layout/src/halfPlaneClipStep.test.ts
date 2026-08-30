import { describe, expect, it } from "vitest";
import { classifyHalfPlaneEdge, emitHalfPlaneClipStep } from "./halfPlaneClipStep.ts";

describe("classifyHalfPlaneEdge", () => {
  it.each([
    [-2, -1, "inside"],
    [-2, 3, "leaving"],
    [3, -2, "entering"],
    [3, 2, "outside"],
    [0, 0, "inside"],
    [0, 3, "leaving"],
    [3, 0, "entering"],
    [-2, 0, "inside"],
  ] as const)("classifies (%s, %s) as %s", (current, next, expected) => {
    expect(classifyHalfPlaneEdge(current, next)).toBe(expected);
  });
});

describe("emitHalfPlaneClipStep", () => {
  it.each([
    [-2, -1, [-2]],
    [-2, 3, [-2, 0]],
    [3, -2, [0]],
    [3, 2, []],
    [0, 0, [0]],
    [0, 3, [0]],
    [3, 0, [0]],
    [-2, 0, [-2]],
  ] as const)("emits normalized points for (%s, %s)", (current, next, expectedX) => {
    const output = emitHalfPlaneClipStep(
      { x: current, y: 1 },
      { x: next, y: 1 },
      current,
      next,
    );
    expect(output.map((point) => point.x)).toEqual(expectedX);
    expect(output.every((point) => point.x <= 0)).toBe(true);
    expect(output.length).toBeLessThanOrEqual(2);
    expect(new Set(output.map((point) => `${point.x},${point.y}`)).size).toBe(output.length);
  });
});
