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

describe("forceLayout regions", () => {
  // two adjacent unit squares inside a 2x1 clip
  const wideClip: ClipRegion = { kind: "rect", x: 0, y: 0, width: 2, height: 1 };
  const left = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const right = [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
  ];

  function regioned(edges: ForceInputEdge[], seed: number, steps = 120) {
    const nodes: ForceInputNode[] = [
      { id: "a", weight: 1 },
      { id: "c", weight: 1 },
      { id: "e", weight: 1 },
      { id: "b", weight: 1 },
      { id: "d", weight: 1 },
      { id: "f", weight: 1 },
    ];
    const regions = new Map([
      ["a", left],
      ["c", left],
      ["e", left],
      ["b", right],
      ["d", right],
      ["f", right],
    ]);
    let state = createForceLayout(nodes, edges, wideClip, { seed, regions });
    for (let i = 0; i < steps; i++) state = forceStep(state);
    return state;
  }

  it("keeps every node inside its assigned region", () => {
    const state = regioned([{ source: "a", target: "b" }], 3);
    for (const id of ["a", "c", "e"]) {
      const p = state.positions.get(id)!;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    for (const id of ["b", "d", "f"]) {
      const p = state.positions.get(id)!;
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.x).toBeLessThanOrEqual(2);
    }
  });

  it("pulls a cross-region linked pair closer than unlinked cross-region pairs", () => {
    const state = regioned([{ source: "a", target: "b" }], 9);
    const d = (x: string, y: string) => {
      const p = state.positions.get(x)!;
      const q = state.positions.get(y)!;
      return Math.hypot(p.x - q.x, p.y - q.y);
    };
    expect(d("a", "b")).toBeLessThan(d("c", "d"));
    expect(d("a", "b")).toBeLessThan(d("e", "f"));
  });

  it("stays deterministic with regions", () => {
    const edges = [{ source: "a", target: "b" }];
    expect(regioned(edges, 21).positions).toEqual(regioned(edges, 21).positions);
  });
});
