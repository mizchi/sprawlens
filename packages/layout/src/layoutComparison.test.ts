import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import {
  approximateBoundaryHausdorff,
  approximateBoundaryHausdorffByEdge,
} from "./boundaryHausdorff.ts";
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

  it("characterizes the empty-boundary zero-distance counterexample", () => {
    const empty = [{ ...square("a", 0, 0), polygon: [] }];
    const nonempty = [square("a", 0, 0)];

    expect(compareLayoutGeometry(empty, nonempty, 1).boundaryDisplacement).toBe(0);
    expect(empty[0]!.polygon).not.toEqual(nonempty[0]!.polygon);
  });

  it("characterizes the sampled mean-nearest triangle counterexample", () => {
    const withBoundary = (polygon: ComparableCell["polygon"]): ComparableCell[] => [
      { id: "a", site: { x: 0, y: 0 }, polygon },
    ];
    const left = withBoundary([{ x: 0, y: 0 }]);
    const bridge = withBoundary([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]);
    const right = withBoundary([{ x: 2, y: 0 }]);
    const leftBridge = compareLayoutGeometry(left, bridge, 1).boundaryDisplacement;
    const bridgeRight = compareLayoutGeometry(bridge, right, 1).boundaryDisplacement;
    const leftRight = compareLayoutGeometry(left, right, 1).boundaryDisplacement;

    expect(leftBridge).toBeCloseTo(0.5, 12);
    expect(bridgeRight).toBeCloseTo(0.5, 12);
    expect(leftRight).toBeCloseTo(2, 12);
    expect(leftRight).toBeGreaterThan(leftBridge + bridgeRight);
  });
});

describe("certified boundary Hausdorff approximation", () => {
  const unitSquare = square("a", 0, 0).polygon;

  it("fails closed instead of assigning zero to an empty boundary", () => {
    expect(approximateBoundaryHausdorff([], unitSquare)).toEqual({
      status: "empty-boundary",
      sampleCount: 32,
    });
  });

  it("returns a zero estimate and an explicit sampling error bound for identity", () => {
    expect(approximateBoundaryHausdorff(unitSquare, unitSquare)).toEqual({
      status: "ok",
      estimate: 0,
      additiveErrorBound: 0.125,
      sampleCount: 32,
    });
  });

  it("is insensitive to seam, winding, and redundant edge subdivision", () => {
    const rotated = [...unitSquare.slice(2), ...unitSquare.slice(0, 2)];
    const reversed = [...unitSquare].reverse();
    const subdivided = [unitSquare[0]!, { x: 0.5, y: 0 }, ...unitSquare.slice(1)];

    expect(approximateBoundaryHausdorff(unitSquare, rotated)).toMatchObject({ estimate: 0 });
    expect(approximateBoundaryHausdorff(unitSquare, reversed)).toMatchObject({ estimate: 0 });
    expect(approximateBoundaryHausdorff(unitSquare, subdivided)).toMatchObject({ estimate: 0 });
  });

  it("halves the certified additive bound when the sample count doubles", () => {
    const coarse = approximateBoundaryHausdorff(unitSquare, unitSquare, 32);
    const fine = approximateBoundaryHausdorff(unitSquare, unitSquare, 64);

    expect(coarse.status).toBe("ok");
    expect(fine.status).toBe("ok");
    if (coarse.status !== "ok" || fine.status !== "ok") return;
    expect(fine.additiveErrorBound).toBeCloseTo(coarse.additiveErrorBound / 2, 12);
  });

  it("keeps the exact distance inside the interval for a tiny boundary", () => {
    const tinySegment = [
      { x: 0, y: 0 },
      { x: 1e-13, y: 0 },
    ];
    const approximation = approximateBoundaryHausdorff(tinySegment, [{ x: 0, y: 0 }]);

    expect(approximation.status).toBe("ok");
    if (approximation.status !== "ok") return;
    expect(approximation.estimate + approximation.additiveErrorBound).toBeGreaterThanOrEqual(1e-13);
  });

  it("rejects a non-positive or fractional sample count", () => {
    expect(() => approximateBoundaryHausdorff(unitSquare, unitSquare, 0)).toThrow(RangeError);
    expect(() => approximateBoundaryHausdorff(unitSquare, unitSquare, 1.5)).toThrow(RangeError);
  });
});

describe("edge-local certified boundary Hausdorff approximation", () => {
  const unitSquare = square("a", 0, 0).polygon;

  it("fails closed for an empty boundary", () => {
    expect(approximateBoundaryHausdorffByEdge([], unitSquare, 4)).toEqual({
      status: "empty-boundary",
      subdivisionsPerEdge: 4,
    });
  });

  it("reports the maximum-edge discretization bound and actual sample count", () => {
    expect(approximateBoundaryHausdorffByEdge(unitSquare, unitSquare, 4)).toEqual({
      status: "ok",
      estimate: 0,
      additiveErrorBound: 0.25,
      subdivisionsPerEdge: 4,
      actualSampleCount: 40,
    });
  });

  it("keeps a known segment-to-point distance inside the certified interval", () => {
    const segment = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const approximation = approximateBoundaryHausdorffByEdge(segment, [{ x: 0, y: 0 }], 3);

    expect(approximation.status).toBe("ok");
    if (approximation.status !== "ok") return;
    expect(approximation.estimate).toBe(1);
    expect(approximation.estimate).toBeLessThanOrEqual(1);
    expect(1).toBeLessThanOrEqual(approximation.estimate + approximation.additiveErrorBound);
  });

  it("rejects invalid subdivisions per edge", () => {
    expect(() => approximateBoundaryHausdorffByEdge(unitSquare, unitSquare, 0)).toThrow(RangeError);
    expect(() => approximateBoundaryHausdorffByEdge(unitSquare, unitSquare, 2.5)).toThrow(
      RangeError,
    );
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
