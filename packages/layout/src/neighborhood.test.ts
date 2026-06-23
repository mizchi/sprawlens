import { describe, expect, it } from "vitest";
import { cellAdjacency, greedySwapAssignment, realizedEdgeRate } from "./neighborhood.ts";
import { computePowerDiagram } from "./powerDiagram.ts";

const unitSquare = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe("cellAdjacency", () => {
  it("links cells that share a bisector edge", () => {
    const cells = computePowerDiagram(
      [
        { id: "a", x: 0.2, y: 0.5, weight: 0 },
        { id: "b", x: 0.5, y: 0.5, weight: 0 },
        { id: "c", x: 0.8, y: 0.5, weight: 0 },
      ],
      unitSquare,
    ).map((c) => ({
      id: c.id,
      site: { x: 0, y: 0 },
      polygon: c.polygon,
      edges: c.edges,
      targetArea: 0,
      actualArea: c.area,
    }));
    const adjacency = cellAdjacency(cells);
    expect(adjacency.get("a")!.has("b")).toBe(true);
    expect(adjacency.get("b")!.has("a")).toBe(true);
    expect(adjacency.get("b")!.has("c")).toBe(true);
    expect(adjacency.get("a")!.has("c")).toBe(false);
  });
});

describe("realizedEdgeRate", () => {
  const adjacency = new Map([
    ["a", new Set(["b"])],
    ["b", new Set(["a", "c"])],
    ["c", new Set(["b"])],
  ]);

  it("counts the fraction of edges realized as adjacencies", () => {
    expect(
      realizedEdgeRate(adjacency, [
        { source: "a", target: "b" },
        { source: "a", target: "c" },
      ]),
    ).toBe(0.5);
  });

  it("ignores edges with endpoints outside the map and self loops", () => {
    expect(
      realizedEdgeRate(adjacency, [
        { source: "a", target: "zz" },
        { source: "b", target: "b" },
        { source: "b", target: "c" },
      ]),
    ).toBe(1);
  });

  it("returns 1 when no eligible edges exist", () => {
    expect(realizedEdgeRate(adjacency, [])).toBe(1);
  });
});

describe("greedySwapAssignment", () => {
  // slots form a path: 0-1-2-3
  const pathAdjacency = [new Set([1]), new Set([0, 2]), new Set([1, 3]), new Set([2])];

  it("untangles a scrambled chain to realize every edge", () => {
    const nodes = ["a", "b", "c", "d"];
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
    ];
    // a→0, b→2, c→1, d→3 realizes only b-c
    const improved = greedySwapAssignment([0, 2, 1, 3], nodes, pathAdjacency, edges);
    const slotOf = new Map(nodes.map((id, i) => [id, improved[i]!]));
    for (const edge of edges) {
      expect(pathAdjacency[slotOf.get(edge.source)!]!.has(slotOf.get(edge.target)!)).toBe(true);
    }
  });

  it("keeps an already-perfect assignment unchanged", () => {
    const nodes = ["a", "b", "c", "d"];
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    expect(greedySwapAssignment([0, 1, 2, 3], nodes, pathAdjacency, edges)).toEqual([0, 1, 2, 3]);
  });

  it("never decreases the realized rate", () => {
    // ring of 6 slots
    const ring = Array.from({ length: 6 }, (_, i) => new Set([(i + 5) % 6, (i + 1) % 6]));
    const nodes = ["a", "b", "c", "d", "e", "f"];
    const edges = [
      { source: "a", target: "c" },
      { source: "c", target: "e" },
      { source: "e", target: "a" },
      { source: "b", target: "d" },
    ];
    const initial = [0, 1, 2, 3, 4, 5];
    const rateOf = (assign: number[]) => {
      const adjacency = new Map(
        nodes.map((id, i) => [
          id,
          new Set(nodes.filter((_, j) => ring[assign[i]!]!.has(assign[j]!))),
        ]),
      );
      return realizedEdgeRate(adjacency, edges);
    };
    const improved = greedySwapAssignment(initial, nodes, ring, edges);
    expect(rateOf(improved)).toBeGreaterThanOrEqual(rateOf(initial));
    // still a permutation
    expect([...improved].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
