import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/schema";
import { runSequenceVectorConstraintExperiment } from "./sequenceVectorConstraintExperiment.ts";

const nodes = (weights: readonly number[]) =>
  weights.map((weight, index) => ({ id: `n${index}`, weight }));
const chain = (count: number): AtlasEdge[] =>
  Array.from({ length: count - 1 }, (_, index) => ({
    source: `n${index}`,
    target: `n${index + 1}`,
  }));

const snapshots = [
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

describe("sequence vector-constraint experiment", () => {
  it("pairs scalar and path-tail-protected rollouts", () => {
    const result = runSequenceVectorConstraintExperiment(
      [{ repository: "example/repo", sequences: [{ name: "main", snapshots }] }],
      { seeds: [3] },
    );

    expect(result.profile).toEqual(["constraintPathMax"]);
    expect(result.summary.repositories).toBe(1);
    expect(result.summary.evaluatedTransitions).toBe(2);
    expect(result.summary.topologyFloorViolations).toBe(0);
    expect(result.repositories[0]!.runs).toBe(1);
    expect(result.repositories[0]!.pathMaxReduction).toBeGreaterThanOrEqual(0);
  });

  it("rejects empty seeds and duplicate repositories", () => {
    expect(() => runSequenceVectorConstraintExperiment([], { seeds: [] })).toThrow("seeds");
    const duplicate = { repository: "same/repo", sequences: [{ name: "main", snapshots }] };
    expect(() =>
      runSequenceVectorConstraintExperiment([duplicate, duplicate], { seeds: [3] }),
    ).toThrow("duplicate repository");
  });
});
