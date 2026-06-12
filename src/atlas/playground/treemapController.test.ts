import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "../contracts/graph.js";
import { directoryGrouping, moduleGrouping } from "../contracts/hierarchy.js";
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
    expect(
      [...a.leafLayouts.values()].flatMap((l) => l.cells.map((c) => c.site)),
    ).toEqual(
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
    const state = settled(
      createTreemapState(deepGraph(), { ...OPTIONS, boundaries: BOUNDARIES }),
    );
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
