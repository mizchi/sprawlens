import { bench, describe } from "vitest";
import { greedySwapAssignment } from "./neighborhood.ts";
import { createRng } from "./rng.ts";
import type { AtlasEdge } from "@sprawlens/contracts";

/**
 * A grid of n slots with 4-neighbor adjacency (like power-diagram cells), a
 * scrambled identity assignment, and a sparse dependency graph — the shape
 * subdivision feeds greedySwapAssignment (n up to 128).
 */
function scenario(n: number, seed = 1) {
  const cols = Math.ceil(Math.sqrt(n));
  const slotAdjacency: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const deltas: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of deltas) {
      const nr = r + dr;
      const nc = c + dc;
      const j = nr * cols + nc;
      if (nr >= 0 && nc >= 0 && nc < cols && j < n) slotAdjacency[i]!.add(j);
    }
  }
  const nodes = Array.from({ length: n }, (_, i) => `n${i}`);
  const rng = createRng(seed);
  const edges: AtlasEdge[] = [];
  for (let i = 0; i < n; i++) {
    const deg = 1 + Math.floor(rng() * 3);
    for (let d = 0; d < deg; d++) {
      const t = Math.floor(rng() * n);
      if (t !== i) edges.push({ source: `n${i}`, target: `n${t}` });
    }
  }
  // scrambled identity assignment
  const assign = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    [assign[i], assign[k]] = [assign[k]!, assign[i]!];
  }
  return { assign, nodes, slotAdjacency, edges };
}

describe("greedySwapAssignment", () => {
  for (const n of [32, 64, 128]) {
    const s = scenario(n);
    bench(`n=${n}`, () => {
      greedySwapAssignment(s.assign, s.nodes, s.slotAdjacency, s.edges);
    });
  }
});
