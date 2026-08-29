import { describe, expect, it } from "vitest";
import { buildExternalCommonSequenceProbe } from "./externalCommonSequence.ts";

const graph = {
  nodes: [
    { id: "b", weight: 2 },
    { id: "a", weight: 4 },
    { id: "c", weight: 1 },
  ],
  edges: [{ source: "a", target: "b" }],
};

describe("external-common controlled sequence", () => {
  it("builds commuting weight and leaf-insertion paths with byte-equivalent endpoints", () => {
    const probe = buildExternalCommonSequenceProbe(graph);

    expect(probe.weightReversal[1].nodes.find(({ id }) => id === "a")?.weight).toBe(6);
    expect(probe.leafInsertionReversal[1].nodes.at(-1)).toEqual({
      id: "__sprawlens_inserted_leaf__",
      weight: 2,
    });
    expect(probe.leafInsertionReversal[2]).toEqual(probe.leafInsertionReversal[0]);
    expect(probe.orderAB[2]).toEqual(probe.orderBA[2]);
    expect(JSON.stringify(probe.orderAB[2])).toBe(JSON.stringify(probe.orderBA[2]));
  });

  it("chooses a collision-free inserted identity", () => {
    const probe = buildExternalCommonSequenceProbe({
      ...graph,
      nodes: [...graph.nodes, { id: "__sprawlens_inserted_leaf__", weight: 1 }],
    });

    expect(probe.orderAB[2].nodes.at(-1)?.id).toBe("__sprawlens_inserted_leaf__-2");
  });
});
