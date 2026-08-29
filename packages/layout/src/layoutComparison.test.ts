import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import {
  compareLayoutGeometry,
  constraintGraphDistance,
  distanceChangeFaithfulness,
  type ComparableCell,
} from "./layoutComparison.ts";

const square = (id: string, x: number, y: number): ComparableCell => ({
  id,
  site: { x: x + 0.5, y: y + 0.5 },
  polygon: [
    { x, y },
    { x: x + 1, y },
    { x: x + 1, y: y + 1 },
    { x, y: y + 1 },
  ],
});

describe("independent temporal layout metrics", () => {
  it("returns zero change for identical geometry", () => {
    const cells = [square("a", 0, 0), square("b", 2, 0)];

    expect(compareLayoutGeometry(cells, cells, 10)).toEqual({
      centroidDisplacement: 0,
      boundaryDisplacement: 0,
      polygonIoULoss: 0,
      relativeDirectionChange: 0,
    });
  });

  it("separates common translation from relative-direction change", () => {
    const before = [square("a", 0, 0), square("b", 2, 0), square("removed", 4, 0)];
    const after = [square("a", 1, 1), square("b", 3, 1), square("added", 5, 1)];
    const result = compareLayoutGeometry(before, after, 10);

    expect(result.centroidDisplacement).toBeCloseTo(Math.SQRT2 / 10, 12);
    expect(result.boundaryDisplacement).toBeGreaterThan(0);
    expect(result.polygonIoULoss).toBe(1);
    expect(result.relativeDirectionChange).toBeCloseTo(0, 12);
  });

  it("reports a full relative-direction reversal", () => {
    const before = [square("a", 0, 0), square("b", 2, 0)];
    const after = [square("a", 2, 0), square("b", 0, 0)];

    expect(compareLayoutGeometry(before, after, 10).relativeDirectionChange).toBeCloseTo(1, 12);
  });
});

describe("distance change faithfulness", () => {
  const path: AtlasEdge[] = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
  ];
  const triangle = [...path, { source: "a", target: "c" }];
  const pointCell = (id: string, x: number, y: number) => square(id, x - 0.5, y - 0.5);
  const before = [pointCell("a", -1, 0), pointCell("b", 0, Math.sqrt(3)), pointCell("c", 1, 0)];

  it("returns zero when graph-distance and geometric-distance changes agree", () => {
    const after = [
      pointCell("a", -0.5, 0),
      pointCell("b", 0, Math.sqrt(3.75)),
      pointCell("c", 0.5, 0),
    ];

    expect(distanceChangeFaithfulness(before, after, path, triangle)).toEqual({
      distanceChangeFaithfulnessError: 0,
      distanceChangePairCount: 3,
    });
  });

  it("penalizes a structural change hidden by unchanged geometry", () => {
    const result = distanceChangeFaithfulness(before, before, path, triangle);

    expect(result.distanceChangeFaithfulnessError).toBeCloseTo(1 / 6, 12);
    expect(result.distanceChangePairCount).toBe(3);
  });
});

describe("constraint graph distance", () => {
  const edges: AtlasEdge[] = [
    { source: "a", target: "c" },
    { source: "a", target: "d" },
    { source: "missing", target: "a" },
    { source: "a", target: "a" },
  ];
  const adjacency = new Map([
    ["a", new Set(["b"])],
    ["b", new Set(["a", "c"])],
    ["c", new Set(["b"])],
    ["d", new Set<string>()],
  ]);

  it("distinguishes near misses from disconnected constraints", () => {
    expect(constraintGraphDistance(adjacency, edges)).toEqual({
      constraintPathMedian: 3,
      constraintPathMax: 4,
      constraintDisconnectedRate: 0.5,
      constraintEdgeCount: 2,
    });
  });

  it("returns zeros for a vacuous constraint set", () => {
    expect(constraintGraphDistance(adjacency, [])).toEqual({
      constraintPathMedian: 0,
      constraintPathMax: 0,
      constraintDisconnectedRate: 0,
      constraintEdgeCount: 0,
    });
  });
});
