import { describe, expect, it } from "vitest";
import { buildScene, type SceneInput } from "./buildScene.ts";

const base: SceneInput = {
  rings: null,
  treemap: null,
  granularity: "file",
  innerCells: [{ id: "c" } as never],
  displayEdges: [{ source: "a", target: "b" }],
  graphEdges: [{ source: "x", target: "y" }],
  symbolEdges: [{ source: "s", target: "t" }],
  detailEdges: [],
  traceEdges: [],
  traceHeat: new Map(),
  testStatus: new Map(),
  testDuration: new Map(),
  visibleLevels: new Set(["file"]),
  cfgEntries: [],
  cyclicIds: new Set(),
  cyclicModuleIds: new Set(),
  labels: new Map(),
  exportedIds: new Set(),
  symbolKindOf: () => undefined,
  focus: null,
  testFileIds: new Set(),
  layers: [],
  altEdges: false,
  parentFileOf: (id) => id,
  changedOf: () => undefined,
  portNodes: [],
  hiddenLayers: new Set(),
  showEdges: false,
  tilt: { enabled: false, theta: 0, pitch: 0, layers: {}, gap: 0 },
  labelMinPx: 9,
  labelScale: 1,
  ringsExtent: { width: 960, height: 640 },
  treemapExtent: { width: 800, height: 600 },
};

describe("buildScene", () => {
  it("returns null when no layout is solved", () => {
    expect(buildScene(base)).toBeNull();
  });

  it("builds a rings scene with the fixed canvas and base edges at file granularity", () => {
    const scene = buildScene({ ...base, rings: {} as never });
    expect(scene?.kind).toBe("rings");
    expect(scene?.width).toBe(960);
    expect(scene?.edges.file).toBe(base.graphEdges);
    expect(scene?.edges.symbol).toBe(base.symbolEdges);
    expect(scene?.showEdges).toBe(false); // file granularity, showEdges off
  });

  it("forces edges on and uses display edges at symbol granularity (rings)", () => {
    const scene = buildScene({ ...base, rings: {} as never, granularity: "symbol" });
    expect(scene?.showEdges).toBe(true);
    expect(scene?.edges.file).toBe(base.displayEdges);
    expect(scene?.innerCells).toEqual([]); // symbols aren't file-nested leaves
    expect(scene?.kind === "rings" ? scene.compactModuleLabels : false).toBe(true);
  });

  it("builds a treemap scene following the viewport extent", () => {
    const scene = buildScene({ ...base, treemap: {} as never, granularity: "symbol" });
    expect(scene?.kind).toBe("treemap");
    expect(scene?.width).toBe(800);
    expect(scene?.kind === "treemap" ? scene.leafKind : null).toBe("symbol");
  });

  it("prefers rings when both layouts are present", () => {
    expect(buildScene({ ...base, rings: {} as never, treemap: {} as never })?.kind).toBe("rings");
  });
});
