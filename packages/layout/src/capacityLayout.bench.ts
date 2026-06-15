import { bench, describe } from "vitest";
import {
  capacityStep,
  createCapacityLayout,
  type CellInputNode,
  type ClipRegion,
} from "./capacityLayout.js";
import { transitiveWeights } from "./transitiveWeight.js";
import { createRng } from "./rng.js";
import type { AtlasEdge } from "@sprawlens/contracts";

const clip: ClipRegion = { kind: "rect", x: 0, y: 0, width: 800, height: 600 };

function nodes(n: number, seed = 1): CellInputNode[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    weight: Math.exp(rng() * 4) * 10, // pareto-ish spread
  }));
}

describe("createCapacityLayout", () => {
  for (const n of [100, 300, 700]) {
    const input = nodes(n);
    bench(`n=${n}`, () => {
      createCapacityLayout(input, clip, { seed: 1 });
    });
  }
});

describe("capacityStep", () => {
  for (const n of [100, 300, 700]) {
    // one warm step on a freshly seeded layout (the per-frame solver unit)
    const state = createCapacityLayout(nodes(n), clip, { seed: 1 });
    bench(`n=${n}`, () => {
      capacityStep(state);
    });
  }
});

/** A chain + cross-links mesh, the transitive-closure stress shape. */
function mesh(n: number): { ids: string[]; edges: AtlasEdge[] } {
  const ids = Array.from({ length: n }, (_, i) => `m${i}`);
  const edges: AtlasEdge[] = [];
  for (let i = 0; i < n - 1; i++) {
    edges.push({ source: `m${i}`, target: `m${i + 1}` });
    if (i % 7 === 0) edges.push({ source: `m${i}`, target: `m${(i + 13) % n}` });
  }
  return { ids, edges };
}

describe("transitiveWeights", () => {
  for (const n of [500, 2000]) {
    const { ids, edges } = mesh(n);
    bench(`n=${n}`, () => {
      transitiveWeights(ids, edges, () => 1);
    });
  }
});
