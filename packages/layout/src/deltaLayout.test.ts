import { describe, expect, it } from "vitest";
import type { AtlasEdge } from "@sprawlens/contracts";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellInputNode,
} from "./capacityLayout.ts";
import {
  attachDeltaGuidance,
  deltaAwareStep,
  isDeltaConverged,
  measureDeltaObjective,
} from "./deltaLayout.ts";
import { cellAdjacency, realizedEdgeRate } from "./neighborhood.ts";

const clip = { kind: "rect" as const, x: 0, y: 0, width: 1, height: 1 };

function settleArea(state: CapacityLayoutState, max = 500): CapacityLayoutState {
  let current = state;
  for (let i = 0; i < max && !isConverged(current, 0.01); i++) current = capacityStep(current);
  return current;
}

function settleDelta(state: CapacityLayoutState, max = 500): CapacityLayoutState {
  let current = state;
  for (let i = 0; i < max && !isDeltaConverged(current, 0.01); i++) {
    current = deltaAwareStep(current);
  }
  return current;
}

function adjacencyRate(state: CapacityLayoutState, edges: readonly AtlasEdge[]): number {
  return realizedEdgeRate(cellAdjacency(state.cells), edges);
}

function meanDrift(
  before: CapacityLayoutState,
  after: CapacityLayoutState,
  excluded = new Set<string>(),
): number {
  const previous = new Map(before.cells.map((cell) => [cell.id, cell.site]));
  let sum = 0;
  let count = 0;
  for (const cell of after.cells) {
    if (excluded.has(cell.id)) continue;
    const p = previous.get(cell.id);
    if (!p) continue;
    sum += Math.hypot(cell.site.x - p.x, cell.site.y - p.y);
    count++;
  }
  return count === 0 ? 0 : sum / count;
}

describe("delta-aware capacity layout", () => {
  it("reports area, dependency-neighborhood, and temporal terms separately", () => {
    const base = settleArea(
      createCapacityLayout(
        [
          { id: "a", weight: 1, hint: { x: 0.15, y: 0.5 } },
          { id: "b", weight: 1, hint: { x: 0.5, y: 0.5 } },
          { id: "c", weight: 1, hint: { x: 0.85, y: 0.5 } },
        ],
        clip,
        { seed: 1 },
      ),
    );
    const guided = attachDeltaGuidance(base, [{ source: "a", target: "c" }], {
      anchors: new Map(base.cells.map((cell) => [cell.id, cell.site])),
    });
    const score = measureDeltaObjective(guided);

    expect(score.maxAreaError).toBeLessThan(0.01);
    expect(score.dependencyAdjacency).toBe(0);
    expect(score.adjacencyLoss).toBe(1);
    expect(score.normalizedDisplacement).toBe(0);
    expect(score.total).toBeGreaterThan(0);
  });

  it("improves a deliberately non-local dependency without losing area convergence", () => {
    const nodes: CellInputNode[] = [
      { id: "a", weight: 1, hint: { x: 0.14, y: 0.2 } },
      { id: "b", weight: 1, hint: { x: 0.5, y: 0.2 } },
      { id: "c", weight: 1, hint: { x: 0.86, y: 0.2 } },
      { id: "d", weight: 1, hint: { x: 0.14, y: 0.8 } },
      { id: "e", weight: 1, hint: { x: 0.5, y: 0.8 } },
      { id: "f", weight: 1, hint: { x: 0.86, y: 0.8 } },
    ];
    const edges: AtlasEdge[] = [
      { source: "a", target: "f" },
      { source: "c", target: "d" },
      { source: "a", target: "d" },
      { source: "c", target: "f" },
    ];
    const base = settleArea(createCapacityLayout(nodes, clip, { seed: 3, lloydRate: 0.25 }));
    const before = adjacencyRate(base, edges);
    const result = settleDelta(
      attachDeltaGuidance(base, edges, {
        dependencyRate: 0.16,
        temporalRate: 0,
        adjacencyWeight: 2,
        minGuidedSteps: 20,
        maxGuidedSteps: 180,
      }),
    );

    expect(adjacencyRate(result, edges)).toBeGreaterThan(before);
    expect(result.maxRelativeError).toBeLessThan(0.02);
  });

  it("anchors unchanged nodes after a graph delta while retaining dependency quality", () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      weight: 1 + (i % 3),
      hint: { x: 0.1 + (i % 5) * 0.2, y: i < 5 ? 0.25 : 0.75 },
    }));
    const edges: AtlasEdge[] = Array.from({ length: 9 }, (_, i) => ({
      source: `n${i}`,
      target: `n${i + 1}`,
    }));
    const base = settleDelta(
      attachDeltaGuidance(createCapacityLayout(nodes, clip, { seed: 7 }), edges, {
        temporalRate: 0,
      }),
    );
    const changedNode = { id: "n0", weight: 8 };
    const warm = applyGraphChanges(base, { upsert: [changedNode], edges });

    let unguided: CapacityLayoutState = { ...warm, guidance: undefined };
    for (let i = 0; i < 100; i++) unguided = capacityStep(unguided);
    const guided = settleDelta(warm, 160);

    expect(meanDrift(base, guided, new Set(["n0"]))).toBeLessThan(
      meanDrift(base, unguided, new Set(["n0"])),
    );
    expect(adjacencyRate(guided, edges)).toBeGreaterThanOrEqual(adjacencyRate(unguided, edges));
    expect(guided.maxRelativeError).toBeLessThan(0.02);
  });

  it("is deterministic for a fixed seed and delta", () => {
    const nodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, weight: i + 1 }));
    const edges = nodes.slice(1).map((node, i) => ({ source: nodes[i]!.id, target: node.id }));
    const run = () =>
      settleDelta(attachDeltaGuidance(createCapacityLayout(nodes, clip, { seed: 11 }), edges));

    expect(run().cells.map((cell) => cell.site)).toEqual(run().cells.map((cell) => cell.site));
  });
});
