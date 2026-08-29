import { describe, expect, it } from "vitest";
import type { LayoutSequenceGraph } from "@sprawlens/layout";
import type { LoadedDataset } from "./deltaBenchmarkDataset.ts";
import { runRepositorySequenceBenchmarkBatch } from "./sequenceBenchmarkDataset.ts";

const graph = (weight: number): LayoutSequenceGraph => ({
  nodes: Array.from({ length: 6 }, (_, index) => ({
    id: `n${index}`,
    weight: index === 0 ? weight : 1 + (index % 2),
  })),
  edges: Array.from({ length: 5 }, (_, index) => ({
    source: `n${index}`,
    target: `n${index + 1}`,
  })),
});

const dataset = (repository: string): LoadedDataset =>
  ({
    repository,
    sequences: [
      {
        name: "module:0..5",
        snapshots: [1, 2, 3, 4, 5, 6].map(graph),
      },
    ],
  }) as LoadedDataset;

describe("repository sequence benchmark", () => {
  it("summarizes repository-equal sequence effects and the corpus gate", () => {
    const result = runRepositorySequenceBenchmarkBatch([dataset("a"), dataset("b")], {
      seeds: [3],
    });

    expect(result.schemaVersion).toBe(6);
    expect(result.summary.includedRepositories).toBe(2);
    expect(result.summary.sequences).toBe(2);
    expect(result.summary.transitions).toBe(10);
    expect(result.summary.longSequenceRepositories).toBe(2);
    expect(result.summary.goGateCorpusSatisfied).toBe(false);
    expect(
      result.summary.contrasts.stableVsComputeMatched.cumulative.centroidDisplacementReduction!.n,
    ).toBe(2);
    expect(
      result.summary.contrasts.stableVsComputeMatched.perTransition.centroidDisplacementReduction!
        .n,
    ).toBe(2);
    expect(
      result.summary.contrasts.stableVsComputeMatched.perTransition.centroidDisplacementReduction!
        .signs,
    ).toEqual({ positive: 0, zero: 2, negative: 0 });
    expect(
      result.summary.contrasts.stableVsWarmStart.perTransition.siteDisplacementReduction,
    ).toBeDefined();
    expect(
      result.summary.contrasts.stableVsAnchorOnly.initialToFinal.polygonIoULossReduction,
    ).toBeDefined();
    expect(result.summary.contrasts.stableVsWarmStart.structure.meanAdjacencyGain.n).toBe(2);
    expect(result.summary.contrasts.stableVsAnchorOnly.structure.finalAdjacencyGain.n).toBe(2);
    expect(
      result.summary.contrasts.stableVsComputeMatched.structure.constraintPathMedianReduction.n,
    ).toBe(2);
    expect(
      result.summary.contrasts.stableVsComputeMatched.perTransition.boundaryDisplacementReduction!
        .n,
    ).toBe(2);
    expect(
      result.summary.contrasts.stableVsComputeMatched.perTransition
        .distanceChangeFaithfulnessErrorReduction!.n,
    ).toBe(2);
    expect(
      result.summary.changeStrata.weightChange.stableVsComputeMatched.boundaryDisplacementReduction
        .n,
    ).toBe(2);
    expect(result.repositories.every((repository) => repository.budget.shortfallRuns === 0)).toBe(
      true,
    );
  });

  it("rejects an empty seed set", () => {
    expect(() => runRepositorySequenceBenchmarkBatch([dataset("a")], { seeds: [] })).toThrow(
      "at least one seed",
    );
  });
});
