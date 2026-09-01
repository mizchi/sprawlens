import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import { buildControlledSequenceProbe, runControlledSequenceProbe } from "./controlledSequence.ts";
import type { LayoutSequenceGraph } from "./sequenceBenchmark.ts";

const graph: LayoutSequenceGraph = {
  nodes: Array.from({ length: 11 }, (_, index) => ({
    id: `n${index}`,
    weight: 1 + ((index * 7) % 5),
  })),
  edges: Array.from({ length: 10 }, (_, index) => ({
    source: `n${index}`,
    target: `n${index + 1}`,
  })) as AtlasEdge[],
};

describe("controlled sequence probes", () => {
  it("builds no-op, isolated, combined, and commuting-edit probes with equal endpoints", () => {
    const probe = buildControlledSequenceProbe(graph);

    expect(probe.noOp[0]).toEqual(probe.noOp.at(-1));
    expect(probe.weightReversal[0]).toEqual(probe.weightReversal.at(-1));
    expect(probe.rewireReversal[0]).toEqual(probe.rewireReversal.at(-1));
    expect(probe.combinedReversal[0]).toEqual(probe.combinedReversal.at(-1));
    expect(probe.orderAB[0]).toEqual(probe.orderBA[0]);
    expect(probe.orderAB.at(-1)).toEqual(probe.orderBA.at(-1));
    expect(probe.orderAB[1]).not.toEqual(probe.orderBA[1]);
  });

  it("measures hysteresis and path dependence without treating natural change as drift", () => {
    const result = runControlledSequenceProbe(buildControlledSequenceProbe(graph), { seed: 7 });

    expect(result.schemaVersion).toBe(3);
    expect(result.recovery.noOp.stableNeighborhood.boundaryDisplacement).toBeCloseTo(0, 12);
    expect(result.recovery.weight.stableNeighborhood.boundaryDisplacement).toBeGreaterThanOrEqual(
      0,
    );
    expect(result.recovery.rewire.stableNeighborhood.boundaryDisplacement).toBeGreaterThanOrEqual(
      0,
    );
    expect(result.recovery.combined.stableNeighborhood.boundaryDisplacement).toBeGreaterThanOrEqual(
      0,
    );
    expect(result.pathDependence.stableNeighborhood.boundaryDisplacement).toBeGreaterThanOrEqual(0);
    expect(result.recovery.combined.neighborhoodSwap.boundaryDisplacement).toBeCloseTo(0, 12);
    expect(result.pathDependence.neighborhoodSwap.boundaryDisplacement).toBeCloseTo(0, 12);
    expect(result.floorViolations).toBe(0);
  });

  it("captures independent same-path rerun defects when requested", () => {
    const result = runControlledSequenceProbe(buildControlledSequenceProbe(graph), {
      seed: 7,
      captureRepeatability: true,
    });

    expect(result.repeatability).not.toBeNull();
    expect(result.repeatability?.orderAB.neighborhoodSwap.boundaryDisplacement).toBeCloseTo(0, 12);
    expect(
      result.repeatability?.orderBA.stableNeighborhood.boundaryDisplacement,
    ).toBeGreaterThanOrEqual(0);
  });

  it("can select a path-independent deterministic history-free reference", () => {
    const probe = buildControlledSequenceProbe(graph);
    const defaultPolicy = runControlledSequenceProbe(probe, { seed: 7 });
    const canonicalPolicy = runControlledSequenceProbe(probe, {
      seed: 7,
      stableHistoryFreeReferenceWeight: 1_000_000,
    });

    expect(
      canonicalPolicy.recovery.combined.stableNeighborhood.boundaryDisplacement,
    ).toBeLessThanOrEqual(
      defaultPolicy.recovery.combined.stableNeighborhood.boundaryDisplacement + 1e-12,
    );
    expect(
      canonicalPolicy.pathDependence.stableNeighborhood.boundaryDisplacement,
    ).toBeLessThanOrEqual(
      defaultPolicy.pathDependence.stableNeighborhood.boundaryDisplacement + 1e-12,
    );
    expect(canonicalPolicy.recovery.combined.stableNeighborhood.boundaryDisplacement).toBeCloseTo(
      0,
      10,
    );
    expect(canonicalPolicy.pathDependence.stableNeighborhood.boundaryDisplacement).toBeCloseTo(
      0,
      10,
    );
  });

  it("rejects graphs too small to construct an independent rewire", () => {
    expect(() =>
      buildControlledSequenceProbe({
        nodes: graph.nodes.slice(0, 2),
        edges: graph.edges.slice(0, 1),
      }),
    ).toThrow(/at least three nodes/);
  });
});
