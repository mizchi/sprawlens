import { describe, expect, it } from "vitest";
import type { ClipRegion } from "./capacityLayout.js";
import {
  createForceLayout,
  forceStep,
  type ForceInputEdge,
  type ForceInputNode,
} from "./forceLayout.js";
import { createRng } from "./rng.js";

const rectClip: ClipRegion = { kind: "rect", x: 0, y: 0, width: 1, height: 1 };

function clusteredGraph(seed: number): {
  nodes: ForceInputNode[];
  edges: ForceInputEdge[];
} {
  // two clusters of 8, densely linked inside, one bridge edge between
  const rng = createRng(seed);
  const nodes: ForceInputNode[] = [];
  const edges: ForceInputEdge[] = [];
  for (const cluster of [0, 1]) {
    for (let i = 0; i < 8; i++) {
      nodes.push({ id: `c${cluster}-${i}`, weight: 1 + rng() * 9 });
    }
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        if (rng() < 0.5) {
          edges.push({ source: `c${cluster}-${i}`, target: `c${cluster}-${j}` });
        }
      }
    }
  }
  edges.push({ source: "c0-0", target: "c1-0" });
  return { nodes, edges };
}

function run(nodes: ForceInputNode[], edges: ForceInputEdge[], seed: number) {
  let state = createForceLayout(nodes, edges, rectClip, { seed });
  for (let i = 0; i < 200; i++) state = forceStep(state);
  return state;
}

describe("forceLayout", () => {
  it("is deterministic for the same seed", () => {
    const { nodes, edges } = clusteredGraph(1);
    const a = run(nodes, edges, 42);
    const b = run(nodes, edges, 42);
    expect(a.positions).toEqual(b.positions);
  });

  it("keeps all nodes inside the clip region", () => {
    const { nodes, edges } = clusteredGraph(2);
    const state = run(nodes, edges, 7);
    for (const p of state.positions.values()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("pulls connected nodes closer than unconnected ones on average", () => {
    const { nodes, edges } = clusteredGraph(3);
    const state = run(nodes, edges, 11);
    const connected = new Set(
      edges.map((e) => `${e.source}|${e.target}`),
    );
    let connectedSum = 0;
    let connectedCount = 0;
    let otherSum = 0;
    let otherCount = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!.id;
        const b = nodes[j]!.id;
        const pa = state.positions.get(a)!;
        const pb = state.positions.get(b)!;
        const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        if (connected.has(`${a}|${b}`) || connected.has(`${b}|${a}`)) {
          connectedSum += d;
          connectedCount++;
        } else {
          otherSum += d;
          otherCount++;
        }
      }
    }
    expect(connectedSum / connectedCount).toBeLessThan(otherSum / otherCount);
  });

  it("separates nodes instead of collapsing them onto one point", () => {
    const nodes: ForceInputNode[] = Array.from({ length: 6 }, (_, i) => ({
      id: `n${i}`,
      weight: 1,
    }));
    const edges: ForceInputEdge[] = nodes.slice(1).map((n) => ({
      source: "n0",
      target: n.id,
    }));
    const state = run(nodes, edges, 5);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = state.positions.get(`n${i}`)!;
        const b = state.positions.get(`n${j}`)!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.01);
      }
    }
  });
});
