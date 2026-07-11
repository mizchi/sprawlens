import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import type { CellInputNode } from "./capacityLayout.ts";
import { stableNeighborhoodUpdate } from "./stableNeighborhood.ts";

const clip = { kind: "rect" as const, x: 0, y: 0, width: 1000, height: 700 };

const nodes = (count: number): CellInputNode[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `n${index}`,
    weight: 1 + (index % 3),
  }));

const chain = (count: number): AtlasEdge[] =>
  Array.from({ length: count - 1 }, (_, index) => ({
    source: `n${index}`,
    target: `n${index + 1}`,
  }));

describe("stable neighborhood update", () => {
  it("preserves the best NPVT adjacency while minimizing temporal displacement", () => {
    const before = stableNeighborhoodUpdate(nodes(9), chain(9), clip, { seed: 7 });
    const anchors = new Map(before.state.cells.map((cell) => [cell.id, cell.site] as const));
    const afterNodes = [
      ...nodes(9).map((node) => (node.id === "n0" ? { ...node, weight: 8 } : node)),
      { id: "bridge", weight: 2 },
    ];
    const afterEdges = [
      ...chain(9).filter((edge) => !(edge.source === "n3" && edge.target === "n4")),
      { source: "n3", target: "bridge" },
      { source: "bridge", target: "n4" },
    ];

    const result = stableNeighborhoodUpdate(afterNodes, afterEdges, clip, {
      seed: 7,
      anchors,
      adjacencyTolerance: 0,
    });

    expect(result.candidates.map((candidate) => candidate.anchorMix)).toEqual([
      0, 0.25, 0.5, 0.75, 1,
    ]);
    expect(result.weightedSolves).toBeGreaterThanOrEqual(1);
    expect(result.weightedSolves).toBeLessThanOrEqual(result.candidates.length);
    expect(result.eligibleCandidates).toBeGreaterThanOrEqual(1);
    expect(result.eligibleCandidates).toBeLessThanOrEqual(result.candidates.length);
    expect(result.selected.adjacency + 1e-12).toBeGreaterThanOrEqual(result.baseline.adjacency);
    expect(result.selected.displacement).toBeLessThanOrEqual(result.baseline.displacement + 1e-12);
    expect(result.state.maxRelativeError).toBeLessThan(0.01);
    expect(result.selected.converged).toBe(true);
  });

  it("is deterministic for a fixed seed and anchors", () => {
    const base = stableNeighborhoodUpdate(nodes(6), chain(6), clip, { seed: 11 });
    const anchors = new Map(base.state.cells.map((cell) => [cell.id, cell.site] as const));
    const run = () => stableNeighborhoodUpdate(nodes(6), chain(6), clip, { seed: 11, anchors });

    expect(run().state.cells.map((cell) => cell.site)).toEqual(
      run().state.cells.map((cell) => cell.site),
    );
    expect(run().weightedSolves).toBe(run().weightedSolves);
  });

  it("rejects anchor mixes outside the baseline-to-anchor interval", () => {
    expect(() =>
      stableNeighborhoodUpdate(nodes(6), chain(6), clip, {
        seed: 3,
        anchorMixes: [0, 1.1],
      }),
    ).toThrow("between 0 and 1");
  });

  it("keeps the full-swap NPVT baseline while generating bounded-swap variants", () => {
    const before = stableNeighborhoodUpdate(nodes(6), chain(6), clip, {
      seed: 5,
      anchorMixes: [0],
    });
    const anchors = new Map(before.state.cells.map((cell) => [cell.id, cell.site] as const));

    const result = stableNeighborhoodUpdate(nodes(6), chain(6), clip, {
      seed: 5,
      anchors,
      anchorMixes: [0, 1],
      swapPasses: [0, 1, 8],
    });

    expect(
      result.candidates.map((candidate) => [candidate.anchorMix, candidate.swapPasses]),
    ).toEqual([
      [0, 8],
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 8],
    ]);
    expect(result.baseline).toBe(result.candidates[0]);
    expect(result.selected.adjacency + 1e-12).toBeGreaterThanOrEqual(result.baseline.adjacency);
    expect(result.selected.displacement).toBeLessThanOrEqual(result.baseline.displacement + 1e-12);
  });
});
