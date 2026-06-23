import { describe, expect, it } from "vitest";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellInputNode,
  type ClipRegion,
} from "./capacityLayout.js";
import { createRng } from "./rng.js";

const rectClip: ClipRegion = { kind: "rect", x: 0, y: 0, width: 1, height: 1 };
const circleClip: ClipRegion = { kind: "circle", cx: 0.5, cy: 0.5, r: 0.5 };

function syntheticNodes(count: number, seed: number): CellInputNode[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    weight: 1 + 99 * rng() ** 3, // skewed like LOC distributions
  }));
}

function runUntil(
  initial: CapacityLayoutState,
  tolerance: number,
  maxIterations: number,
): { state: CapacityLayoutState; iterations: number; displacement: number } {
  let state = initial;
  let iterations = 0;
  let displacement = 0;
  while (!isConverged(state, tolerance) && iterations < maxIterations) {
    const next = capacityStep(state);
    for (const cell of next.cells) {
      const prev = state.cells.find((c) => c.id === cell.id);
      if (prev) {
        displacement += Math.hypot(cell.site.x - prev.site.x, cell.site.y - prev.site.y);
      }
    }
    state = next;
    iterations++;
  }
  return { state, iterations, displacement };
}

describe("createCapacityLayout", () => {
  it("is deterministic for the same seed", () => {
    const nodes = syntheticNodes(20, 5);
    let a = createCapacityLayout(nodes, rectClip, { seed: 9 });
    let b = createCapacityLayout(nodes, rectClip, { seed: 9 });
    for (let i = 0; i < 10; i++) {
      a = capacityStep(a);
      b = capacityStep(b);
    }
    expect(a.cells.map((c) => c.site)).toEqual(b.cells.map((c) => c.site));
  });

  it("separates coincident hint positions", () => {
    const nodes: CellInputNode[] = [
      { id: "a", weight: 1, hint: { x: 0.5, y: 0.5 } },
      { id: "b", weight: 1, hint: { x: 0.5, y: 0.5 } },
      { id: "c", weight: 1, hint: { x: 0.5, y: 0.5 } },
    ];
    const state = createCapacityLayout(nodes, rectClip, { seed: 1 });
    const { state: converged } = runUntil(state, 0.02, 200);
    for (const cell of converged.cells) {
      expect(cell.actualArea).toBeGreaterThan(0);
    }
  });
});

describe("option merging", () => {
  it("ignores explicitly-undefined options instead of clobbering defaults", () => {
    const state = createCapacityLayout(syntheticNodes(10, 1), rectClip, {
      seed: 1,
      adaptationRate: undefined,
      lloydRate: undefined,
    });
    const { state: converged } = runUntil(state, 0.02, 300);
    expect(converged.maxRelativeError).toBeLessThan(0.02);
  });
});

describe("capacityStep convergence", () => {
  for (const n of [10, 50, 200]) {
    for (const seed of [1, 2, 3]) {
      it(`reaches <2% max relative error (n=${n}, seed=${seed})`, () => {
        const state = createCapacityLayout(syntheticNodes(n, seed), rectClip, {
          seed,
        });
        const { state: converged, iterations } = runUntil(state, 0.02, 500);
        expect(converged.maxRelativeError).toBeLessThan(0.02);
        expect(iterations).toBeLessThan(500);
        const total = converged.cells.reduce((s, c) => s + c.actualArea, 0);
        expect(total).toBeCloseTo(1, 4);
      });
    }
  }

  it("converges inside a circle clip", () => {
    const state = createCapacityLayout(syntheticNodes(30, 4), circleClip, {
      seed: 4,
    });
    const { state: converged } = runUntil(state, 0.02, 500);
    expect(converged.maxRelativeError).toBeLessThan(0.02);
  });

  it("converges inside an arbitrary convex polygon clip (nested-cell case)", () => {
    // pentagon-ish convex ring, like an outer power-diagram cell
    const polygonClip: ClipRegion = {
      kind: "polygon",
      ring: [
        { x: 0.1, y: 0.2 },
        { x: 0.7, y: 0.05 },
        { x: 0.95, y: 0.5 },
        { x: 0.6, y: 0.9 },
        { x: 0.15, y: 0.75 },
      ],
    };
    const state = createCapacityLayout(syntheticNodes(15, 21), polygonClip, {
      seed: 21,
    });
    const { state: converged } = runUntil(state, 0.02, 500);
    expect(converged.maxRelativeError).toBeLessThan(0.02);
    const total = converged.cells.reduce((s, c) => s + c.actualArea, 0);
    expect(total).toBeCloseTo(converged.clipArea, 6);
  });

  it("converges inside a regular 16-gon and keeps sites within it", () => {
    const state = createCapacityLayout(syntheticNodes(40, 12), circleClip, {
      seed: 12,
      circleSegments: 16,
    });
    const { state: converged } = runUntil(state, 0.02, 500);
    expect(converged.maxRelativeError).toBeLessThan(0.02);
    // every site must stay inside the polygonized clip ring (CCW)
    const ring = converged.clipRing;
    expect(ring).toHaveLength(16);
    for (const cell of converged.cells) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        const cross = (b.x - a.x) * (cell.site.y - a.y) - (b.y - a.y) * (cell.site.x - a.x);
        expect(cross).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it("does not diverge with extreme 1:1000 weight ratios", () => {
    const nodes: CellInputNode[] = [
      { id: "huge", weight: 1000 },
      ...Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, weight: 1 })),
    ];
    const state = createCapacityLayout(nodes, rectClip, { seed: 8 });
    const { state: result } = runUntil(state, 0.02, 800);
    for (const cell of result.cells) {
      expect(Number.isFinite(cell.actualArea)).toBe(true);
      expect(Number.isFinite(cell.site.x)).toBe(true);
      expect(Number.isFinite(cell.site.y)).toBe(true);
    }
    expect(result.maxRelativeError).toBeLessThan(0.1);
    const total = result.cells.reduce((s, c) => s + c.actualArea, 0);
    expect(total).toBeCloseTo(1, 4);
  });

  it("clamps zero and negative weights to a positive floor", () => {
    const nodes: CellInputNode[] = [
      { id: "a", weight: 10 },
      { id: "zero", weight: 0 },
      { id: "neg", weight: -5 },
    ];
    const state = createCapacityLayout(nodes, rectClip, { seed: 2 });
    const { state: converged } = runUntil(state, 0.02, 300);
    for (const cell of converged.cells) {
      expect(cell.targetArea).toBeGreaterThan(0);
      expect(cell.actualArea).toBeGreaterThan(0);
    }
  });

  it("recovers cells that start with zero area", () => {
    // clustered hints + a dominant weight tend to produce empty cells early
    const nodes: CellInputNode[] = [
      { id: "big", weight: 500, hint: { x: 0.5, y: 0.5 } },
      { id: "a", weight: 1, hint: { x: 0.52, y: 0.5 } },
      { id: "b", weight: 1, hint: { x: 0.5, y: 0.52 } },
      { id: "c", weight: 1, hint: { x: 0.48, y: 0.5 } },
    ];
    const state = createCapacityLayout(nodes, rectClip, { seed: 3 });
    const { state: converged } = runUntil(state, 0.05, 500);
    for (const cell of converged.cells) {
      expect(cell.actualArea).toBeGreaterThan(0);
    }
  });
});

describe("applyGraphChanges (warm-start)", () => {
  it("re-converges much faster than cold start after a 10% weight change", () => {
    const nodes = syntheticNodes(50, 6);
    const cold = createCapacityLayout(nodes, rectClip, { seed: 6 });
    const coldRun = runUntil(cold, 0.02, 500);

    const changed = nodes.map((node) =>
      node.id === "n0" ? { ...node, weight: node.weight * 1.1 } : node,
    );
    const warm = applyGraphChanges(coldRun.state, {
      upsert: [changed.find((n) => n.id === "n0")!],
    });
    const warmRun = runUntil(warm, 0.02, 500);

    expect(warmRun.iterations).toBeLessThanOrEqual(Math.max(1, Math.ceil(coldRun.iterations / 5)));
    expect(warmRun.displacement).toBeLessThan(coldRun.displacement);
    expect(warmRun.state.maxRelativeError).toBeLessThan(0.02);
  });

  it("keeps existing sites nearly still when a node is added", () => {
    const nodes = syntheticNodes(40, 7);
    const base = runUntil(createCapacityLayout(nodes, rectClip, { seed: 7 }), 0.02, 500).state;

    const withNew = applyGraphChanges(base, {
      upsert: [{ id: "fresh", weight: 5 }],
    });
    const settled = runUntil(withNew, 0.02, 500).state;

    let totalDrift = 0;
    for (const cell of base.cells) {
      const after = settled.cells.find((c) => c.id === cell.id)!;
      totalDrift += Math.hypot(after.site.x - cell.site.x, after.site.y - cell.site.y);
    }
    const meanDrift = totalDrift / base.cells.length;
    expect(meanDrift).toBeLessThan(0.05);
    expect(settled.cells).toHaveLength(41);
  });

  it("removes nodes and re-normalizes target areas", () => {
    const nodes = syntheticNodes(20, 9);
    const base = runUntil(createCapacityLayout(nodes, rectClip, { seed: 9 }), 0.02, 500).state;
    const without = applyGraphChanges(base, { remove: ["n0", "n1"] });
    const settled = runUntil(without, 0.02, 500).state;
    expect(settled.cells).toHaveLength(18);
    const total = settled.cells.reduce((s, c) => s + c.targetArea, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(settled.maxRelativeError).toBeLessThan(0.02);
  });
});
