import { bench, describe } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import type { CellInputNode } from "./capacityLayout.ts";
import { stableNeighborhoodUpdate } from "./stableNeighborhood.ts";

const clip = { kind: "rect" as const, x: 0, y: 0, width: 960, height: 640 };

function scenario(count: number) {
  const beforeNodes: CellInputNode[] = Array.from({ length: count }, (_, index) => ({
    id: `n${index}`,
    weight: 20 + (index % 5) * 10,
  }));
  const edges: AtlasEdge[] = [];
  for (let index = 0; index < count - 1; index++) {
    edges.push({ source: `n${index}`, target: `n${index + 1}` });
    if (index % 4 === 0 && index + 5 < count) {
      edges.push({ source: `n${index}`, target: `n${index + 5}` });
    }
  }
  const before = stableNeighborhoodUpdate(beforeNodes, edges, clip, {
    seed: 7,
    anchorMixes: [0],
    maxSteps: 800,
    adaptationRate: 0.8,
    lloydRate: 0.7,
  });
  return {
    nodes: beforeNodes.map((node, index) =>
      index === 0 ? { ...node, weight: node.weight * 3 } : node,
    ),
    edges,
    anchors: new Map(before.state.cells.map((cell) => [cell.id, cell.site] as const)),
  };
}

describe("stable neighborhood production budget", () => {
  for (const count of [8, 16, 32]) {
    const input = scenario(count);
    bench(`n=${count}`, () => {
      stableNeighborhoodUpdate(input.nodes, input.edges, clip, {
        seed: 7,
        anchors: input.anchors,
        anchorMixes: [0, 0.5, 1],
        adjacencyTolerance: 0,
        areaTolerance: 0.01,
        maxSteps: 240,
        adaptationRate: 0.8,
        lloydRate: 0.7,
      });
    });
  }
});
