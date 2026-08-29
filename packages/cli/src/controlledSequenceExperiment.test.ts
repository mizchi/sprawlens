import { describe, expect, it } from "vitest";
import type { LayoutSequenceGraph } from "@sprawlens/layout";
import { runControlledSequenceExperiment } from "./controlledSequenceExperiment.ts";

const graph = (prefix: string): LayoutSequenceGraph => ({
  nodes: Array.from({ length: 6 }, (_, index) => ({ id: `${prefix}${index}`, weight: index + 1 })),
  edges: Array.from({ length: 5 }, (_, index) => ({
    source: `${prefix}${index}`,
    target: `${prefix}${index + 1}`,
  })),
});

describe("controlled sequence experiment", () => {
  it("aggregates probe metrics with repositories as the outer unit", () => {
    const result = runControlledSequenceExperiment(
      [
        { repository: "a/repo", sequences: [{ name: "a", snapshots: [graph("a")] }] },
        { repository: "b/repo", sequences: [{ name: "b", snapshots: [graph("b")] }] },
      ],
      { seeds: [3] },
    );

    expect(result.schemaVersion).toBe(2);
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
});
