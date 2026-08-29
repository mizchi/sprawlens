import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/contracts";
import {
  deltaBenchmarkCasesFromGraphPairs,
  layoutSequencesFromGraphs,
  runDeltaLayoutBenchmark,
} from "./deltaBenchmark.ts";

describe("delta layout benchmark", () => {
  it("reports reproducible vanilla-vs-guided quality metrics", () => {
    const first = runDeltaLayoutBenchmark({ seeds: [3, 7, 11] });
    const second = runDeltaLayoutBenchmark({ seeds: [3, 7, 11] });

    expect(second).toEqual(first);
    expect(first.schemaVersion).toBe(9);
    expect(first.configuration.stableSwapPasses).toEqual([8]);
    expect(first.seeds).toEqual([3, 7, 11]);
    expect(first.statistics).toEqual({
      interval: "two-sided Student t 95%",
      unit: "paired scenario-seed trial",
      aggregate: "descriptive pooled trials",
    });
    expect(first.scenarios.map((scenario) => scenario.name)).toEqual([
      "weight-shift",
      "dependency-rewire",
      "bridge-insertion",
    ]);
    for (const scenario of first.scenarios) {
      expect(scenario.trials).toHaveLength(3);
      expect(Object.keys(scenario.trials[0]!.conditions)).toEqual([
        "squarified",
        "cold",
        "warm",
        "neighborhoodSwap",
        "stableNeighborhood",
        "computeMatchedNeighborhood",
        "adjacencyOnly",
        "stabilityOnly",
        "guided",
      ]);
      expect(scenario.summary.conditions.warm.maxAreaError.mean).toBeLessThan(0.03);
      expect(scenario.summary.conditions.guided.maxAreaError.mean).toBeLessThan(0.03);
      expect(scenario.summary.conditions.guided.objective.n).toBe(3);
      expect(scenario.summary.conditions.guided.centroidDisplacement.n).toBe(3);
      expect(scenario.summary.conditions.guided.boundaryDisplacement.n).toBe(3);
      expect(scenario.summary.conditions.guided.polygonIoULoss.n).toBe(3);
      expect(scenario.summary.conditions.guided.relativeDirectionChange.n).toBe(3);
      expect(scenario.summary.conditions.guided.distanceChangeFaithfulnessError.n).toBe(3);
      expect(scenario.summary.conditions.guided.constraintPathMedian.n).toBe(3);
      expect(scenario.summary.conditions.guided.constraintPathMax.n).toBe(3);
      expect(scenario.summary.conditions.guided.constraintDisconnectedRate.n).toBe(3);
      expect(scenario.summary.conditions.squarified.maxAreaError.mean).toBeLessThan(1e-9);
      expect(scenario.summary.conditions.guided.objective.ci95[0]).toBeLessThanOrEqual(
        scenario.summary.conditions.guided.objective.mean,
      );
      expect(scenario.summary.conditions.guided.objective.ci95[1]).toBeGreaterThanOrEqual(
        scenario.summary.conditions.guided.objective.mean,
      );
      expect(scenario.summary.failures).toEqual({
        cold: 0,
        warm: 0,
        squarified: 0,
        neighborhoodSwap: 0,
        stableNeighborhood: 0,
        computeMatchedNeighborhood: 0,
        adjacencyOnly: 0,
        stabilityOnly: 0,
        guided: 0,
      });
      expect(scenario.summary.computeMatchedBudget).toEqual({
        matchedTrials: 3,
        shortfallTrials: 0,
      });
      for (const trial of scenario.trials) {
        const baseline = trial.conditions.neighborhoodSwap;
        const stable = trial.conditions.stableNeighborhood;
        expect(stable.adjacency).toBeGreaterThanOrEqual(baseline.adjacency - 1e-12);
        expect(stable.displacement).toBeLessThanOrEqual(baseline.displacement + 1e-12);
        expect(trial.stableSelection.candidateCount).toBe(5);
        expect(trial.stableSelection.weightedSolves).toBeLessThanOrEqual(5);
        expect(trial.stableSelection.eligibleCandidates).toBeGreaterThanOrEqual(1);
        expect([0, 0.25, 0.5, 0.75, 1]).toContain(trial.stableSelection.anchorMix);
        expect(trial.stableSelection.baselineAdjacency).toBe(baseline.adjacency);
        expect(trial.computeMatchedSelection.requestedWeightedSolves).toBe(
          trial.stableSelection.weightedSolves,
        );
        expect(trial.computeMatchedSelection.weightedSolves).toBe(
          trial.stableSelection.weightedSolves,
        );
        expect(trial.computeMatchedSelection.budgetMatched).toBe(true);
        expect(
          trial.conditions.computeMatchedNeighborhood.adjacency + 1e-12,
        ).toBeGreaterThanOrEqual(baseline.adjacency);
        for (const condition of Object.values(trial.conditions)) {
          expect(condition.centroidDisplacement).toBeGreaterThanOrEqual(0);
          expect(condition.boundaryDisplacement).toBeGreaterThanOrEqual(0);
          expect(condition.polygonIoULoss).toBeGreaterThanOrEqual(0);
          expect(condition.polygonIoULoss).toBeLessThanOrEqual(1);
          expect(condition.relativeDirectionChange).toBeGreaterThanOrEqual(0);
          expect(condition.relativeDirectionChange).toBeLessThanOrEqual(1);
          expect(condition.distanceChangeFaithfulnessError).toBeGreaterThanOrEqual(0);
          expect(condition.constraintPathMedian).toBeGreaterThanOrEqual(0);
          expect(condition.constraintPathMax).toBeGreaterThanOrEqual(
            condition.constraintPathMedian,
          );
          expect(condition.constraintDisconnectedRate).toBeGreaterThanOrEqual(0);
          expect(condition.constraintDisconnectedRate).toBeLessThanOrEqual(1);
          expect(condition.constraintEdgeCount).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(first.aggregate.conditions.guided.objective.n).toBe(9);
    expect(first.aggregate.contrasts.guidedVsWarm.objectiveReduction.n).toBe(9);
    expect(first.aggregate.contrasts.guidedVsCold.displacementReduction.n).toBe(9);
    expect(first.aggregate.contrasts.guidedVsSquarified.adjacencyGain.n).toBe(9);
    expect(first.aggregate.contrasts.guidedVsNeighborhoodSwap.edgeLengthReduction.n).toBe(9);
    expect(
      first.aggregate.contrasts.stableNeighborhoodVsNeighborhoodSwap.displacementReduction.n,
    ).toBe(9);
    expect(
      first.aggregate.contrasts.stableNeighborhoodVsComputeMatched.displacementReduction.n,
    ).toBe(9);
    expect(first.aggregate.computeMatchedBudget).toEqual({ matchedTrials: 9, shortfallTrials: 0 });
    expect(
      first.aggregate.contrasts.stableNeighborhoodVsNeighborhoodSwap.polygonIoULossReduction.n,
    ).toBe(9);
    expect(
      first.aggregate.contrasts.stableNeighborhoodVsComputeMatched.relativeDirectionChangeReduction
        .n,
    ).toBe(9);
  });

  it("can explore bounded-swap assignment variants without replacing the NPVT baseline", () => {
    const result = runDeltaLayoutBenchmark({ seeds: [3], stableSwapPasses: [0, 1, 8] });
    const trials = result.scenarios.flatMap((scenario) => scenario.trials);

    expect(result.configuration.stableSwapPasses).toEqual([0, 1, 8]);
    expect(trials.every((trial) => trial.stableSelection.candidateCount === 15)).toBe(true);
    expect(trials.every((trial) => [0, 1, 8].includes(trial.stableSelection.swapPasses))).toBe(
      true,
    );
    expect(
      trials.every(
        (trial) =>
          trial.conditions.stableNeighborhood.adjacency + 1e-12 >=
          trial.conditions.neighborhoodSwap.adjacency,
      ),
    ).toBe(true);
  });

  it("turns repository graph pairs into bounded, changed module cases", () => {
    const node = (id: string, loc: number) => ({
      id,
      kind: "file" as const,
      label: id,
      metrics: { loc },
    });
    const before: AtlasGraph = {
      nodes: [node("a/1.ts", 3), node("a/2.ts", 4), node("b/1.ts", 2)],
      edges: [{ source: "a/1.ts", target: "a/2.ts" }],
    };
    const after: AtlasGraph = {
      nodes: [node("a/1.ts", 5), node("a/2.ts", 4), node("a/3.ts", 2), node("b/1.ts", 2)],
      edges: [
        { source: "a/1.ts", target: "a/2.ts" },
        { source: "a/3.ts", target: "a/2.ts" },
      ],
    };

    const cases = deltaBenchmarkCasesFromGraphPairs([{ name: "repo:c1..c2", before, after }], {
      groupOf: (id) => id.split("/")[0]!,
      minNodes: 2,
      maxNodes: 10,
    });

    expect(cases).toHaveLength(1);
    expect(cases[0]?.name).toBe("repo:c1..c2:a");
    expect(cases[0]?.before.nodes.map((entry) => entry.id)).toEqual(["a/1.ts", "a/2.ts"]);
    expect(cases[0]?.after.nodes.map((entry) => entry.id)).toEqual(["a/1.ts", "a/2.ts", "a/3.ts"]);
    expect(cases[0]?.changedIds).toEqual(new Set(["a/1.ts", "a/3.ts", "a/2.ts"]));
  });

  it("accepts graph-derived cases as the benchmark corpus", () => {
    const cases = deltaBenchmarkCasesFromGraphPairs(
      [
        {
          name: "tiny",
          before: {
            nodes: [
              { id: "a", kind: "file", label: "a", metrics: { loc: 1 } },
              { id: "b", kind: "file", label: "b", metrics: { loc: 1 } },
            ],
            edges: [{ source: "a", target: "b" }],
          },
          after: {
            nodes: [
              { id: "a", kind: "file", label: "a", metrics: { loc: 2 } },
              { id: "b", kind: "file", label: "b", metrics: { loc: 1 } },
            ],
            edges: [{ source: "a", target: "b" }],
          },
        },
      ],
      { groupOf: () => "all", minNodes: 2 },
    );
    const result = runDeltaLayoutBenchmark({ cases, seeds: [5] });

    expect(result.scenarios.map((scenario) => scenario.name)).toEqual(["tiny:all"]);
    expect(result.scenarios[0]?.trials[0]?.seed).toBe(5);
    expect(result.scenarios[0]?.trials[0]?.conditions.cold.converged).toBe(true);
    expect(result.scenarios[0]?.trials[0]?.conditions.neighborhoodSwap.converged).toBe(true);
    expect(result.scenarios[0]?.trials[0]?.conditions.stableNeighborhood.converged).toBe(true);
  });

  it("forms bounded contiguous graph sequences without dropping unchanged intermediate states", () => {
    const node = (id: string, loc: number) => ({
      id,
      kind: "file" as const,
      label: id,
      metrics: { loc },
    });
    const graphs: AtlasGraph[] = [1, 1, 4].map((loc) => ({
      nodes: [node("a/1.ts", loc), node("a/2.ts", 2), node("b/1.ts", 1)],
      edges: [{ source: "a/1.ts", target: "a/2.ts" }],
    }));

    const corpus = layoutSequencesFromGraphs(graphs, {
      groupOf: (id) => id.split("/")[0]!,
      minNodes: 2,
      maxNodes: 10,
      minSnapshots: 3,
    });

    expect(corpus.sequences).toHaveLength(1);
    expect(corpus.sequences[0]?.name).toBe("a:0..2");
    expect(corpus.sequences[0]?.snapshots).toHaveLength(3);
    expect(corpus.sequences[0]?.snapshots[1]?.nodes[0]?.weight).toBe(1);
    expect(corpus.selection).toEqual({
      minNodes: 2,
      maxNodes: 10,
      minSnapshots: 3,
      candidateGroups: 2,
      includedSequences: 1,
      includedSnapshots: 3,
      excludedUnchanged: 0,
      excludedShortRuns: 0,
    });
  });
});
