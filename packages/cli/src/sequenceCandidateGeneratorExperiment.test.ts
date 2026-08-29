import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/schema";
import { createStableVoronoiCandidateGenerator } from "@sprawlens/layout";
import { runSequenceCandidateGeneratorExperiment } from "./sequenceCandidateGeneratorExperiment.ts";

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
  { nodes: nodes([5, 2, 3, 2, 4, 2]), edges: chain(6) },
];

describe("sequence candidate-generator experiment", () => {
  it("pairs the internal candidate set with a Stable VT augmented portfolio", () => {
    const result = runSequenceCandidateGeneratorExperiment(
      [{ repository: "example/repo", sequences: [{ name: "main", snapshots }] }],
      { seeds: [3] },
    );

    expect(result.generator.id).toBe("stable-vt-algorithm8-power-reimplementation");
    expect(result.summary.repositories).toBe(1);
    expect(result.summary.evaluatedTransitions).toBe(2);
    expect(result.summary.adjacencyFloorViolations).toBe(0);
    expect(result.repositories[0]!.meanAddedCandidates).toBe(1);
    expect(result.repositories[0]!.selectedAddedGeneratorRate).toBeGreaterThanOrEqual(0);
    expect(result.repositories[0]!.selectedAddedGeneratorRate).toBeLessThanOrEqual(1);
    expect(Number.isFinite(result.repositories[0]!.addedGeneratorDisplacementPenalty)).toBe(true);
    expect(
      result.repositories[0]!.eligibleAddedGeneratorDisplacementWinRate,
    ).toBeGreaterThanOrEqual(0);
  });

  it("rejects empty seeds and duplicate repositories", () => {
    expect(() => runSequenceCandidateGeneratorExperiment([], { seeds: [] })).toThrow("seeds");
    const duplicate = { repository: "same/repo", sequences: [{ name: "main", snapshots }] };
    expect(() =>
      runSequenceCandidateGeneratorExperiment([duplicate, duplicate], { seeds: [3] }),
    ).toThrow("duplicate repository");
  });

  it("accepts a separately versioned candidate generator", () => {
    const result = runSequenceCandidateGeneratorExperiment(
      [{ repository: "example/repo", sequences: [{ name: "main", snapshots }] }],
      {
        seeds: [3],
        generator: createStableVoronoiCandidateGenerator({
          hilbertVariant: "algorithm-6-fixed",
        }),
      },
    );

    expect(result.generator.id).toBe("stable-vt-algorithm6-power-reimplementation");
  });
});
