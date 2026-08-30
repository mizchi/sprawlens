import { describe, expect, it } from "vitest";
import { assessRingValidity } from "./externalPolygonValidity.ts";

describe("assessRingValidity", () => {
  it("accepts a simple counter-clockwise rectangle", () => {
    expect(
      assessRingValidity([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ]),
    ).toMatchObject({
      finite: true,
      hasMinimumVertices: true,
      counterClockwise: true,
      degenerate: false,
      nonConvex: false,
      duplicateVertex: false,
      zeroLengthEdge: false,
      selfIntersecting: false,
    });
  });

  it("detects a non-adjacent edge ending inside another edge", () => {
    const validity = assessRingValidity([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 2, y: 0 },
      { x: 0, y: 4 },
    ]);
    expect(validity.duplicateVertex).toBe(false);
    expect(validity.zeroLengthEdge).toBe(false);
    expect(validity.selfIntersecting).toBe(true);
  });
});
