import { describe, expect, it } from "vitest";
import type { LayoutSequenceGraph } from "@sprawlens/layout";
import {
  meanBySequenceThenRepository,
  runControlledSequenceExperiment,
} from "./controlledSequenceExperiment.ts";

const graph = (prefix: string): LayoutSequenceGraph => ({
  nodes: Array.from({ length: 6 }, (_, index) => ({ id: `${prefix}${index}`, weight: index + 1 })),
  edges: Array.from({ length: 5 }, (_, index) => ({
    source: `${prefix}${index}`,
    target: `${prefix}${index + 1}`,
  })),
});

describe("controlled sequence experiment", () => {
  it("averages seeds within each sequence before the repository mean", () => {
    const samples = [
      { sequence: "short", value: 10 },
      { sequence: "long", value: 0 },
      { sequence: "long", value: 2 },
    ];

    expect(meanBySequenceThenRepository(samples, (sample) => sample.value)).toBe(5.5);
  });

  it("aggregates probe metrics with repositories as the outer unit", () => {
    const result = runControlledSequenceExperiment(
      [
        { repository: "a/repo", sequences: [{ name: "a", snapshots: [graph("a")] }] },
        { repository: "b/repo", sequences: [{ name: "b", snapshots: [graph("b")] }] },
      ],
      { seeds: [3] },
    );

    expect(result.schemaVersion).toBe(5);
    expect(result.summary.repositories).toBe(2);
    expect(result.summary.probes).toBe(2);
    expect(result.summary.floorViolations).toBe(0);
    expect(result.summary.recovery.combined.stableNeighborhood.boundaryDisplacement.n).toBe(2);
    expect(result.summary.recovery.noOp.stableNeighborhood.boundaryDisplacement.mean).toBeCloseTo(
      0,
      12,
    );
    expect(result.summary.pathDependence.neighborhoodSwap.boundaryDisplacement.mean).toBeCloseTo(
      0,
      12,
    );
    expect(result.repositories[0]?.probes[0]?.result.repeatability).not.toBeNull();
    expect(result.summary.developmentReliability.noiseFloor.neighborhoodSwap.mean).toBeCloseTo(
      0,
      12,
    );
    expect(
      result.summary.developmentReliability.commutatorExcess.neighborhoodSwap.mean,
    ).toBeCloseTo(0, 12);
    expect(result.summary.developmentReliability.loopExcess.noOp.neighborhoodSwap.mean).toBeCloseTo(
      0,
      12,
    );
    expect(result.repositories[0]?.means?.confirmatoryReliability.discrepancy).toBe(
      "exact-polygon-boundary-hausdorff",
    );
    expect(
      result.repositories[0]?.means?.confirmatoryReliability.noiseFloor.neighborhoodSwap.lowerBound,
    ).toBeLessThanOrEqual(
      result.repositories[0]?.means?.confirmatoryReliability.noiseFloor.neighborhoodSwap
        .upperBound ?? -1,
    );
    expect(
      result.summary.confirmatoryReliability.commutatorExcess.neighborhoodSwap.lowerBound.mean,
    ).toBeLessThanOrEqual(
      result.summary.confirmatoryReliability.commutatorExcess.neighborhoodSwap.upperBound.mean,
    );
    expect(
      result.summary.confirmatoryReliability.loopExcess.combined.neighborhoodSwap.lowerBound.mean,
    ).toBeLessThanOrEqual(
      result.summary.confirmatoryReliability.loopExcess.combined.neighborhoodSwap.upperBound.mean,
    );
  });

  it("records structurally ineligible inputs instead of replacing them", () => {
    const tiny: LayoutSequenceGraph = {
      nodes: [
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
      ],
      edges: [{ source: "a", target: "b" }],
    };
    const result = runControlledSequenceExperiment(
      [{ repository: "tiny/repo", sequences: [{ name: "tiny", snapshots: [tiny] }] }],
      { seeds: [3] },
    );

    expect(result.summary.repositories).toBe(0);
    expect(result.summary.excludedRepositories).toBe(1);
    expect(result.repositories[0]?.exclusions).toHaveLength(1);
  });

  it("aggregates adaptive intervals separately as development calibration", () => {
    const result = runControlledSequenceExperiment(
      [{ repository: "a/repo", sequences: [{ name: "a", snapshots: [graph("a")] }] }],
      { seeds: [3], adaptiveBoundaryHausdorffTargetWidth: 0.02 },
    );

    const calibration = result.summary.developmentAdaptiveReliability;
    expect(calibration?.targetAdditiveErrorBound).toBe(0.02);
    expect(calibration?.workload.intervalComparisons).toBe(55);
    expect(calibration?.workload.totalActualSampleCount).toBeGreaterThan(0);
    expect(calibration?.workload.minimumSubdivisionsPerEdge).toBeGreaterThan(0);
    expect(calibration?.workload.maximumSubdivisionsPerEdge).toBeGreaterThanOrEqual(
      calibration?.workload.minimumSubdivisionsPerEdge ?? Infinity,
    );
    expect(calibration?.commutatorExcess.neighborhoodSwap.lowerBound.mean).toBeLessThanOrEqual(
      calibration?.commutatorExcess.neighborhoodSwap.upperBound.mean ?? -1,
    );
    expect(
      result.repositories[0]?.means?.developmentAdaptiveReliability?.noiseFloor.neighborhoodSwap
        .lowerBound,
    ).toBeLessThanOrEqual(
      result.repositories[0]?.means?.developmentAdaptiveReliability?.noiseFloor.neighborhoodSwap
        .upperBound ?? -1,
    );
  });
});
