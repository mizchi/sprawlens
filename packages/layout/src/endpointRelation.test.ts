import { describe, expect, it } from "vitest";
import {
  buildControlledEndpointPermutationProbe,
  compareControlledInputEndpoints,
  type ControlledEndpointPermutationVariant,
} from "./endpointRelation.ts";
import type { LayoutSequenceGraph } from "./sequenceBenchmark.ts";

const graph: LayoutSequenceGraph = {
  nodes: [
    { id: "a", weight: 1, hint: { x: 2, y: 3 } },
    { id: "b", weight: 2 },
    { id: "c", weight: 3 },
  ],
  edges: [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
  ],
};

const applicable = (
  variant: ControlledEndpointPermutationVariant,
): Extract<ControlledEndpointPermutationVariant, { status: "applicable" }> => {
  expect(variant.status).toBe("applicable");
  if (variant.status !== "applicable") throw new Error("expected applicable permutation probe");
  return variant;
};

describe("controlled endpoint relations", () => {
  it("separates serialized equality from order-insensitive labeled equality", () => {
    const probe = buildControlledEndpointPermutationProbe(graph);
    const nodeOrder = applicable(probe.nodeOrder);
    const edgeOrder = applicable(probe.edgeOrder);

    expect(compareControlledInputEndpoints("serialized-equal", graph, nodeOrder.graph).status).toBe(
      "different",
    );
    expect(
      compareControlledInputEndpoints("labeled-graph-equal", graph, nodeOrder.graph).status,
    ).toBe("equivalent");
    expect(compareControlledInputEndpoints("serialized-equal", graph, edgeOrder.graph).status).toBe(
      "different",
    );
    expect(
      compareControlledInputEndpoints("labeled-graph-equal", graph, edgeOrder.graph).status,
    ).toBe("equivalent");
  });

  it("requires an explicit total ID bijection for rename equivalence", () => {
    const renamed = buildControlledEndpointPermutationProbe(graph).stableIdRename;
    expect(renamed.status).toBe("applicable");
    if (renamed.status !== "applicable") throw new Error("expected applicable rename probe");

    expect(
      compareControlledInputEndpoints("labeled-graph-equal", graph, renamed.graph).status,
    ).toBe("different");
    expect(compareControlledInputEndpoints("rename-equivalent", graph, renamed.graph).status).toBe(
      "unsupported",
    );
    expect(
      compareControlledInputEndpoints("rename-equivalent", graph, renamed.graph, {
        idBijection: renamed.idBijection,
      }).status,
    ).toBe("equivalent");
    expect(
      compareControlledInputEndpoints("isomorphic", graph, renamed.graph, {
        idBijection: renamed.idBijection,
      }).status,
    ).toBe("equivalent");
    expect(() =>
      compareControlledInputEndpoints("rename-equivalent", graph, renamed.graph, {
        idBijection: renamed.idBijection.slice(1),
      }),
    ).toThrow(/total bijection/);
  });

  it("fails closed for relations absent from the current graph schema", () => {
    expect(compareControlledInputEndpoints("hierarchy-equivalent", graph, graph)).toEqual({
      relation: "hierarchy-equivalent",
      status: "unsupported",
      reason: "LayoutSequenceGraph v1 does not represent hierarchy",
    });
    expect(compareControlledInputEndpoints("isomorphic", graph, graph).status).toBe("unsupported");
  });

  it("marks order probes inapplicable instead of manufacturing a change", () => {
    const probe = buildControlledEndpointPermutationProbe({
      nodes: [{ id: "only", weight: 1 }],
      edges: [],
    });

    expect(probe.nodeOrder.status).toBe("inapplicable");
    expect(probe.edgeOrder.status).toBe("inapplicable");
    expect(probe.hierarchySerialization.status).toBe("unsupported");
  });

  it("rejects ambiguous labeled graph domains", () => {
    expect(() =>
      buildControlledEndpointPermutationProbe({
        nodes: [
          { id: "duplicate", weight: 1 },
          { id: "duplicate", weight: 2 },
        ],
        edges: [],
      }),
    ).toThrow(/node IDs must be unique/);
    expect(() =>
      buildControlledEndpointPermutationProbe({
        nodes: graph.nodes,
        edges: [
          { source: "a", target: "b" },
          { source: "a", target: "b" },
        ],
      }),
    ).toThrow(/directed edges must be unique/);
  });
});
