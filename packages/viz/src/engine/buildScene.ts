import type { CellResult } from "@sprawlens/layout";
import type { AtlasEdge, SymbolKind } from "@sprawlens/schema";
import type { CfgEntry } from "../CfgLayer.tsx";
import type { TiltParams } from "../Controls.tsx";
import type { SolvedLayer } from "../layerModel.ts";
import type { RingsState } from "../ringsController.ts";
import type { TreemapState } from "../treemapController.ts";
import type { Granularity } from "../viewConfig.ts";
import type { FocusView } from "../useMapViewport.ts";
import type { MapScene } from "../renderer/contract.ts";

/**
 * Raw engine state the scene is derived from. Deliberately renderer-agnostic:
 * no DOM, no React. `buildScene` applies the granularity rules (what counts as
 * a leaf, which edge set to draw, which affordances each layout exposes) so
 * that derivation lives in one testable place rather than inline in the view.
 */
export type SceneInput = {
  rings: RingsState | null;
  treemap: TreemapState | null;
  granularity: Granularity;
  innerCells: CellResult[];
  /** Edges of the display graph (symbol granularity) and the base graph. */
  displayEdges: AtlasEdge[];
  graphEdges: AtlasEdge[];
  symbolEdges: AtlasEdge[];
  detailEdges: AtlasEdge[];
  /** Runtime-trace overlay (symbol→symbol call path) + per-symbol heat [0,1]. */
  traceEdges: AtlasEdge[];
  traceHeat: Map<string, number>;
  visibleLevels: ReadonlySet<string>;
  cfgEntries: CfgEntry[];
  cyclicIds: Set<string>;
  cyclicModuleIds: Set<string>;
  labels: Map<string, string>;
  exportedIds: Set<string>;
  symbolKindOf: (id: string) => SymbolKind | undefined;
  focus: FocusView | null;
  testFileIds: Set<string>;
  layers: SolvedLayer[];
  altEdges: boolean;
  parentFileOf: (id: string) => string;
  changedOf: (id: string) => "added" | "modified" | undefined;
  portNodes: { id: string; label: string; x: number; y: number }[];
  hiddenLayers: Set<string>;
  /** `params.showEdges` toggle (symbol granularity forces edges on for rings). */
  showEdges: boolean;
  tilt: TiltParams;
  labelMinPx: number;
  labelScale: number;
  /** Rings keep a fixed canvas; the treemap follows the viewport. */
  ringsExtent: { width: number; height: number };
  treemapExtent: { width: number; height: number };
};

/**
 * Assemble the renderer-agnostic {@link MapScene} from engine state, or null
 * when no layout is solved yet. Rings takes precedence when both exist.
 */
export function buildScene(i: SceneInput): MapScene | null {
  const common = {
    innerCells: i.granularity === "file" ? i.innerCells : [],
    fileEdges: i.granularity === "symbol" ? i.displayEdges : i.graphEdges,
    visibleLevels: i.visibleLevels,
    cfgEntries: i.cfgEntries,
    cyclicIds: i.cyclicIds,
    labels: i.labels,
    exportedIds: i.exportedIds,
    symbolKindOf: i.symbolKindOf,
    focus: i.focus,
    testFileIds: i.testFileIds,
    layers: i.layers,
    altEdges: i.altEdges,
    parentFileOf: i.parentFileOf,
    changedOf: i.changedOf,
    // symbol-keyed overlay; renders wherever symbol cells exist, no-ops at
    // module granularity (no cells to anchor to)
    traceEdges: i.traceEdges,
    traceHeat: i.traceHeat,
    tilt: i.tilt,
    labelMinPx: i.labelMinPx,
    labelScale: i.labelScale,
  };
  if (i.rings) {
    return {
      ...common,
      kind: "rings",
      rings: i.rings,
      showEdges: i.showEdges || i.granularity === "symbol",
      width: i.ringsExtent.width,
      height: i.ringsExtent.height,
      symbolEdges: i.granularity === "symbol" ? i.displayEdges : i.symbolEdges,
      detailEdges: i.detailEdges,
      showFiles: i.granularity !== "module" && i.visibleLevels.has(i.granularity),
      compactModuleLabels: i.granularity === "symbol",
      cyclicModuleIds: i.cyclicModuleIds,
      portNodes: i.portNodes,
      hiddenLayers: i.hiddenLayers,
    };
  }
  if (i.treemap) {
    return {
      ...common,
      kind: "treemap",
      state: i.treemap,
      showEdges: i.showEdges,
      width: i.treemapExtent.width,
      height: i.treemapExtent.height,
      leafKind: i.granularity === "symbol" ? "symbol" : "file",
    };
  }
  return null;
}
