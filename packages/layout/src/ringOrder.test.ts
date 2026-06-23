import { describe, expect, it } from "vitest";
import { barycentricRingOrder, type OrderEdge } from "./ringOrder.js";

function linearCrossings(pairs: readonly [number, number][]): number {
  let count = 0;
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const [a1, b1] = pairs[i]!;
      const [a2, b2] = pairs[j]!;
      if ((a1 - a2) * (b1 - b2) < 0) count++;
    }
  }
  return count;
}

/**
 * Crossings of radial edges between two concentric rings. Each ring's
 * angular start is free (ringLayout rotates rings independently), so the
 * true count is the minimum over the outer ring's rotations.
 */
function crossings(
  inner: readonly string[],
  outer: readonly string[],
  edges: readonly OrderEdge[],
): number {
  const xi = new Map(inner.map((id, i) => [id, i]));
  const n = outer.length;
  let best = Infinity;
  for (let k = 0; k < n; k++) {
    const xo = new Map(outer.map((id, i) => [id, (i + k) % n]));
    const pairs: [number, number][] = [];
    for (const e of edges) {
      const a = xi.get(e.source) ?? xi.get(e.target);
      const b = xo.get(e.target) ?? xo.get(e.source);
      if (a === undefined || b === undefined) continue;
      pairs.push([a, b]);
    }
    best = Math.min(best, linearCrossings(pairs));
  }
  return best;
}

describe("barycentricRingOrder", () => {
  it("reduces crossings versus the initial order", () => {
    // ring1 [a,b,c] each links to the *reversed* outer ring [x,y,z]
    const rings = new Map<number, string[]>([
      [1, ["a", "b", "c"]],
      [2, ["x", "y", "z"]],
    ]);
    const edges: OrderEdge[] = [
      { source: "a", target: "z" },
      { source: "b", target: "y" },
      { source: "c", target: "x" },
    ];
    const before = crossings(["a", "b", "c"], ["x", "y", "z"], edges);
    const out = barycentricRingOrder(rings, edges);
    const after = crossings(out.get(1)!, out.get(2)!, edges);
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    expect(after).toBe(0);
  });

  it("keeps every member of every ring", () => {
    const rings = new Map<number, string[]>([
      [0, ["hub"]],
      [1, ["a", "b"]],
      [2, ["c", "d", "e"]],
    ]);
    const out = barycentricRingOrder(rings, []);
    expect([...out.get(1)!].sort()).toEqual(["a", "b"]);
    expect([...out.get(2)!].sort()).toEqual(["c", "d", "e"]);
  });

  it("never reorders a lone center ring", () => {
    const rings = new Map<number, string[]>([
      [0, ["hub"]],
      [1, ["a", "b"]],
    ]);
    const out = barycentricRingOrder(rings, [
      { source: "a", target: "hub" },
      { source: "b", target: "hub" },
    ]);
    expect(out.get(0)).toEqual(["hub"]);
  });

  it("is deterministic", () => {
    const rings = new Map<number, string[]>([
      [1, ["a", "b", "c"]],
      [2, ["x", "y", "z"]],
    ]);
    const edges: OrderEdge[] = [
      { source: "a", target: "z" },
      { source: "c", target: "x" },
    ];
    const a = barycentricRingOrder(rings, edges);
    const b = barycentricRingOrder(rings, edges);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});
