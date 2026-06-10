import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "../contracts/graph.js";
import { capacityStep, isConverged, type ClipRegion } from "./capacityLayout.js";
import { createGraphLayout } from "./pipeline.js";

const rectClip: ClipRegion = { kind: "rect", x: 0, y: 0, width: 1, height: 1 };

function sampleGraph(): AtlasGraph {
  const nodes = Array.from({ length: 12 }, (_, i) => ({
    id: `f${i}`,
    kind: "file" as const,
    label: `f${i}.ts`,
    metrics: { loc: 10 + i * 25 },
  }));
  const edges = [
    { source: "f0", target: "f1" },
    { source: "f1", target: "f2" },
    { source: "f2", target: "f3" },
    { source: "f8", target: "f9" },
    { source: "f9", target: "f10" },
  ];
  return { nodes, edges };
}

describe("createGraphLayout", () => {
  it("produces a capacity layout whose targets follow LOC weights", () => {
    const graph = sampleGraph();
    const state = createGraphLayout(graph, rectClip, { seed: 3 });
    const cells = new Map(state.cells.map((c) => [c.id, c]));
    const totalLoc = graph.nodes.reduce((s, n) => s + n.metrics.loc, 0);
    for (const node of graph.nodes) {
      const cell = cells.get(node.id)!;
      expect(cell.targetArea).toBeCloseTo(node.metrics.loc / totalLoc, 10);
    }
  });

  it("converges when stepped", () => {
    let state = createGraphLayout(sampleGraph(), rectClip, { seed: 4 });
    let iterations = 0;
    while (!isConverged(state, 0.02) && iterations < 300) {
      state = capacityStep(state);
      iterations++;
    }
    expect(state.maxRelativeError).toBeLessThan(0.02);
  });

  it("places dependency-linked nodes in adjacent or nearby cells", () => {
    const state = createGraphLayout(sampleGraph(), rectClip, {
      seed: 5,
    });
    const cells = new Map(state.cells.map((c) => [c.id, c]));
    // f0..f3 form a chain; their sites should sit closer to each other than
    // the average pairwise distance.
    const chain = ["f0", "f1", "f2", "f3"];
    let chainSum = 0;
    for (let i = 0; i < chain.length - 1; i++) {
      const a = cells.get(chain[i]!)!.site;
      const b = cells.get(chain[i + 1]!)!.site;
      chainSum += Math.hypot(a.x - b.x, a.y - b.y);
    }
    const chainMean = chainSum / (chain.length - 1);

    const ids = [...cells.keys()];
    let allSum = 0;
    let allCount = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = cells.get(ids[i]!)!.site;
        const b = cells.get(ids[j]!)!.site;
        allSum += Math.hypot(a.x - b.x, a.y - b.y);
        allCount++;
      }
    }
    expect(chainMean).toBeLessThan(allSum / allCount);
  });

  it("is deterministic", () => {
    const a = createGraphLayout(sampleGraph(), rectClip, { seed: 9 });
    const b = createGraphLayout(sampleGraph(), rectClip, { seed: 9 });
    expect(a.cells.map((c) => c.site)).toEqual(b.cells.map((c) => c.site));
  });
});
