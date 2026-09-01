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

    expect(result.schemaVersion).toBe(6);
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
    expect(result.transitions[0]!.change).toEqual(
      expect.objectContaining({ nodeChurn: false, weightChange: true, dependencyRewire: false }),
    );
    expect(result.transitions[1]!.change).toEqual(
      expect.objectContaining({ nodeChurn: true, dependencyRewire: true }),
    );
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

  it("applies a declarative candidate budget by graph-change class", () => {
    const result = runStableNeighborhoodSequence(sequence, {
      seed: 13,
      stableAnchorMixPolicy: {
        structural: [0, 0.25, 0.5, 0.75, 1],
        nonStructural: [0, 1],
      },
    });

    expect(result.transitions[0]!.change).toEqual(
      expect.objectContaining({ nodeChurn: false, dependencyRewire: false }),
    );
    expect(result.transitions[0]!.stableSelection.candidateCount).toBe(2);
    expect(result.transitions[1]!.change).toEqual(
      expect.objectContaining({ nodeChurn: true, dependencyRewire: true }),
    );
    expect(result.transitions[1]!.stableSelection.candidateCount).toBe(5);
    expect(result.configuration.stableAnchorMixPolicy).toEqual({
      structural: [0, 0.25, 0.5, 0.75, 1],
      nonStructural: [0, 1],
    });
  });

  it("carries a vector topology floor through a stateful rollout", () => {
    const result = runStableNeighborhoodSequence(sequence, {
      seed: 19,
      stableProtectedConstraints: ["constraintDisconnectedRate"],
    });

    expect(result.configuration.stableProtectedConstraints).toEqual(["constraintDisconnectedRate"]);
    expect(result.topologyFloorViolations).toBe(0);
    for (const transition of result.transitions) {
      expect(
        transition.conditions.stableNeighborhood.constraintDisconnectedRate,
      ).toBeLessThanOrEqual(transition.baselineConstraintDisconnectedRate + 1e-12);
    }
  });

  it("is deterministic and rejects a non-sequence", () => {
    expect(runStableNeighborhoodSequence(sequence, { seed: 17 })).toEqual(
      runStableNeighborhoodSequence(sequence, { seed: 17 }),
    );
    expect(() => runStableNeighborhoodSequence(sequence.slice(0, 1), { seed: 3 })).toThrow(
      "at least two snapshots",
    );
    expect(() =>
      runStableNeighborhoodSequence(sequence, {
        seed: 3,
        stableAnchorMixPolicy: { structural: [0.25, 1], nonStructural: [0, 1] },
      }),
    ).toThrow("structural anchor mixes must start with 0");
  });

  it("captures final geometry only when explicitly requested", () => {
    const compact = runStableNeighborhoodSequence(sequence, { seed: 23 });
    const captured = runStableNeighborhoodSequence(sequence, {
      seed: 23,
      captureFinalGeometry: true,
    });

    expect(compact.finalCellGeometry).toBeNull();
    expect(captured.finalCellGeometry?.stableNeighborhood).toHaveLength(7);
    expect(captured.finalCellGeometry?.stableNeighborhood[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), site: expect.any(Object) }),
    );
  });

  it("captures initial geometry only for endpoint-certified experiments", () => {
    const compact = runStableNeighborhoodSequence(sequence, { seed: 23 });
    const captured = runStableNeighborhoodSequence(sequence, {
      seed: 23,
      captureInitialGeometry: true,
    });

    expect(compact).not.toHaveProperty("initialCellGeometry");
    expect(captured.initialCellGeometry?.stableNeighborhood).toHaveLength(6);
    expect(captured.initialCellGeometry?.stableNeighborhood).toEqual(
      captured.initialCellGeometry?.neighborhoodSwap,
    );
  });
});
