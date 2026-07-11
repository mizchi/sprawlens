import { describe, expect, it } from "vitest";
import type { AtlasEdge, AtlasNode } from "@sprawlens/schema";
import { stableNeighborhoodUpdate } from "@sprawlens/layout";
import {
  leafGraphKey,
  neighborSiteHint,
  nodeInsertionHint,
  updateLeafLayout,
  summarizeLeafUpdateStrategies,
} from "./incrementalLayout.ts";

const edges: AtlasEdge[] = [
  { source: "new", target: "a" },
  { source: "b", target: "new" },
  { source: "new", target: "missing" },
  { source: "new", target: "new" },
  { source: "x", target: "y" },
];

const siteOf = (id: string) =>
  id === "a" ? { x: 10, y: 20 } : id === "b" ? { x: 30, y: 40 } : undefined;

describe("neighborSiteHint", () => {
  it("averages previous sites of dependency neighbors", () => {
    expect(neighborSiteHint("new", edges, siteOf)).toEqual({ x: 20, y: 30 });
  });

  it("returns undefined when no neighbor has a previous site", () => {
    expect(neighborSiteHint("orphan", edges, siteOf)).toBeUndefined();
  });
});

describe("nodeInsertionHint", () => {
  it("prefers the node's own previous site", () => {
    expect(nodeInsertionHint("a", edges, siteOf)).toEqual({ x: 10, y: 20 });
  });

  it("falls back to dependency-neighbor sites for new nodes", () => {
    expect(nodeInsertionHint("new", edges, siteOf)).toEqual({ x: 20, y: 30 });
  });
});

describe("updateLeafLayout", () => {
  const clip = { kind: "rect" as const, x: 0, y: 0, width: 800, height: 600 };
  const leaves = (count: number): AtlasNode[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `n${index}`,
      kind: "file" as const,
      label: `n${index}`,
      metrics: { loc: 20 + (index % 3) * 10 },
    }));
  const chain = (count: number): AtlasEdge[] =>
    Array.from({ length: count - 1 }, (_, index) => ({
      source: `n${index}`,
      target: `n${index + 1}`,
    }));

  it("uses the constrained stable-neighborhood update for a bounded changed group", () => {
    const beforeLeaves = leaves(7);
    const graphEdges = chain(7);
    const before = stableNeighborhoodUpdate(
      beforeLeaves.map((leaf) => ({ id: leaf.id, weight: leaf.metrics.loc })),
      graphEdges,
      clip,
      { seed: 7, anchorMixes: [0], maxSteps: 800 },
    );
    const afterLeaves = beforeLeaves.map((leaf, index) =>
      index === 0 ? { ...leaf, metrics: { loc: 90 } } : leaf,
    );

    const result = updateLeafLayout(before.state, afterLeaves, graphEdges, clip, {
      seed: 7,
      stableNeighborhood: { maxNodes: 16, anchorMixes: [0, 0.5, 1], maxSteps: 800 },
    });

    expect(result.strategy).toBe("stableNeighborhood");
    if (result.strategy !== "stableNeighborhood") throw new Error("expected stable update");
    expect(result.result.selected.adjacency + 1e-12).toBeGreaterThanOrEqual(
      result.result.baseline.adjacency,
    );
    expect(result.result.selected.displacement).toBeLessThanOrEqual(
      result.result.baseline.displacement + 1e-12,
    );
    expect(result.state.maxRelativeError).toBeLessThan(0.01);
  });

  it("falls back to the animated warm update above the stable node budget", () => {
    const graphLeaves = leaves(7);
    const graphEdges = chain(7);
    const before = stableNeighborhoodUpdate(
      graphLeaves.map((leaf) => ({ id: leaf.id, weight: leaf.metrics.loc })),
      graphEdges,
      clip,
      { seed: 7, anchorMixes: [0], maxSteps: 800 },
    );

    const result = updateLeafLayout(before.state, graphLeaves, graphEdges, clip, {
      seed: 7,
      stableNeighborhood: { maxNodes: 4 },
    });

    expect(result.strategy).toBe("warm");
  });

  it("falls back when the bounded stable solver cannot converge", () => {
    const graphLeaves = leaves(7);
    const graphEdges = chain(7);
    const before = stableNeighborhoodUpdate(
      graphLeaves.map((leaf) => ({ id: leaf.id, weight: leaf.metrics.loc })),
      graphEdges,
      clip,
      { seed: 7, anchorMixes: [0], maxSteps: 800 },
    );

    const result = updateLeafLayout(before.state, graphLeaves, graphEdges, clip, {
      seed: 7,
      stableNeighborhood: { maxNodes: 16, maxSteps: 0 },
    });

    expect(result.strategy).toBe("warm");
  });
});

describe("leafGraphKey", () => {
  it("is order-independent and changes with layout-relevant node or edge data", () => {
    const graphLeaves = [
      { id: "a", kind: "file" as const, label: "a", metrics: { loc: 10 } },
      { id: "b", kind: "file" as const, label: "b", metrics: { loc: 20 } },
    ];
    const graphEdges = [{ source: "a", target: "b", weight: 2 }];

    expect(leafGraphKey(graphLeaves, graphEdges)).toBe(
      leafGraphKey([...graphLeaves].reverse(), [...graphEdges].reverse()),
    );
    expect(
      leafGraphKey([{ ...graphLeaves[0]!, metrics: { loc: 11 } }, graphLeaves[1]!], graphEdges),
    ).not.toBe(leafGraphKey(graphLeaves, graphEdges));
    expect(leafGraphKey(graphLeaves, [])).not.toBe(leafGraphKey(graphLeaves, graphEdges));
  });
});

describe("summarizeLeafUpdateStrategies", () => {
  it("counts cold, warm, and stable group updates independently", () => {
    expect(summarizeLeafUpdateStrategies(["cold", "warm", "stableNeighborhood", "warm"])).toEqual({
      cold: 1,
      warm: 2,
      stableNeighborhood: 1,
    });
  });
});
