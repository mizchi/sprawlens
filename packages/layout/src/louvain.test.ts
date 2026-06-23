import { describe, expect, it } from "vitest";
import { louvain, type LouvainEdge } from "./louvain.ts";

function clique(
  prefix: string,
  size: number,
): {
  nodes: string[];
  edges: LouvainEdge[];
} {
  const nodes = Array.from({ length: size }, (_, i) => `${prefix}${i}`);
  const edges: LouvainEdge[] = [];
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      edges.push({ source: nodes[i]!, target: nodes[j]! });
    }
  }
  return { nodes, edges };
}

function communitySets(assignment: Map<string, number>): string[][] {
  const byCommunity = new Map<number, string[]>();
  for (const [id, c] of assignment) {
    const bucket = byCommunity.get(c);
    if (bucket) bucket.push(id);
    else byCommunity.set(c, [id]);
  }
  return [...byCommunity.values()].map((m) => m.sort());
}

describe("louvain", () => {
  it("separates two cliques joined by a bridge", () => {
    const a = clique("a", 5);
    const b = clique("b", 5);
    const result = louvain(
      [...a.nodes, ...b.nodes],
      [...a.edges, ...b.edges, { source: "a0", target: "b0" }],
    );
    const sets = communitySets(result.communityOf).sort((x, y) => x[0]!.localeCompare(y[0]!));
    expect(sets).toEqual([a.nodes.slice().sort(), b.nodes.slice().sort()]);
  });

  it("keeps a single clique together", () => {
    const { nodes, edges } = clique("n", 6);
    const result = louvain(nodes, edges);
    expect(new Set(result.communityOf.values()).size).toBe(1);
  });

  it("is deterministic", () => {
    const a = clique("a", 4);
    const b = clique("b", 4);
    const c = clique("c", 4);
    const nodes = [...a.nodes, ...b.nodes, ...c.nodes];
    const edges = [
      ...a.edges,
      ...b.edges,
      ...c.edges,
      { source: "a0", target: "b0" },
      { source: "b1", target: "c0" },
    ];
    const first = louvain(nodes, edges);
    const second = louvain(nodes, edges);
    expect([...first.communityOf]).toEqual([...second.communityOf]);
    expect(first.levels.length).toBe(second.levels.length);
  });

  it("gives disconnected components separate communities", () => {
    const a = clique("a", 3);
    const b = clique("b", 3);
    const result = louvain([...a.nodes, ...b.nodes, "lone"], [...a.edges, ...b.edges]);
    const cA = result.communityOf.get("a0");
    const cB = result.communityOf.get("b0");
    const cLone = result.communityOf.get("lone");
    expect(cA).not.toBe(cB);
    expect(cLone).not.toBe(cA);
    expect(cLone).not.toBe(cB);
  });

  it("assigns every node at every level, coarser levels merge only", () => {
    const a = clique("a", 4);
    const b = clique("b", 4);
    const nodes = [...a.nodes, ...b.nodes];
    const edges = [...a.edges, ...b.edges, { source: "a0", target: "b0" }];
    const result = louvain(nodes, edges);
    expect(result.levels.length).toBeGreaterThanOrEqual(1);
    let previousCount = Infinity;
    for (const level of result.levels) {
      expect(level.size).toBe(nodes.length);
      const count = new Set(level.values()).size;
      expect(count).toBeLessThanOrEqual(previousCount);
      previousCount = count;
      // a node pair sharing a community at a fine level stays together
    }
    for (let i = 1; i < result.levels.length; i++) {
      const fine = result.levels[i - 1]!;
      const coarse = result.levels[i]!;
      const mapping = new Map<number, number>();
      for (const id of nodes) {
        const from = fine.get(id)!;
        const to = coarse.get(id)!;
        const expected = mapping.get(from);
        if (expected === undefined) mapping.set(from, to);
        else expect(expected).toBe(to);
      }
    }
  });

  it("respects edge weights: the heavy side wins", () => {
    // x sits between two pairs; the heavy edges pull it into the a-side
    const nodes = ["a0", "a1", "x", "b0", "b1"];
    const edges: LouvainEdge[] = [
      { source: "a0", target: "a1", weight: 10 },
      { source: "a0", target: "x", weight: 10 },
      { source: "a1", target: "x", weight: 10 },
      { source: "b0", target: "b1", weight: 10 },
      { source: "x", target: "b0", weight: 1 },
    ];
    const result = louvain(nodes, edges);
    expect(result.communityOf.get("x")).toBe(result.communityOf.get("a0"));
    expect(result.communityOf.get("x")).not.toBe(result.communityOf.get("b0"));
  });

  it("handles empty and trivial inputs", () => {
    expect(louvain([], []).communityOf.size).toBe(0);
    const single = louvain(["only"], []);
    expect(single.communityOf.get("only")).toBe(0);
  });
});
