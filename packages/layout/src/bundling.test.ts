import { describe, expect, it } from "vitest";
import { bundlePath, hierarchyControlPoints } from "./bundling.js";

// two modules with one file each, plus one extra file in m1
const parentOf = new Map<string, string | null>([
  ["m1", null],
  ["m2", null],
  ["a", "m1"],
  ["a2", "m1"],
  ["b", "m2"],
]);
const positionOf = new Map([
  ["m1", { x: 0, y: 0 }],
  ["m2", { x: 10, y: 0 }],
  ["a", { x: -1, y: 1 }],
  ["a2", { x: 1, y: -1 }],
  ["b", { x: 11, y: 1 }],
]);

describe("hierarchyControlPoints", () => {
  it("routes cross-module edges through both module centers", () => {
    const path = hierarchyControlPoints("a", "b", parentOf, positionOf);
    expect(path).toEqual([
      { x: -1, y: 1 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 11, y: 1 },
    ]);
  });

  it("routes intra-module edges through the shared module center", () => {
    const path = hierarchyControlPoints("a", "a2", parentOf, positionOf);
    expect(path).toEqual([
      { x: -1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: -1 },
    ]);
  });

  it("connects sibling roots directly", () => {
    const path = hierarchyControlPoints("m1", "m2", parentOf, positionOf);
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("returns null when an endpoint has no position", () => {
    expect(hierarchyControlPoints("a", "missing", parentOf, positionOf)).toBeNull();
  });
});

describe("bundlePath", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 2, y: 4 },
    { x: 8, y: 4 },
    { x: 10, y: 0 },
  ];

  it("keeps the original path at strength 1", () => {
    expect(bundlePath(path, 1)).toEqual(path);
  });

  it("straightens to the chord at strength 0", () => {
    const flat = bundlePath(path, 0);
    for (let i = 0; i < flat.length; i++) {
      const t = i / (flat.length - 1);
      expect(flat[i]!.x).toBeCloseTo(10 * t, 9);
      expect(flat[i]!.y).toBeCloseTo(0, 9);
    }
  });

  it("never moves the endpoints", () => {
    const bent = bundlePath(path, 0.5);
    expect(bent[0]).toEqual(path[0]);
    expect(bent[bent.length - 1]).toEqual(path[path.length - 1]);
  });

  it("interpolates interior points toward the chord", () => {
    const half = bundlePath(path, 0.5);
    expect(half[1]!.y).toBeCloseTo(2, 9);
    expect(half[2]!.y).toBeCloseTo(2, 9);
  });
});
