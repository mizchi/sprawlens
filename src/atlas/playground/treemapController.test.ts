import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "../contracts/graph.js";
import { cellAdjacency, realizedEdgeRate } from "../kernel/neighborhood.js";
import { containsPoint } from "../kernel/polygon.js";
import {
  createTreemapState,
  stepTreemapState,
  type TreemapState,
} from "./treemapController.js";

function sampleGraph(): AtlasGraph {
  const nodes = [
    ...["a", "b", "c"].map((n) => ({
      id: `src/alpha/${n}.ts`,
      kind: "file" as const,
      label: `${n}.ts`,
      metrics: { loc: 80 },
    })),
    ...["d", "e", "f"].map((n) => ({
      id: `src/beta/${n}.ts`,
      kind: "file" as const,
      label: `${n}.ts`,
      metrics: { loc: 120 },
    })),
    ...["g", "h"].map((n) => ({
      id: `src/gamma/${n}.ts`,
      kind: "file" as const,
      label: `${n}.ts`,
      metrics: { loc: 40 },
    })),
  ];
  const edges = [
    { source: "src/alpha/a.ts", target: "src/alpha/b.ts" },
    { source: "src/alpha/b.ts", target: "src/alpha/c.ts" },
    { source: "src/beta/d.ts", target: "src/beta/e.ts" },
    { source: "src/alpha/a.ts", target: "src/beta/d.ts" },
    { source: "src/gamma/g.ts", target: "src/beta/f.ts" },
  ];
  return { nodes, edges };
}

const OPTIONS = { width: 800, height: 600, seed: 1 };

function settled(state: TreemapState, rounds = 200): TreemapState {
  for (let i = 0; i < rounds; i++) {
    const result = stepTreemapState(state, 2);
    state = result.state;
    if (!result.active) break;
  }
  return state;
}

describe("createTreemapState", () => {
  it("tiles the whole viewport with module cells", () => {
    const state = createTreemapState(sampleGraph(), OPTIONS);
    expect(state.moduleCells.size).toBe(3);
    let total = 0;
    for (const cell of state.moduleCells.values()) total += cell.actualArea;
    expect(total).toBeCloseTo(800 * 600, 0);
  });

  it("sizes module cells proportional to their LOC", () => {
    const state = createTreemapState(sampleGraph(), OPTIONS);
    const alpha = state.moduleCells.get("src/alpha")!;
    const beta = state.moduleCells.get("src/beta")!;
    // 240 vs 360 LOC; modules are solved to convergence at creation
    expect(beta.actualArea / alpha.actualArea).toBeCloseTo(360 / 240, 1);
  });

  it("keeps every file site inside its module polygon", () => {
    const state = settled(createTreemapState(sampleGraph(), OPTIONS));
    for (const [moduleId, layout] of state.fileLayouts) {
      const moduleCell = state.moduleCells.get(moduleId)!;
      for (const cell of layout.cells) {
        expect(containsPoint(moduleCell.polygon, cell.site)).toBe(true);
      }
    }
  });

  it("nests file cells that fill (the inset of) their module cell", () => {
    const state = settled(createTreemapState(sampleGraph(), OPTIONS));
    for (const [moduleId, layout] of state.fileLayouts) {
      const moduleCell = state.moduleCells.get(moduleId)!;
      const fileArea = layout.cells.reduce((s, c) => s + c.actualArea, 0);
      expect(fileArea).toBeGreaterThan(moduleCell.actualArea * 0.8);
      expect(fileArea).toBeLessThanOrEqual(moduleCell.actualArea * 1.001);
    }
  });

  it("exposes the hierarchy for edge bundling", () => {
    const state = createTreemapState(sampleGraph(), OPTIONS);
    expect(state.parentOf.get("src/alpha/a.ts")).toBe("src/alpha");
    expect(state.parentOf.get("src/alpha")).toBeNull();
  });

  it("realizes intra-module dependency chains as adjacent cells", () => {
    // one module: 8 files in a chain with mixed sizes
    const nodes = Array.from({ length: 8 }, (_, i) => ({
      id: `src/alpha/f${i}.ts`,
      kind: "file" as const,
      label: `f${i}.ts`,
      metrics: { loc: 50 + (i % 3) * 40 },
    }));
    const edges = Array.from({ length: 7 }, (_, i) => ({
      source: `src/alpha/f${i}.ts`,
      target: `src/alpha/f${i + 1}.ts`,
    }));
    const state = settled(createTreemapState({ nodes, edges }, OPTIONS));
    const layout = state.fileLayouts.get("src/alpha")!;
    const rate = realizedEdgeRate(cellAdjacency(layout.cells), edges);
    expect(rate).toBeGreaterThanOrEqual(0.7);
  });

  it("is deterministic", () => {
    const a = settled(createTreemapState(sampleGraph(), OPTIONS));
    const b = settled(createTreemapState(sampleGraph(), OPTIONS));
    expect(
      [...a.fileLayouts.values()].flatMap((l) => l.cells.map((c) => c.site)),
    ).toEqual(
      [...b.fileLayouts.values()].flatMap((l) => l.cells.map((c) => c.site)),
    );
  });
});

describe("stepTreemapState", () => {
  it("reports active until file layouts converge, then settles", () => {
    let state = createTreemapState(sampleGraph(), OPTIONS);
    let active = true;
    let rounds = 0;
    while (active && rounds < 400) {
      const result = stepTreemapState(state, 2);
      state = result.state;
      active = result.active;
      rounds++;
    }
    expect(active).toBe(false);
    for (const layout of state.fileLayouts.values()) {
      expect(layout.maxRelativeError).toBeLessThan(0.02);
    }
  });
});
