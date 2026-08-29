import { describe, expect, it } from "vitest";
import type { LayoutGraphSequence } from "@sprawlens/layout";
import { runSequenceCandidateBudgetExperiment } from "./sequenceCandidateBudgetExperiment.ts";

const nodes = (weights: readonly number[]) =>
  weights.map((weight, index) => ({ id: `n${index}`, weight }));
const chain = (count: number) =>
  Array.from({ length: count - 1 }, (_, index) => ({
    source: `n${index}`,
    target: `n${index + 1}`,
  }));

const sequence: LayoutGraphSequence = {
  name: "weight-then-structure",
  snapshots: [
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
  ],
};

describe("sequence candidate-budget experiment", () => {
  it("pairs a full rollout with endpoint-only non-structural exploration", () => {
    const result = runSequenceCandidateBudgetExperiment(
      [{ repository: "fixture/repository", sequences: [sequence] }],
      { seeds: [7] },
    );

    expect(result.schemaVersion).toBe(1);
    expect(result.profile).toEqual({
      structural: [0, 0.25, 0.5, 0.75, 1],
      nonStructural: [0, 1],
    });
    expect(result.summary.repositories).toBe(1);
    expect(result.summary.sequences).toBe(1);
    expect(result.summary.transitions).toBe(2);
    expect(result.summary.evaluatedTransitions).toBe(2);
    expect(result.repositories[0]!.candidateCountReduction).toBe(1.5);
    expect(result.repositories[0]!.fullCandidateCount).toBe(5);
    expect(result.repositories[0]!.adaptiveCandidateCount).toBe(3.5);
    expect(result.repositories[0]!.candidateCountReductionRate).toBe(0.3);
    expect(result.repositories[0]!.evaluatedNonStructuralTransitions).toBe(1);
    expect(result.repositories[0]!.evaluatedStructuralTransitions).toBe(1);
    expect(result.repositories[0]!.floorViolations).toBe(0);
    expect(result.summary.candidateCountReduction.mean).toBe(1.5);
  });

  it("rejects duplicate repositories and empty seeds", () => {
    const dataset = { repository: "fixture/repository", sequences: [sequence] };
    expect(() => runSequenceCandidateBudgetExperiment([dataset], { seeds: [] })).toThrow(
      "at least one seed",
    );
    expect(() => runSequenceCandidateBudgetExperiment([dataset, dataset], { seeds: [3] })).toThrow(
      "duplicate repository",
    );
  });
});
