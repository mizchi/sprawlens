import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import type { CellInputNode } from "./capacityLayout.ts";
import {
  computeMatchedNeighborhoodUpdate,
  stableNeighborhoodUpdate,
} from "./stableNeighborhood.ts";

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

describe("compute-matched current-only neighborhood update", () => {
  it("matches the requested unique weighted-solve budget and retains the NPVT baseline", () => {
    const before = stableNeighborhoodUpdate(nodes(9), chain(9), clip, { seed: 17 });
    const anchors = new Map(before.state.cells.map((cell) => [cell.id, cell.site] as const));
    const input = nodes(9).map((node, index) => ({
      ...node,
      weight: node.weight + (index % 2 === 0 ? 2 : 0),
    }));
    const baseline = stableNeighborhoodUpdate(input, chain(9), clip, {
      seed: 17,
      anchors,
      anchorMixes: [0],
    });

    const result = computeMatchedNeighborhoodUpdate(input, chain(9), clip, {
      seed: 17,
      anchors,
      weightedSolveBudget: 4,
    });

    expect(result.weightedSolves).toBe(4);
    expect(result.budgetMatched).toBe(true);
    expect(result.candidates).toHaveLength(4);
    expect(result.baseline.state.cells.map((cell) => cell.site)).toEqual(
      baseline.baseline.state.cells.map((cell) => cell.site),
    );
    expect(result.selected.adjacency + 1e-12).toBeGreaterThanOrEqual(result.baseline.adjacency);
    expect(result.selected.displacement).toBeLessThanOrEqual(result.baseline.displacement + 1e-12);
  });

  it("keeps candidate generation independent of anchor coordinates", () => {
    const input = nodes(8).map((node, index) => ({ ...node, weight: node.weight + index / 5 }));
    const leftAnchors = new Map(
      input.map((node, index) => [node.id, { x: 40 + index * 3, y: 70 + index * 5 }] as const),
    );
    const rightAnchors = new Map(
      input.map((node, index) => [node.id, { x: 940 - index * 7, y: 620 - index * 2 }] as const),
    );
    const run = (anchors: ReadonlyMap<string, { x: number; y: number }>) =>
      computeMatchedNeighborhoodUpdate(input, chain(8), clip, {
        seed: 23,
        anchors,
        weightedSolveBudget: 3,
      });

    const left = run(leftAnchors);
    const right = run(rightAnchors);

    expect(left.budgetMatched).toBe(true);
    expect(right.budgetMatched).toBe(true);
    expect(
      left.candidates.map((candidate) =>
        candidate.state.cells.map((cell) => [cell.id, cell.site.x, cell.site.y]),
      ),
    ).toEqual(
      right.candidates.map((candidate) =>
        candidate.state.cells.map((cell) => [cell.id, cell.site.x, cell.site.y]),
      ),
    );
  });

  it("validates the weighted-solve budget", () => {
    expect(() =>
      computeMatchedNeighborhoodUpdate(nodes(6), chain(6), clip, {
        seed: 3,
        weightedSolveBudget: 0,
      }),
    ).toThrow("positive integer");
  });

  it("reports an explicit shortfall instead of silently claiming a matched budget", () => {
    const result = computeMatchedNeighborhoodUpdate(nodes(6), chain(6), clip, {
      seed: 3,
      weightedSolveBudget: 2,
      maxVariants: 1,
    });

    expect(result.weightedSolves).toBe(1);
    expect(result.requestedWeightedSolves).toBe(2);
    expect(result.budgetMatched).toBe(false);
  });
});
