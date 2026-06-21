import type { CellResult, Vec2 } from "@sprawlens/layout";
import type { AtlasEdge, SymbolKind, TestStatus } from "@sprawlens/schema";
import type { CfgEntry } from "../CfgLayer.tsx";
import type { TiltParams } from "../Controls.tsx";
import type { SolvedLayer } from "../layerModel.ts";
import type { RingsState } from "../ringsController.ts";
import type { TreemapState } from "../treemapController.ts";
import type { FocusRequest, FocusView } from "../useMapViewport.ts";

/**
 * The renderer boundary. The engine produces a {@link MapScene} (renderer-
 * agnostic, world-space geometry + visual state) and the host wires
 * {@link MapHandlers} (semantic interaction events) back to it. A renderer is
 * anything that turns the two into a view — the SVG renderer today, a TUI or a
 * three.js renderer later, all behind {@link MapRenderer}.
 *
 * Deliberately *not* in the scene: viewport culling, screen-space font/units,
 * and pointer hit-testing. Those are renderer concerns — the scene stays pure
 * geometry so a non-DOM renderer can reuse it unchanged.
 */

/** Interaction events a renderer raises; the host binds them to engine actions. */
export type MapHandlers = {
  /** Primary selection (the multi-select's last/anchor element). */
  selectedId: string | null;
  /** Full multi-selection (shift+click). */
  selectedIds: Set<string>;
  /** Picked dependency edges. */
  selectedEdges: { source: string; target: string }[];
  /** Pending camera fly-to request (consumed by the renderer's viewport). */
  focusRequest: FocusRequest | null;
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectEdge: (source: string, target: string, additive?: boolean) => void;
  onFocusId: (id: string) => void;
  onTiltDrag: (dxPx: number, dyPx: number) => void;
  onViewSettle: (center: Vec2, zoom: number) => void;
  /** Pointer entered (id + client coords) or left (both null) a symbol cell,
   * for the LSP hover tooltip the host fetches and positions. */
  onSymbolHover?: (symbolId: string | null, screen: Vec2 | null) => void;
};

/** Visual state every renderer draws, independent of the layout that placed it. */
type SceneCommon = {
  innerCells: CellResult[];
  fileEdges: AtlasEdge[];
  showEdges: boolean;
  visibleLevels: ReadonlySet<string>;
  cfgEntries: CfgEntry[];
  cyclicIds: Set<string>;
  labels: Map<string, string>;
  exportedIds: Set<string>;
  symbolKindOf: (id: string) => SymbolKind | undefined;
  focus: FocusView | null;
  testFileIds: Set<string>;
  layers: SolvedLayer[];
  altEdges: boolean;
  parentFileOf: (id: string) => string;
  changedOf: (id: string) => "added" | "modified" | undefined;
  /** Runtime-trace overlay: the executed call path (symbol→symbol), drawn as a
   * solid warm path; empty when no trace was ingested. Shared across layouts. */
  traceEdges: AtlasEdge[];
  /** Per-symbol execution heat in [0,1] (self time / samples), for tinting hot
   * cells. Empty when no trace was ingested. */
  traceHeat: Map<string, number>;
  /** Test reporter overlay: test-case id → status, tinting the test-plane cells
   * pass/fail/skip. Empty when no test run was ingested. Shared across layouts. */
  testStatus: Map<string, TestStatus>;
  /** Test-case id → duration in ms, appended to the case label. */
  testDuration: Map<string, number>;
  /** World-space canvas extent (rings is fixed; treemap follows the viewport). */
  width: number;
  height: number;
  tilt: TiltParams;
  /** Minimum on-screen px a label needs to be drawn (slider-tunable). */
  labelMinPx: number;
  /** Label font-size multiplier (slider-tunable). */
  labelScale: number;
};

/** Rings-specific affordances (concentric module layout, API ports, symbol net). */
type RingsScene = {
  kind: "rings";
  rings: RingsState;
  symbolEdges: AtlasEdge[];
  /** Call-hierarchy overlay for the selection (from the provider's detail
   * backend — LSP / tree-sitter / moon ide); drawn dashed. */
  detailEdges: AtlasEdge[];
  showFiles: boolean;
  compactModuleLabels: boolean;
  cyclicModuleIds: Set<string>;
  portNodes: { id: string; label: string; x: number; y: number }[];
  hiddenLayers: Set<string>;
};

/** Treemap-specific affordances (rectangular subdivision). */
type TreemapScene = {
  kind: "treemap";
  state: TreemapState;
  leafKind: "file" | "symbol";
};

/**
 * A solved map ready to draw: shared visual state plus the layout-specific
 * geometry, tagged by `kind` so a renderer can switch on it.
 */
export type MapScene = SceneCommon & (RingsScene | TreemapScene);

/** A renderer: scene + handlers → a view. SVG today; the signature is the spec. */
type MapRenderer = (
  props: { scene: MapScene } & MapHandlers,
) => import("preact").VNode | null;
