import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import {
  approximateBoundaryHausdorff,
  approximateBoundaryHausdorffByEdge,
  approximateBoundaryHausdorffWithinTolerance,
} from "./boundaryHausdorff.ts";
import {
  compareLayoutGeometry,
  compareSameEndpointBoundaryHausdorffAdaptiveInterval,
  compareSameEndpointBoundaryHausdorffInterval,
  constraintGraphDistance,
  distanceChangeFaithfulness,
  requireSameEndpointGeometryDomain,
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

const transformCells = (
  cells: readonly ComparableCell[],
  transform: (point: { x: number; y: number }) => { x: number; y: number },
): ComparableCell[] =>
  cells.map((cell) => ({
    ...cell,
    site: transform(cell.site),
    polygon: cell.polygon.map(transform),
  }));

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

describe("same-endpoint confirmatory domain", () => {
  it("returns stable-ID-sorted pairs for the same nonempty cell set", () => {
    const before = [square("b", 2, 0), square("a", 0, 0)];
    const after = [square("a", 1, 0), square("b", 3, 0)];

    expect(requireSameEndpointGeometryDomain(before, after).map((pair) => pair.before.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("rejects a changed stable-cell set", () => {
    expect(() =>
      requireSameEndpointGeometryDomain([square("a", 0, 0)], [square("b", 0, 0)]),
    ).toThrow(/stable-cell ID sets differ/);
  });

  it("rejects empty boundaries and duplicate stable IDs", () => {
    expect(() => requireSameEndpointGeometryDomain([], [])).toThrow(/at least one stable cell/);
    expect(() =>
      requireSameEndpointGeometryDomain(
        [{ ...square("a", 0, 0), polygon: [] }],
        [square("a", 0, 0)],
      ),
    ).toThrow(/nonempty polygon boundaries/);
    expect(() =>
      requireSameEndpointGeometryDomain(
        [square("a", 0, 0), square("a", 1, 0)],
        [square("a", 0, 0)],
      ),
    ).toThrow(/duplicate stable-cell ID/);
  });
});

describe("same-endpoint boundary Hausdorff interval", () => {
  it("contains the exact zero distance for identical geometry", () => {
    const cells = [square("a", 0, 0)];

    expect(compareSameEndpointBoundaryHausdorffInterval(cells, cells, 1)).toEqual({
      estimator: "edge-local-polygon-boundary-sampling",
      subdivisionsPerEdge: 8,
      cellCount: 1,
      estimate: 0,
      additiveErrorBound: 0.125,
      lowerBound: 0,
      upperBound: 0.125,
      unit: "fraction-of-max-clip-extent",
    });
  });

  it("normalizes a known translated-square interval by the clip extent", () => {
    const interval = compareSameEndpointBoundaryHausdorffInterval(
      [square("a", 0, 0)],
      [square("a", 1, 0)],
      2,
    );

    expect(interval.lowerBound).toBeCloseTo(0.5, 12);
    expect(interval.upperBound).toBeCloseTo(0.5625, 12);
  });

  it("rejects a non-positive normalization scale", () => {
    const cells = [square("a", 0, 0)];
    expect(() => compareSameEndpointBoundaryHausdorffInterval(cells, cells, 0)).toThrow(
      /positive finite normalization scale/,
    );
  });

  it("is invariant under a common rigid transform", () => {
    const before = [square("a", 0, 0), square("b", 2, 0)];
    const after = [square("a", 1, 0), square("b", 2, 1)];
    const rotateThenTranslate = ({ x, y }: { x: number; y: number }) => ({
      x: 10 - y,
      y: -4 + x,
    });

    const original = compareSameEndpointBoundaryHausdorffInterval(before, after, 4);
    const transformed = compareSameEndpointBoundaryHausdorffInterval(
      transformCells(before, rotateThenTranslate),
      transformCells(after, rotateThenTranslate),
      4,
    );

    expect(transformed).toEqual(original);
  });

  it("is invariant when geometry and normalization scale are uniformly scaled", () => {
    const before = [square("a", 0, 0), square("b", 2, 0)];
    const after = [square("a", 1, 0), square("b", 2, 1)];
    const uniformScale = ({ x, y }: { x: number; y: number }) => ({ x: 3 * x, y: 3 * y });

    const original = compareSameEndpointBoundaryHausdorffInterval(before, after, 4);
    const scaled = compareSameEndpointBoundaryHausdorffInterval(
      transformCells(before, uniformScale),
      transformCells(after, uniformScale),
      12,
    );

    expect(scaled.estimate).toBeCloseTo(original.estimate, 12);
    expect(scaled.additiveErrorBound).toBeCloseTo(original.additiveErrorBound, 12);
    expect(scaled.lowerBound).toBeCloseTo(original.lowerBound, 12);
    expect(scaled.upperBound).toBeCloseTo(original.upperBound, 12);
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
  const subdividedSquare = unitSquare.flatMap((start, index) => {
    const end = unitSquare[(index + 1) % unitSquare.length]!;
    return [start, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }];
  });

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

  it("separates exact boundary equivalence from fixed-resolution interval identity", () => {
    const original = approximateBoundaryHausdorffByEdge(unitSquare, unitSquare, 8);
    const subdivided = approximateBoundaryHausdorffByEdge(subdividedSquare, subdividedSquare, 8);

    expect(original.status).toBe("ok");
    expect(subdivided.status).toBe("ok");
    if (original.status !== "ok" || subdivided.status !== "ok") return;
    expect(original.estimate).toBe(0);
    expect(subdivided.estimate).toBe(0);
    expect(subdivided.additiveErrorBound).toBe(original.additiveErrorBound / 2);
  });

  it("preserves the absolute interval under a common rigid transform", () => {
    const translated = unitSquare.map(({ x, y }) => ({ x: x + 0.4, y }));
    const rigid = ({ x, y }: { x: number; y: number }) => ({ x: 7 - y, y: -3 + x });
    const original = approximateBoundaryHausdorffByEdge(unitSquare, translated, 8);
    const transformed = approximateBoundaryHausdorffByEdge(
      unitSquare.map(rigid),
      translated.map(rigid),
      8,
    );

    expect(original.status).toBe("ok");
    expect(transformed.status).toBe("ok");
    if (original.status !== "ok" || transformed.status !== "ok") return;
    expect(transformed.estimate).toBeCloseTo(original.estimate, 12);
    expect(transformed.additiveErrorBound).toBeCloseTo(original.additiveErrorBound, 12);
  });

  it("scales the absolute interval by the common uniform factor", () => {
    const translated = unitSquare.map(({ x, y }) => ({ x: x + 0.4, y }));
    const factor = 3;
    const scalePoint = ({ x, y }: { x: number; y: number }) => ({
      x: factor * x,
      y: factor * y,
    });
    const original = approximateBoundaryHausdorffByEdge(unitSquare, translated, 8);
    const scaled = approximateBoundaryHausdorffByEdge(
      unitSquare.map(scalePoint),
      translated.map(scalePoint),
      8,
    );

    expect(original.status).toBe("ok");
    expect(scaled.status).toBe("ok");
    if (original.status !== "ok" || scaled.status !== "ok") return;
    expect(scaled.estimate).toBeCloseTo(factor * original.estimate, 12);
    expect(scaled.additiveErrorBound).toBeCloseTo(factor * original.additiveErrorBound, 12);
  });

  it("rejects invalid subdivisions per edge", () => {
    expect(() => approximateBoundaryHausdorffByEdge(unitSquare, unitSquare, 0)).toThrow(RangeError);
    expect(() => approximateBoundaryHausdorffByEdge(unitSquare, unitSquare, 2.5)).toThrow(
      RangeError,
    );
  });
});

describe("tolerance-driven boundary Hausdorff approximation", () => {
  const unitSquare = square("a", 0, 0).polygon;
  const subdividedSquare = unitSquare.flatMap((start, index) => {
    const end = unitSquare[(index + 1) % unitSquare.length]!;
    return [start, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }];
  });

  it("selects the smallest edge subdivision count meeting the tolerance", () => {
    expect(approximateBoundaryHausdorffWithinTolerance(unitSquare, unitSquare, 0.3)).toEqual({
      status: "ok",
      estimate: 0,
      additiveErrorBound: 0.25,
      targetAdditiveErrorBound: 0.3,
      subdivisionsPerEdge: 4,
      actualSampleCount: 40,
    });
  });

  it("fails closed when the required resolution exceeds the declared budget", () => {
    expect(approximateBoundaryHausdorffWithinTolerance(unitSquare, unitSquare, 0.1, 5)).toEqual({
      status: "resolution-budget-exceeded",
      targetAdditiveErrorBound: 0.1,
      requiredSubdivisionsPerEdge: 10,
      maxSubdivisionsPerEdge: 5,
    });
  });

  it("preserves the declared width across equivalent redundant vertex representations", () => {
    const original = approximateBoundaryHausdorffWithinTolerance(unitSquare, unitSquare, 0.1);
    const subdivided = approximateBoundaryHausdorffWithinTolerance(
      subdividedSquare,
      subdividedSquare,
      0.1,
    );

    expect(original.status).toBe("ok");
    expect(subdivided.status).toBe("ok");
    if (original.status !== "ok" || subdivided.status !== "ok") return;
    expect(original.estimate).toBe(0);
    expect(subdivided.estimate).toBe(0);
    expect(original.additiveErrorBound).toBeLessThanOrEqual(0.1);
    expect(subdivided.additiveErrorBound).toBeLessThanOrEqual(0.1);
    expect(original.subdivisionsPerEdge).toBe(10);
    expect(subdivided.subdivisionsPerEdge).toBe(5);
  });

  it("rejects invalid tolerance and resolution budgets", () => {
    expect(() => approximateBoundaryHausdorffWithinTolerance(unitSquare, unitSquare, 0)).toThrow(
      /positive finite additive error tolerance/,
    );
    expect(() =>
      approximateBoundaryHausdorffWithinTolerance(unitSquare, unitSquare, 0.1, 1.5),
    ).toThrow(/positive safe integer/);
    expect(() =>
      approximateBoundaryHausdorffWithinTolerance(unitSquare, unitSquare, Number.MIN_VALUE),
    ).toThrow(/safe integer domain/);
  });
});

describe("adaptive same-endpoint boundary Hausdorff interval", () => {
  it("meets a normalized interval-width target across stable cells", () => {
    const interval = compareSameEndpointBoundaryHausdorffAdaptiveInterval(
      [square("a", 0, 0), square("b", 2, 0)],
      [square("a", 1, 0), square("b", 3, 0)],
      2,
      0.05,
    );

    expect(interval.lowerBound).toBeCloseTo(0.5, 12);
    expect(interval.additiveErrorBound).toBeCloseTo(0.05, 12);
    expect(interval.upperBound - interval.lowerBound).toBeLessThanOrEqual(0.05 + 1e-12);
    expect(interval.targetAdditiveErrorBound).toBe(0.05);
    expect(interval.minimumSubdivisionsPerEdge).toBe(10);
    expect(interval.maximumSubdivisionsPerEdge).toBe(10);
  });

  it("rejects a target that cannot be met within the resolution budget", () => {
    expect(() =>
      compareSameEndpointBoundaryHausdorffAdaptiveInterval(
        [square("a", 0, 0)],
        [square("a", 0, 0)],
        1,
        0.01,
        10,
      ),
    ).toThrow(/resolution budget exceeded/);
  });

  it("preserves normalized tolerance and resolution under uniform scaling", () => {
    const before = [square("a", 0, 0), square("b", 2, 0)];
    const after = [square("a", 1, 0), square("b", 2, 1)];
    const uniformScale = ({ x, y }: { x: number; y: number }) => ({ x: 4 * x, y: 4 * y });

    const original = compareSameEndpointBoundaryHausdorffAdaptiveInterval(before, after, 4, 0.05);
    const scaled = compareSameEndpointBoundaryHausdorffAdaptiveInterval(
      transformCells(before, uniformScale),
      transformCells(after, uniformScale),
      16,
      0.05,
    );

    expect(scaled.minimumSubdivisionsPerEdge).toBe(original.minimumSubdivisionsPerEdge);
    expect(scaled.maximumSubdivisionsPerEdge).toBe(original.maximumSubdivisionsPerEdge);
    expect(scaled.actualSampleCount).toBe(original.actualSampleCount);
    expect(scaled.estimate).toBeCloseTo(original.estimate, 12);
    expect(scaled.additiveErrorBound).toBeCloseTo(original.additiveErrorBound, 12);
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
