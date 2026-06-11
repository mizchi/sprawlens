import { describe, expect, it } from "vitest";
import { embedGraph, procrustesAlign, type EmbedEdge } from "./embed.js";
import type { Vec2 } from "./vec.js";

function clique(prefix: string, size: number): {
  nodes: string[];
  edges: EmbedEdge[];
} {
  const nodes = Array.from({ length: size }, (_, i) => `${prefix}${i}`);
  const edges: EmbedEdge[] = [];
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      edges.push({ source: nodes[i]!, target: nodes[j]! });
    }
  }
  return { nodes, edges };
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function meanPairDist(pos: Map<string, Vec2>, a: string[], b: string[]): number {
  let sum = 0;
  let count = 0;
  for (const i of a) {
    for (const j of b) {
      if (i === j) continue;
      sum += dist(pos.get(i)!, pos.get(j)!);
      count++;
    }
  }
  return sum / count;
}

/** Two 5-cliques joined by a single bridge edge. */
function twoClusters() {
  const a = clique("a", 5);
  const b = clique("b", 5);
  return {
    a: a.nodes,
    b: b.nodes,
    nodes: [...a.nodes, ...b.nodes],
    edges: [...a.edges, ...b.edges, { source: "a0", target: "b0" }],
  };
}

describe("embedGraph", () => {
  it("is fully deterministic: identical runs give identical coordinates", () => {
    const { nodes, edges } = twoClusters();
    const first = embedGraph(nodes, edges);
    const second = embedGraph(nodes, edges);
    for (const id of nodes) {
      expect(first.get(id)).toEqual(second.get(id));
    }
  });

  it("places graph neighborhoods together: intra-cluster < inter-cluster", () => {
    const { a, b, nodes, edges } = twoClusters();
    const pos = embedGraph(nodes, edges);
    const intra = (meanPairDist(pos, a, a) + meanPairDist(pos, b, b)) / 2;
    const inter = meanPairDist(pos, a, b);
    expect(inter).toBeGreaterThan(intra * 1.5);
  });

  it("stretches a path graph: endpoints are the farthest pair", () => {
    const nodes = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const edges = nodes.slice(1).map((id, i) => ({
      source: nodes[i]!,
      target: id,
    }));
    const pos = embedGraph(nodes, edges);
    const endToEnd = dist(pos.get("p0")!, pos.get("p9")!);
    const neighbor = dist(pos.get("p4")!, pos.get("p5")!);
    expect(endToEnd).toBeGreaterThan(neighbor * 3);
  });

  it("keeps disconnected components finite and apart", () => {
    const a = clique("a", 4);
    const b = clique("b", 4);
    const pos = embedGraph(
      [...a.nodes, ...b.nodes],
      [...a.edges, ...b.edges],
    );
    for (const p of pos.values()) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
    const intra = meanPairDist(pos, a.nodes, a.nodes);
    const inter = meanPairDist(pos, a.nodes, b.nodes);
    expect(inter).toBeGreaterThan(intra);
  });

  it("normalizes cold output: centered with RMS radius ~1", () => {
    const { nodes, edges } = twoClusters();
    const pos = embedGraph(nodes, edges);
    const cx = [...pos.values()].reduce((s, p) => s + p.x, 0) / pos.size;
    const cy = [...pos.values()].reduce((s, p) => s + p.y, 0) / pos.size;
    expect(cx).toBeCloseTo(0, 6);
    expect(cy).toBeCloseTo(0, 6);
    const rms = Math.sqrt(
      [...pos.values()].reduce((s, p) => s + p.x ** 2 + p.y ** 2, 0) /
        pos.size,
    );
    expect(rms).toBeCloseTo(1, 6);
  });

  it("warm re-embed with a small change stays near the previous layout", () => {
    const { nodes, edges } = twoClusters();
    const previous = embedGraph(nodes, edges);
    // one extra member joins cluster b
    const grownNodes = [...nodes, "b5"];
    const grownEdges = [
      ...edges,
      { source: "b5", target: "b0" },
      { source: "b5", target: "b1" },
    ];
    const next = embedGraph(grownNodes, grownEdges, {
      previous,
      temporalStrength: 0.2,
    });
    const drift =
      nodes.reduce((s, id) => s + dist(previous.get(id)!, next.get(id)!), 0) /
      nodes.length;
    // layout extent is ~1 (RMS); existing nodes barely move
    expect(drift).toBeLessThan(0.25);
    // the new node lands near its cluster, not at the origin/elsewhere
    const toOwn = meanPairDist(next, ["b5"], ["b0", "b1", "b2"]);
    const toOther = meanPairDist(next, ["b5"], ["a0", "a1", "a2"]);
    expect(toOwn).toBeLessThan(toOther);
  });

  it("init hints pin the orientation of symmetric layouts", () => {
    const { a, b, nodes, edges } = twoClusters();
    const hints = new Map<string, Vec2>([
      ["a0", { x: -1, y: 0 }],
      ["b0", { x: 1, y: 0 }],
    ]);
    const pos = embedGraph(nodes, edges, { hints });
    const cxA = a.reduce((s, id) => s + pos.get(id)!.x, 0) / a.length;
    const cxB = b.reduce((s, id) => s + pos.get(id)!.x, 0) / b.length;
    expect(cxA).toBeLessThan(cxB);
  });

  it("handles trivial graphs", () => {
    expect(embedGraph([], []).size).toBe(0);
    const single = embedGraph(["only"], []);
    expect(single.get("only")).toEqual({ x: 0, y: 0 });
    const pair = embedGraph(["a", "b"], [{ source: "a", target: "b" }]);
    expect(pair.size).toBe(2);
    for (const p of pair.values()) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe("procrustesAlign", () => {
  const square: [string, Vec2][] = [
    ["a", { x: 1, y: 0 }],
    ["b", { x: 0, y: 1 }],
    ["c", { x: -1, y: 0 }],
    ["d", { x: 0, y: -1 }],
  ];

  it("undoes rotation and translation", () => {
    const reference = new Map(square);
    const angle = Math.PI / 2;
    const moved = new Map(
      square.map(([id, p]) => [
        id,
        {
          x: p.x * Math.cos(angle) - p.y * Math.sin(angle) + 5,
          y: p.x * Math.sin(angle) + p.y * Math.cos(angle) - 3,
        },
      ]),
    );
    const aligned = procrustesAlign(reference, moved);
    for (const [id, p] of reference) {
      expect(aligned.get(id)!.x).toBeCloseTo(p.x, 6);
      expect(aligned.get(id)!.y).toBeCloseTo(p.y, 6);
    }
  });

  it("undoes reflection", () => {
    const reference = new Map(square);
    const mirrored = new Map(
      square.map(([id, p]) => [id, { x: -p.x, y: p.y }]),
    );
    const aligned = procrustesAlign(reference, mirrored);
    for (const [id, p] of reference) {
      expect(aligned.get(id)!.x).toBeCloseTo(p.x, 6);
      expect(aligned.get(id)!.y).toBeCloseTo(p.y, 6);
    }
  });

  it("aligns using only shared ids, carrying extra points along", () => {
    const reference = new Map(square);
    const moved = new Map([
      ...square.map(([id, p]): [string, Vec2] => [id, { x: -p.x, y: p.y }]),
      ["extra", { x: -2, y: 0 }] as [string, Vec2],
    ]);
    const aligned = procrustesAlign(reference, moved);
    expect(aligned.get("extra")!.x).toBeCloseTo(2, 6);
    expect(aligned.size).toBe(5);
  });
});
