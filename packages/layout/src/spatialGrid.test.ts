import { describe, expect, it } from "vitest";
import { nearestNeighborSquared } from "./spatialGrid.js";

/** Reference O(n²) nearest-neighbor squared distances. */
function brute(xs: Float64Array, ys: Float64Array): Float64Array {
  const n = xs.length;
  const out = new Float64Array(n).fill(Infinity);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d2 = (xs[i]! - xs[j]!) ** 2 + (ys[i]! - ys[j]!) ** 2;
      if (d2 < out[i]!) out[i] = d2;
    }
  return out;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

describe("nearestNeighborSquared", () => {
  it("returns Infinity for fewer than two points", () => {
    expect([...nearestNeighborSquared(new Float64Array(0), new Float64Array(0))]).toEqual([]);
    expect([...nearestNeighborSquared(new Float64Array([1]), new Float64Array([2]))]).toEqual([Infinity]);
  });

  it("matches brute force across random distributions and sizes", () => {
    for (const [n, seed] of [[2, 1], [10, 7], [200, 3], [777, 11]] as const) {
      const rng = lcg(seed);
      const xs = new Float64Array(n);
      const ys = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        xs[i] = rng() * 1000;
        ys[i] = rng() * 600;
      }
      const got = nearestNeighborSquared(xs, ys);
      const want = brute(xs, ys);
      for (let i = 0; i < n; i++) expect(got[i]).toBeCloseTo(want[i]!, 9);
    }
  });

  it("handles duplicate and collinear points (best = 0 / exact)", () => {
    const xs = new Float64Array([0, 0, 5, 5, 10]);
    const ys = new Float64Array([0, 0, 0, 0, 0]);
    const got = nearestNeighborSquared(xs, ys);
    const want = brute(xs, ys);
    for (let i = 0; i < xs.length; i++) expect(got[i]).toBe(want[i]);
  });
});
