import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import { runStableNeighborhoodSequence, type LayoutSequenceGraph } from "./sequenceBenchmark.ts";

const nodes = (weights: readonly number[]) =>
  weights.map((weight, index) => ({ id: `n${index}`, weight }));
const chain = (count: number): AtlasEdge[] =>
  Array.from({ length: count - 1 }, (_, index) => ({
    source: `n${index}`,
    target: `n${index + 1}`,
  }));

const sequence: LayoutSequenceGraph[] = [
  { nodes: nodes([1, 2, 3, 2, 1, 2]), edges: chain(6) },
  { nodes: nodes([5, 2, 3, 2, 1, 2]), edges: chain(6) },
  {
    nodes: [...nodes([5, 2, 3, 2, 1, 2]), { id: "bridge", weight: 2 }],
    edges: [
      ...chain(6).filter((edge) => edge.source !== "n2" || edge.target !== "n3"),
      { source: "n2", target: "bridge" },
      { source: "bridge", target: "n3" },
    ],
  },
];

describe("stateful stable-neighborhood sequence", () => {
  it("branches from one initial layout and carries each condition's own state", () => {
    const result = runStableNeighborhoodSequence(sequence, { seed: 7 });

    expect(result.schemaVersion).toBe(3);
    expect(result.transitions).toHaveLength(2);
    expect(result.initialCellSites.neighborhoodSwap).toEqual(
      result.initialCellSites.computeMatchedNeighborhood,
    );
    expect(result.initialCellSites.neighborhoodSwap).toEqual(
      result.initialCellSites.stableNeighborhood,
    );
    expect(result.initialCellSites.neighborhoodSwap).toEqual(result.initialCellSites.warmStart);
    expect(result.initialCellSites.neighborhoodSwap).toEqual(result.initialCellSites.anchorOnly);
    expect(result.budget.matchedTransitions).toBe(2);
    expect(result.budget.shortfallTransitions).toBe(0);
    for (const transition of result.transitions) {
      expect(transition.conditions.stableNeighborhood.adjacency + 1e-12).toBeGreaterThanOrEqual(
        transition.baselineAdjacency,
      );
      expect(transition.computeMatchedSelection.weightedSolves).toBe(
        transition.stableSelection.weightedSolves,
      );
      expect(transition.warmStartSelection.steps).toBeGreaterThanOrEqual(0);
      expect(transition.anchorOnlySelection.weightedSolves).toBeGreaterThan(0);
      expect(transition.conditions.stableNeighborhood.boundaryDisplacement).toBeGreaterThanOrEqual(
        0,
      );
      expect(transition.conditions.stableNeighborhood.distanceChangePairCount).toBeGreaterThan(0);
    }
  });

  it("makes cumulative path cost equal the sum of transition costs", () => {
    const result = runStableNeighborhoodSequence(sequence, { seed: 11 });
    for (const condition of [
      "neighborhoodSwap",
      "computeMatchedNeighborhood",
      "warmStart",
      "anchorOnly",
      "stableNeighborhood",
    ] as const) {
      const expected = result.transitions.reduce(
        (sum, transition) => sum + transition.conditions[condition].centroidDisplacement,
        0,
      );
      expect(result.summary[condition].cumulative.centroidDisplacement).toBeCloseTo(expected, 12);
      const expectedAdjacency =
        result.transitions.reduce(
          (sum, transition) => sum + transition.conditions[condition].adjacency,
          0,
        ) / result.transitions.length;
      expect(result.summary[condition].meanAdjacency).toBeCloseTo(expectedAdjacency, 12);
      expect(result.summary[condition].mean.distanceChangeFaithfulnessError).toBeGreaterThanOrEqual(
        0,
      );
    }
  });

  it("is deterministic and rejects a non-sequence", () => {
    expect(runStableNeighborhoodSequence(sequence, { seed: 17 })).toEqual(
      runStableNeighborhoodSequence(sequence, { seed: 17 }),
    );
    expect(() => runStableNeighborhoodSequence(sequence.slice(0, 1), { seed: 3 })).toThrow(
      "at least two snapshots",
    );
  });
});
