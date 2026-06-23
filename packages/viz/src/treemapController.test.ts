import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import { directoryGrouping, moduleGrouping } from "@sprawlens/schema";
import { cellAdjacency, realizedEdgeRate } from "@sprawlens/layout";
import { containsPoint } from "@sprawlens/layout";
import {
  applyTreemapChanges,
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
  it("tiles the whole viewport with top-level cells", () => {
    const state = createTreemapState(sampleGraph(), OPTIONS);
    expect(state.levels).toHaveLength(1);
    expect(state.levels[0]!.kind).toBe("module");
    expect(state.levels[0]!.cells.size).toBe(3);
    let total = 0;
    for (const cell of state.levels[0]!.cells.values()) total += cell.actualArea;
    expect(total).toBeCloseTo(800 * 600, 0);
  });

  it("sizes top cells proportional to their LOC", () => {
    const state = createTreemapState(sampleGraph(), OPTIONS);
    const alpha = state.levels[0]!.cells.get("src/alpha")!;
    const beta = state.levels[0]!.cells.get("src/beta")!;
    // 240 vs 360 LOC; boundary levels are solved to convergence at creation
    expect(beta.actualArea / alpha.actualArea).toBeCloseTo(360 / 240, 1);
  });

  it("keeps every leaf site inside its group polygon", () => {
    const state = settled(createTreemapState(sampleGraph(), OPTIONS));
    for (const [groupId, layout] of state.leafLayouts) {
      const groupCell = state.levels[0]!.cells.get(groupId)!;
      for (const cell of layout.cells) {
        expect(containsPoint(groupCell.polygon, cell.site)).toBe(true);
      }
    }
  });

  it("nests leaf cells that fill (the inset of) their group cell", () => {
    const state = settled(createTreemapState(sampleGraph(), OPTIONS));
    for (const [groupId, layout] of state.leafLayouts) {
      const groupCell = state.levels[0]!.cells.get(groupId)!;
      const leafArea = layout.cells.reduce((s, c) => s + c.actualArea, 0);
      expect(leafArea).toBeGreaterThan(groupCell.actualArea * 0.8);
      expect(leafArea).toBeLessThanOrEqual(groupCell.actualArea * 1.001);
    }
  });

  it("exposes the hierarchy for edge bundling", () => {
    const state = createTreemapState(sampleGraph(), OPTIONS);
    expect(state.parentOf.get("src/alpha/a.ts")).toBe("src/alpha");
    expect(state.parentOf.get("src/alpha")).toBeNull();
    expect(state.kindOf.get("src/alpha")).toBe("module");
  });

  it("realizes intra-group dependency chains as adjacent cells", () => {
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
    const layout = state.leafLayouts.get("src/alpha")!;
    const rate = realizedEdgeRate(cellAdjacency(layout.cells), edges);
    expect(rate).toBeGreaterThanOrEqual(0.7);
  });

  it("is deterministic", () => {
    const a = settled(createTreemapState(sampleGraph(), OPTIONS));
    const b = settled(createTreemapState(sampleGraph(), OPTIONS));
    expect([...a.leafLayouts.values()].flatMap((l) => l.cells.map((c) => c.site))).toEqual(
      [...b.leafLayouts.values()].flatMap((l) => l.cells.map((c) => c.site)),
    );
  });
});

describe("createTreemapState — multi-level boundaries", () => {
  function deepGraph(): AtlasGraph {
    const file = (id: string, loc: number) => ({
      id,
      kind: "file" as const,
      label: id.split("/").pop()!,
      metrics: { loc },
    });
    return {
      nodes: [
        file("src/alpha/core/a.ts", 100),
        file("src/alpha/core/b.ts", 60),
        file("src/alpha/util/c.ts", 40),
        file("src/alpha/root.ts", 30),
        file("src/beta/core/d.ts", 150),
        file("src/beta/core/e.ts", 50),
      ],
      edges: [
        { source: "src/alpha/core/a.ts", target: "src/alpha/core/b.ts" },
        { source: "src/alpha/core/a.ts", target: "src/alpha/util/c.ts" },
        { source: "src/alpha/util/c.ts", target: "src/beta/core/d.ts" },
      ],
    };
  }
  const BOUNDARIES = [moduleGrouping(), directoryGrouping(3)];

  it("solves every boundary level at creation", () => {
    const state = createTreemapState(deepGraph(), {
      ...OPTIONS,
      boundaries: BOUNDARIES,
    });
    expect(state.levels.map((l) => l.kind)).toEqual(["module", "directory"]);
    expect([...state.levels[1]!.cells.keys()].sort()).toEqual([
      "src/alpha/(root)",
      "src/alpha/core",
      "src/alpha/util",
      "src/beta/core",
    ]);
  });

  it("nests directory cells inside their module cell", () => {
    const state = createTreemapState(deepGraph(), {
      ...OPTIONS,
      boundaries: BOUNDARIES,
    });
    for (const [dirId, dirCell] of state.levels[1]!.cells) {
      const moduleId = state.parentOf.get(dirId)!;
      const moduleCell = state.levels[0]!.cells.get(moduleId)!;
      expect(containsPoint(moduleCell.polygon, dirCell.site)).toBe(true);
    }
  });

  it("keys leaf layouts by the innermost group and confines leaves", () => {
    const state = settled(createTreemapState(deepGraph(), { ...OPTIONS, boundaries: BOUNDARIES }));
    expect(state.leafLayouts.has("src/alpha/core")).toBe(true);
    expect(state.leafLayouts.has("src/alpha")).toBe(false);
    for (const [dirId, layout] of state.leafLayouts) {
      const dirCell = state.levels[1]!.cells.get(dirId)!;
      for (const cell of layout.cells) {
        expect(containsPoint(dirCell.polygon, cell.site)).toBe(true);
      }
    }
  });

  it("keeps the full parent chain for bundling and selection", () => {
    const state = createTreemapState(deepGraph(), {
      ...OPTIONS,
      boundaries: BOUNDARIES,
    });
    expect(state.parentOf.get("src/alpha/core/a.ts")).toBe("src/alpha/core");
    expect(state.parentOf.get("src/alpha/core")).toBe("src/alpha");
    expect(state.parentOf.get("src/alpha")).toBeNull();
    expect(state.kindOf.get("src/alpha/core")).toBe("directory");
  });
});

describe("stepTreemapState", () => {
  it("reports active until leaf layouts converge, then settles", () => {
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
    for (const layout of state.leafLayouts.values()) {
      expect(layout.maxRelativeError).toBeLessThan(0.02);
    }
  });
});

describe("applyTreemapChanges", () => {
  it("keeps leaf layouts warm when a file weight changes", () => {
    const graph = sampleGraph();
    const state = settled(createTreemapState(graph, OPTIONS));
    const mutated = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "src/alpha/a.ts" ? { ...n, metrics: { loc: Math.round(n.metrics.loc * 1.3) } } : n,
      ),
    };
    const next = applyTreemapChanges(state, mutated, OPTIONS);
    expect(next.leafLayouts.size).toBe(state.leafLayouts.size);
    for (const [groupId, layout] of next.leafLayouts) {
      const before = state.leafLayouts.get(groupId)!;
      expect(layout.cells.map((c) => c.id).sort()).toEqual(before.cells.map((c) => c.id).sort());
    }
  });

  it("moves surviving sites less than a cold rebuild would", () => {
    const graph = sampleGraph();
    const state = settled(createTreemapState(graph, OPTIONS));
    const mutated = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "src/beta/d.ts" ? { ...n, metrics: { loc: Math.round(n.metrics.loc * 1.4) } } : n,
      ),
    };
    const siteOf = (s: TreemapState, id: string) => {
      for (const layout of s.leafLayouts.values()) {
        const cell = layout.cells.find((c) => c.id === id);
        if (cell) return cell.site;
      }
      throw new Error(`missing ${id}`);
    };
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const warm = settled(applyTreemapChanges(state, mutated, OPTIONS));
    const cold = settled(createTreemapState(mutated, { ...OPTIONS, seed: 9 }));
    let warmShift = 0;
    let coldShift = 0;
    for (const node of graph.nodes) {
      warmShift += dist(siteOf(state, node.id), siteOf(warm, node.id));
      coldShift += dist(siteOf(state, node.id), siteOf(cold, node.id));
    }
    expect(warmShift).toBeLessThan(coldShift * 0.5);
  });

  it("drops removed files and their group when it empties", () => {
    const graph = sampleGraph();
    const state = settled(createTreemapState(graph, OPTIONS));
    const without = {
      ...graph,
      nodes: graph.nodes.filter((n) => !n.id.startsWith("src/gamma/")),
      edges: graph.edges.filter(
        (e) => !e.source.startsWith("src/gamma/") && !e.target.startsWith("src/gamma/"),
      ),
    };
    const next = applyTreemapChanges(state, without, OPTIONS);
    expect(next.leafLayouts.has("src/gamma")).toBe(false);
    expect(next.levels[0]!.cells.has("src/gamma")).toBe(false);
  });

  it("admits new files into an existing group", () => {
    const graph = sampleGraph();
    const state = settled(createTreemapState(graph, OPTIONS));
    const grown = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: "src/alpha/new.ts",
          kind: "file" as const,
          label: "new.ts",
          metrics: { loc: 60 },
        },
      ],
    };
    const next = settled(applyTreemapChanges(state, grown, OPTIONS));
    const layout = next.leafLayouts.get("src/alpha")!;
    expect(layout.cells.map((c) => c.id)).toContain("src/alpha/new.ts");
    const groupCell = next.levels[0]!.cells.get("src/alpha")!;
    for (const cell of layout.cells) {
      expect(containsPoint(groupCell.polygon, cell.site)).toBe(true);
    }
  });

  it("re-solves intermediate boundary levels inside their new parents", () => {
    const file = (id: string, loc: number) => ({
      id,
      kind: "file" as const,
      label: id.split("/").pop()!,
      metrics: { loc },
    });
    const graph = {
      nodes: [
        file("src/alpha/core/a.ts", 100),
        file("src/alpha/util/b.ts", 50),
        file("src/beta/core/c.ts", 120),
      ],
      edges: [],
    };
    const boundaries = [moduleGrouping(), directoryGrouping(3)];
    const state = settled(createTreemapState(graph, { ...OPTIONS, boundaries }));
    const mutated = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "src/alpha/core/a.ts" ? { ...n, metrics: { loc: 180 } } : n,
      ),
    };
    const next = applyTreemapChanges(state, mutated, { ...OPTIONS, boundaries });
    expect(next.levels.map((l) => l.kind)).toEqual(["module", "directory"]);
    for (const [dirId, dirCell] of next.levels[1]!.cells) {
      const moduleCell = next.levels[0]!.cells.get(next.parentOf.get(dirId)!)!;
      expect(containsPoint(moduleCell.polygon, dirCell.site)).toBe(true);
    }
  });
});
