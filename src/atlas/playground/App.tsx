import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AtlasGraph, AtlasNode, SymbolKind } from "../contracts/graph.js";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
  type ClipRegion,
} from "../kernel/capacityLayout.js";
import { centroid, containsPoint, type Ring } from "../kernel/polygon.js";
import { createRng, type Rng } from "../kernel/rng.js";
import { Controls, type PlaygroundParams } from "./Controls.tsx";
import {
  INK,
  makeTopAncestorOf,
  MAP_BG,
  MUTED_INK,
  PAGE_BG,
  PANEL_BG,
  PANEL_BORDER,
  SELECT_STROKE,
  setMapTheme,
} from "./mapShared.tsx";
import {
  snapshotSymbolEdges,
  snapshotSymbols,
  snapshotToAtlasGraph,
  type SnapshotLike,
} from "./fixtureAdapter.ts";
import { sprawlensSnapshot } from "./fixtures/sprawlens.ts";
import {
  applyRingsChanges,
  createRingsState,
  stepRingsState,
  type RingsState,
} from "./ringsController.ts";
import {
  applyTreemapChanges,
  createTreemapState,
  stepTreemapState,
  type TreemapState,
} from "./treemapController.ts";
import { TreemapSvg } from "./TreemapSvg.tsx";
import { reachSubgraph } from "../kernel/reach.js";
import { cyclicComponents } from "../kernel/scc.js";
import {
  RingsMapSvg,
  type FocusRequest,
  type FocusView,
} from "./RingsMapSvg.tsx";
import {
  createSyntheticGraph,
  synthesizeSymbolEdges,
  synthesizeSymbols,
} from "./synthetic.ts";
import type { AtlasEdge } from "../contracts/graph.js";
import {
  classIdOf,
  directoryGrouping,
  moduleGrouping,
  parentFileOf as contractParentFileOf,
  type Grouping,
} from "../contracts/hierarchy.js";
import { defaultLayerOf, matchTestTargets } from "../contracts/layers.js";
import { defaultModuleIdOf } from "../contracts/modules.js";
import {
  apiModuleIdOf,
  applySymbolBudget,
  buildApiGraph,
  splitApiBoundary,
} from "./apiView.ts";
import {
  granularityOf,
  hiddenLayersOf,
  reweightByTransitiveComplexity,
  showsSymbolLevels,
} from "./viewConfig.ts";
import { fetchCallHierarchy, refsToEdges } from "./callHierarchyClient.ts";
import { cfgRequestOf, fetchCfg } from "./cfgClient.ts";
import type { CfgEntry } from "./CfgLayer.tsx";
import type { DetailGraph } from "../contracts/detail.js";
import { diffGraphs, isEmptyDelta } from "../contracts/delta.js";
import {
  buildHistoryIndex,
  type HistoryEntry,
  type HistoryIndex,
} from "./history.ts";

const WIDTH = 960;
const HEIGHT = 640;
const SYMBOL_KIND_SET: ReadonlySet<string> = new Set([
  "function",
  "class",
  "variable",
  "type",
  "interface",
  "enum",
  "method",
  "property",
  "static-method",
  "static-property",
]);
/** Module⊃symbol view lays out at most this many symbol cells; the rest
 * fold into per-module "(module scope)" fillers. A monorepo has thousands
 * of symbols — laying them all out is slow to converge and heavy to draw. */
const SYMBOL_BUDGET = 600;
/** Upper bound on the zoom-scaled symbol budget (perf cap on cell count). */
const SYMBOL_BUDGET_MAX = 2500;
/** The selected symbol's CFG draws once its cell fills this many px. */
const CFG_MIN_PX = 64;
const CONVERGENCE_TOLERANCE = 0.02;
/** Zoom past this implicitly focuses the crosshair target (no selection). */
/** Call-hierarchy roots kept in memory; older unselected ones evict. */
const LSP_CACHE_MAX = 8;
/** Solver parameters: long-stable knobs, hardcoded out of the UI. */
const SEED = 1;
const SYNTH_COUNT = 120;
const ADAPTATION_RATE = 0.8;
const LLOYD_RATE = 0.7;
const STEPS_PER_FRAME = 2;
/** Directory boundary: dirname truncated to this many path segments. */
const DIRECTORY_DEPTH = 3;
/** Top-level include scope of a node: the first path segment ("src",
 * "e2e"), or "(root)" for files at the repository root. Deliberately does
 * NOT descend into subdirectories — scopes are coarse areas, the finer
 * exclusions belong to test/local. */
function scopeOf(id: string): string {
  const file = contractParentFileOf(id);
  const slash = file.indexOf("/");
  return slash < 0 ? "(root)" : file.slice(0, slash);
}

/** ?debug=1 reveals the graph-mutation experiment buttons. */
const DEBUG =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("debug");

/** Shrink a convex ring toward its centroid so nested cells stay visually inside. */
function insetRing(ring: Ring, factor: number): Ring {
  const c = centroid(ring);
  return ring.map((p) => ({
    x: c.x + (p.x - c.x) * factor,
    y: c.y + (p.y - c.y) * factor,
  }));
}

/** Collapsible panel section; user toggles survive re-renders via state. */
function Section(props: {
  title: string;
  children: preact.ComponentChildren;
  defaultOpen?: boolean;
  style?: Record<string, string | number>;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{
        background: MAP_BG,
        color: INK,
        borderRadius: "6px",
        border: `1px solid ${PANEL_BORDER}`,
        padding: "6px 8px",
        minWidth: "0",
        maxHeight: "100%",
        boxSizing: "border-box",
        overflowY: "auto",
        ...props.style,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "12px",
          userSelect: "none",
        }}
      >
        {props.title}
      </summary>
      <div style={{ paddingTop: "6px" }}>{props.children}</div>
    </details>
  );
}

type PanelPosition = "auto" | "right" | "bottom";

export function App() {
  const [params, setParams] = useState<PlaygroundParams>({
    source: "sprawlens",
    layout: "treemap",
    boundaries: ["module"],
    dark:
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-color-scheme: dark)").matches,
    displayLevels: ["module", "symbol"],
    omit: ["local"],
    omitModules: [],
    weight: "loc",
    followChanges: true,
    diffBase: "",
    // ambient edges add noise; macro module deps are opt-in via this toggle
    showEdges: false,
  });
  // multi-select: ordered ids, last one is the primary (drives the detail
  // panel, breadcrumb, and labels); shift+click toggles membership
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // edges are selectable elements alongside nodes; a selection can hold both.
  // shift+click toggles membership (see selectNode / selectEdge), a plain
  // click on either replaces the whole selection.
  const [selectedEdges, setSelectedEdges] = useState<
    { source: string; target: string }[]
  >([]);
  const edgeKey = (e: { source: string; target: string }) =>
    `${e.source} ${e.target}`;
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const setSelectedId = (id: string | null) => {
    setSelectedEdges([]);
    setSelectedIds(id === null ? [] : [id]);
  };
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [viewInfo, setViewInfo] = useState({
    x: WIDTH / 2,
    y: HEIGHT / 2,
    zoom: 1,
  });
  const viewInfoRef = useRef(viewInfo);
  viewInfoRef.current = viewInfo;
  const [, setFrame] = useState(0);
  // DevTools-style panel docking: auto follows the window aspect ratio
  const [panelPos, setPanelPos] = useState<PanelPosition>("auto");
  const [landscape, setLandscape] = useState(
    window.innerWidth > window.innerHeight * 1.1,
  );
  useEffect(() => {
    const onResize = () =>
      setLandscape(window.innerWidth > window.innerHeight * 1.1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const panelSide: "right" | "bottom" =
    panelPos === "auto" ? (landscape ? "right" : "bottom") : panelPos;

  const graphRef = useRef<AtlasGraph>(null as unknown as AtlasGraph);
  const ringsRef = useRef<RingsState | null>(null);
  const treemapRef = useRef<TreemapState | null>(null);
  /** Frames since the last repaint commit while a big map converges. */
  const repaintSkipRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  // The OS color scheme drives dark mode: the initial value reads it, and
  // this listener keeps the map in sync when the system flips (e.g. an auto
  // day/night switch) — unless the user has taken manual control, which then
  // wins until reload.
  const darkOverriddenRef = useRef(false);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onSchemeChange = (event: MediaQueryListEvent) => {
      if (darkOverriddenRef.current) return;
      setParams((prev) =>
        prev.dark === event.matches ? prev : { ...prev, dark: event.matches },
      );
    };
    query.addEventListener("change", onSchemeChange);
    return () => query.removeEventListener("change", onSchemeChange);
  }, []);
  /** Controls edits flow through here so a manual dark toggle pins the
   * theme and stops the system listener from overriding it. */
  const onControlsChange = (next: PlaygroundParams) => {
    if (next.dark !== paramsRef.current.dark) darkOverriddenRef.current = true;
    setParams(next);
  };
  // The treemap lays out at the viewport's real pixel size so the map
  // maximizes the screen; resizes re-solve the layout, so they throttle
  // to one rebuild per pause. Rings keep the fixed canvas (radial scale).
  const [mapSize, setMapSize] = useState({ width: WIDTH, height: HEIGHT });
  const mapSizeRef = useRef(mapSize);
  mapSizeRef.current = mapSize;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = mapContainerRef.current;
    if (!element) return;
    let timer = 0;
    const apply = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(240, Math.round(rect.height));
      setMapSize((prev) =>
        Math.abs(prev.width - width) < 2 && Math.abs(prev.height - height) < 2
          ? prev
          : { width, height },
      );
    };
    apply();
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(apply, 250);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);
  // swap the live-binding palette before any child reads it this render
  setMapTheme(params.dark);
  /** Leaf unit, derived from the checked display levels. */
  const granularity = granularityOf(params.boundaries, params.displayLevels);
  const mutationRng = useRef<Rng>(createRng(0xc0ffee));
  const nextNodeId = useRef(0);
  const innerLayoutsRef = useRef(new Map<string, CapacityLayoutState>());
  /** Real per-file symbols when a fixture is loaded; null = synthesize. */
  const symbolsRef = useRef<Map<string, AtlasNode[]> | null>(null);
  /** Symbol references (call-hierarchy precursor); endpoints: symbol or file ids. */
  const symbolEdgesRef = useRef<AtlasEdge[]>([]);
  /** Per-symbol metadata accumulated as nested layouts materialize. */
  const symbolMetaRef = useRef(
    new Map<
      string,
      { exported: boolean; fileId: string; kind?: SymbolKind }
    >(),
  );
  /** Lazily fetched large fixture (served from public-atlas/). */
  const playwrightSnapRef = useRef<SnapshotLike | null>(null);
  /** Git-log history fixture and the commit currently on display. */
  const commitsRef = useRef<HistoryEntry[] | null>(null);
  const historyIndexRef = useRef<HistoryIndex | null>(null);
  const commitIndexRef = useRef(-1);
  const changedFilesRef = useRef(new Map<string, "added" | "modified">());
  const lastDiffRef = useRef({ added: 0, modified: 0, removed: 0 });
  /** Symbols whose call hierarchy was already fetched from the LSP server. */
  const fetchedHierarchyRef = useRef(new Set<string>());
  /** LSP call-hierarchy edges per fetched root; bounded, display-only. */
  const lspEdgesRef = useRef(new Map<string, AtlasEdge[]>());
  const [hierarchyVersion, setHierarchyVersion] = useState(0);
  // Graph-derived lookups, rebuilt only when the graph changes. Recomputing
  // these per render allocated heavily and drove major-GC pauses during
  // zoom gestures (lightbringer drilldown: GC marking dominated the spans).
  const locOfRef = useRef(new Map<string, number>());
  /** What the layout currently displays (file graph or API projection). */
  const displayGraphRef = useRef<AtlasGraph>({ nodes: [], edges: [] });
  /** Full weighted symbol graph (pre-budget), cached so focus re-budgeting
   * skips the transitive-weight recompute. */
  const apiFullRef = useRef<AtlasGraph>({ nodes: [], edges: [] });
  /** API view: module id → boundary ports, and port id → consumer modules. */
  const apiBoundaryRef = useRef(new Map<string, AtlasNode[]>());
  const apiPortPartnersRef = useRef(new Map<string, Set<string>>());
  const portNodesRef = useRef<
    { id: string; label: string; x: number; y: number }[]
  >([]);
  const labelsRef = useRef(new Map<string, string>());
  const exportedIdsRef = useRef(new Set<string>());
  const testFileIdsRef = useRef(new Set<string>());
  const testTargetsRef = useRef(new Map<string, string>());
  /** Flattened inner cells, rebuilt only when a nested layout changed. */
  const innerCellsRef = useRef<CellResult[]>([]);
  const innerDirtyRef = useRef(true);

  const refreshGraphLookups = () => {
    const graph = graphRef.current;
    locOfRef.current = new Map(graph.nodes.map((n) => [n.id, n.metrics.loc]));
    testFileIdsRef.current = new Set(
      graph.nodes
        .filter((n) => defaultLayerOf(n.id) === "test")
        .map((n) => n.id),
    );
    testTargetsRef.current = matchTestTargets(graph);
    const labels = labelsRef.current;
    for (const node of graph.nodes) labels.set(node.id, node.label);
  };

  /** Subdivision rings above the leaf (module ⊃ directory); the leaf and
   * file outlines live on the display axis, not here. */
  const boundariesOf = (p: PlaygroundParams): Grouping[] => {
    // "class" is NOT a layout boundary: nesting members under a class district
    // froze them into a solved-once partition that marginalised the
    // surrounding symbols (low-loc groups pushed to the rim). Class membership
    // is now a non-displacing overlay (ClassOverlayLayer) instead.
    const groupings = p.boundaries.flatMap((level): Grouping[] => {
      if (level === "module") return [moduleGrouping()];
      if (level === "directory") return [directoryGrouping(DIRECTORY_DEPTH)];
      return [];
    });
    return groupings.length > 0 ? groupings : [moduleGrouping()];
  };
  /** The class overlay is driven by the (now layout-free) "class" toggle. */
  const showClassOverlay = params.boundaries.includes("class");

  const ringsOptions = (p: PlaygroundParams) => ({
    width: WIDTH,
    height: HEIGHT,
    seed: SEED,
    adaptationRate: ADAPTATION_RATE,
    lloydRate: LLOYD_RATE,
    boundaries: boundariesOf(p),
  });

  const treemapOptions = (p: PlaygroundParams) => ({
    width: mapSizeRef.current.width,
    height: mapSizeRef.current.height,
    seed: SEED,
    adaptationRate: ADAPTATION_RATE,
    lloydRate: LLOYD_RATE,
    boundaries: boundariesOf(p),
  });

  const symbolsForFile = (fileId: string): AtlasNode[] => {
    const real = symbolsRef.current?.get(fileId);
    if (real) return real;
    const loc = graphRef.current.nodes.find((n) => n.id === fileId)?.metrics
      .loc;
    return loc === undefined ? [] : synthesizeSymbols(fileId, loc, 1);
  };

  /**
   * Budget priority for a symbol in the module⊃symbol view: its area
   * weight scaled by how close its module sits to the focus center. The
   * proximity radius shrinks with zoom, so zooming into a district pulls
   * its symbols into the budget (semantic zoom) while distant ones fold
   * into fillers. Module centers come from the current layout; with none
   * yet (cold) it falls back to pure area.
   */
  const symbolPriorityOf = (symbolId: string, weight: number): number => {
    const rings = ringsRef.current;
    if (!rings) return weight;
    const circle = rings.circles.get(apiModuleIdOf(symbolId));
    if (!circle) return weight;
    const view = viewInfoRef.current;
    const dx = circle.cx - view.x;
    const dy = circle.cy - view.y;
    const radius = (WIDTH / Math.max(view.zoom, 0.2)) * 0.6;
    const proximity = 1 / (1 + (dx * dx + dy * dy) / (radius * radius));
    // sqrt flattens the area weight so small members aren't crushed by large
    // siblings once a district is in focus — proximity then carries the LOD
    return Math.sqrt(weight) * proximity;
  };

  /**
   * Apply the focus-weighted symbol budget to the cached full api graph
   * and wire the resulting network up (labels, boundary ports). Returns
   * the internal symbols the layout subdivides. Cheap — no transitive
   * weights — so it runs on every focus change.
   */
  const budgetedApiGraph = (full: AtlasGraph): AtlasGraph => {
    // semantic zoom: the budget grows as you zoom in. Off-screen districts
    // fold via proximity, so the larger budget is spent on the focused
    // district — deep enough and all of its members surface.
    const budget = Math.min(
      SYMBOL_BUDGET_MAX,
      Math.round(SYMBOL_BUDGET * Math.max(1, viewInfoRef.current.zoom)),
    );
    const api = applySymbolBudget(full, {
      budget,
      priorityOf: symbolPriorityOf,
    });
    for (const node of api.nodes) labelsRef.current.set(node.id, node.label);
    displayGraphRef.current = api;
    const split = splitApiBoundary(api, apiModuleIdOf, symbolEdgesRef.current);
    apiBoundaryRef.current = split.boundaryByModule;
    const partners = new Map<string, Set<string>>();
    for (const edge of api.edges) {
      const sourceModule = apiModuleIdOf(edge.source);
      if (sourceModule === apiModuleIdOf(edge.target)) continue;
      let set = partners.get(edge.target);
      if (!set) {
        set = new Set();
        partners.set(edge.target, set);
      }
      set.add(sourceModule);
    }
    apiPortPartnersRef.current = partners;
    // ports leave the cell layout; only internals get areas
    return split.internal;
  };

  /** Graph minus hidden display levels — what the layout subdivides. */
  const effectiveGraph = (p: PlaygroundParams): AtlasGraph => {
    let graph = graphRef.current;
    const hiddenLayers = hiddenLayersOf(p.omit);
    const omitScopes = new Set(p.omitModules);
    if (hiddenLayers.length || omitScopes.size) {
      const hidden = new Set(hiddenLayers);
      const nodes = graph.nodes.filter(
        (n) =>
          !hidden.has(defaultLayerOf(n.id)) && !omitScopes.has(scopeOf(n.id)),
      );
      const ids = new Set(nodes.map((n) => n.id));
      graph = {
        nodes,
        edges: graph.edges.filter(
          (e) => ids.has(e.source) && ids.has(e.target),
        ),
      };
    }
    if (granularityOf(p.boundaries, p.displayLevels) === "symbol") {
      // the full weighted symbol graph is focus-independent: build it once
      // (transitive weights over thousands of symbols is the costly part)
      // and cache it, so re-budgeting as the camera moves is just a sort
      const full = buildApiGraph(graph, symbolsForFile, symbolEdgesRef.current, {
        includePrivate: !p.omit.includes("local"),
        weight: p.weight,
      });
      apiFullRef.current = full;
      return budgetedApiGraph(full);
    }
    // file/module granularity: weight swaps in place — PageRank areas
    // follow how depended-upon a file is instead of its size
    if (p.weight === "complexity") {
      graph = reweightByTransitiveComplexity(graph);
    }
    displayGraphRef.current = graph;
    return graph;
  };

  /**
   * Per-frame sync: each file cell hosts a nested symbol layout clipped to
   * it. Work is time-budgeted with a rotating cursor so monorepo-scale maps
   * (1000+ files) never block the main thread; cells catch up over frames.
   */
  const innerCursorRef = useRef(0);
  const syncInnerLayouts = (
    outerCells: CellResult[],
    outerMoved: boolean,
    budgetMs: number,
  ) => {
    const inner = innerLayoutsRef.current;
    // deletions only happen after graph changes; skip the per-tick set churn
    if (inner.size > outerCells.length) {
      const alive = new Set<string>();
      for (const cell of outerCells) alive.add(cell.id);
      for (const id of [...inner.keys()]) {
        if (!alive.has(id)) {
          inner.delete(id);
          innerDirtyRef.current = true;
        }
      }
    }
    const locOf = locOfRef.current;
    const start = performance.now();
    const total = outerCells.length;
    for (let step = 0; step < total; step++) {
      if (performance.now() - start > budgetMs) {
        innerCursorRef.current = (innerCursorRef.current + step) % total;
        return;
      }
      const cell = outerCells[(innerCursorRef.current + step) % total]!;
      if (cell.polygon.length < 3) continue;
      const loc = locOf.get(cell.id);
      if (loc === undefined) continue;
      const clip: ClipRegion = {
        kind: "polygon",
        ring: insetRing(cell.polygon, 0.94),
      };
      let layout = inner.get(cell.id);
      if (!layout) {
        let symbols =
          symbolsRef.current?.get(cell.id) ??
          synthesizeSymbols(cell.id, loc, 1);
        if (paramsRef.current.omit.includes("local")) {
          symbols = symbols.filter((s) => s.exported === true);
        }
        for (const symbol of symbols) {
          symbolMetaRef.current.set(symbol.id, {
            exported: symbol.exported === true,
            fileId: cell.id,
            kind: symbol.symbolKind,
          });
          labelsRef.current.set(symbol.id, symbol.label);
          if (symbol.exported === true) exportedIdsRef.current.add(symbol.id);
        }
        layout = createCapacityLayout(
          symbols.map((s) => ({ id: s.id, weight: s.metrics.loc })),
          clip,
          { seed: 1 },
        );
      } else if (outerMoved) {
        layout = applyGraphChanges(layout, { clip });
      } else if (isConverged(layout, CONVERGENCE_TOLERANCE)) {
        continue;
      }
      if (!isConverged(layout, CONVERGENCE_TOLERANCE)) {
        layout = capacityStep(layout);
      }
      inner.set(cell.id, layout);
      innerDirtyRef.current = true;
    }
    innerCursorRef.current = 0;
  };

  /** Highlight what the displayed commit itself changed (vs its parent). */
  const applyCommitDiff = (index: number) => {
    const diff = historyIndexRef.current?.diffs[index];
    if (!diff) {
      changedFilesRef.current = new Map();
      lastDiffRef.current = { added: 0, modified: 0, removed: 0 };
      return;
    }
    changedFilesRef.current = diff.changed;
    lastDiffRef.current = {
      added: [...diff.changed.values()].filter((k) => k === "added").length,
      modified: [...diff.changed.values()].filter((k) => k === "modified")
        .length,
      removed: diff.removed.length,
    };
  };

  const rebuild = (p: PlaygroundParams) => {
    let graph: AtlasGraph;
    if (p.source === "sprawlens") {
      graph = snapshotToAtlasGraph(sprawlensSnapshot);
      symbolsRef.current = snapshotSymbols(sprawlensSnapshot);
      symbolEdgesRef.current = snapshotSymbolEdges(sprawlensSnapshot);
    } else if (p.source === "sprawlens-history") {
      const history = commitsRef.current;
      if (!history) {
        graph = { nodes: [], edges: [] };
        symbolsRef.current = null;
        symbolEdgesRef.current = [];
        fetch("fixtures/sprawlens-history.json")
          .then((r) => r.json())
          .then((json: HistoryEntry[]) => {
            commitsRef.current = json;
            historyIndexRef.current = buildHistoryIndex(json);
            if (paramsRef.current.source === "sprawlens-history") {
              rebuild(paramsRef.current);
              setFrame((f) => f + 1);
            }
          })
          .catch((error) => console.error("history load failed", error));
      } else {
        const index =
          commitIndexRef.current >= 0 &&
          commitIndexRef.current < history.length
            ? commitIndexRef.current
            : history.length - 1;
        commitIndexRef.current = index;
        const snapshot = history[index]!.snapshot;
        graph = snapshotToAtlasGraph(snapshot);
        symbolsRef.current = snapshotSymbols(snapshot);
        symbolEdgesRef.current = snapshotSymbolEdges(snapshot);
        applyCommitDiff(index);
      }
    } else if (p.source === "playwright") {
      const snapshot = playwrightSnapRef.current;
      if (!snapshot) {
        // fetch once, then rebuild with the real data
        graph = { nodes: [], edges: [] };
        symbolsRef.current = null;
        symbolEdgesRef.current = [];
        fetch("fixtures/playwright.json")
          .then((r) => r.json())
          .then((json: SnapshotLike) => {
            playwrightSnapRef.current = json;
            if (paramsRef.current.source === "playwright") {
              rebuild(paramsRef.current);
              setFrame((f) => f + 1);
            }
          })
          .catch((error) => console.error("fixture load failed", error));
      } else {
        graph = snapshotToAtlasGraph(snapshot);
        symbolsRef.current = snapshotSymbols(snapshot);
        symbolEdgesRef.current = snapshotSymbolEdges(snapshot);
      }
    } else {
      graph = createSyntheticGraph({ count: SYNTH_COUNT, seed: SEED });
      symbolsRef.current = null;
      symbolEdgesRef.current = synthesizeSymbolEdges(graph, SEED);
    }
    graphRef.current = graph;
    nextNodeId.current = SYNTH_COUNT;
    // reset the per-view lookups BEFORE the projection: effectiveGraph
    // registers the symbol labels, which a later wipe would erase
    innerLayoutsRef.current = new Map();
    symbolMetaRef.current = new Map();
    fetchedHierarchyRef.current = new Set();
    lspEdgesRef.current = new Map();
    labelsRef.current = new Map();
    exportedIdsRef.current = new Set();
    innerCellsRef.current = [];
    innerDirtyRef.current = true;
    refreshGraphLookups();
    const visible = effectiveGraph(p);
    if (p.layout === "rings") {
      ringsRef.current = createRingsState(visible, ringsOptions(p));
      treemapRef.current = null;
    } else {
      treemapRef.current = createTreemapState(visible, treemapOptions(p));
      ringsRef.current = null;
    }
    setFocusId(null);
  };

  if (ringsRef.current === null && treemapRef.current === null) {
    rebuild(params);
  }

  // structural params trigger a rebuild; solver params only update
  // options on the existing layout
  const treemapSizeKey =
    params.layout === "treemap" ? `${mapSize.width}x${mapSize.height}` : "";
  const structuralKey = `${params.source}|${params.layout}|${granularity}|${params.boundaries.join("+")}|${treemapSizeKey}`;
  // weight / filters re-flow warm (the diff animation); only granularity
  // and data swaps rebuild cold
  const detailKey = `${params.omit.join("+")}|${params.omitModules.join(",")}`;
  const flowKey = `${detailKey}|${params.weight}`;
  const structuralRef = useRef(structuralKey);
  const flowKeyRef = useRef(flowKey);
  const detailKeyRef = useRef(detailKey);
  useEffect(() => {
    if (structuralRef.current !== structuralKey) {
      structuralRef.current = structuralKey;
      flowKeyRef.current = flowKey;
      detailKeyRef.current = detailKey;
      rebuild(paramsRef.current);
      return;
    }
    if (flowKeyRef.current !== flowKey) {
      flowKeyRef.current = flowKey;
      if (detailKeyRef.current !== detailKey) {
        detailKeyRef.current = detailKey;
        // nested symbol layouts bake the level filter in: restart them
        innerLayoutsRef.current = new Map();
        innerDirtyRef.current = true;
      }
      if (ringsRef.current) {
        // weight/filter toggles re-flow the map warm: cells melt to their
        // new areas instead of snapping
        ringsRef.current = applyRingsChanges(
          ringsRef.current,
          effectiveGraph(paramsRef.current),
          ringsOptions(paramsRef.current),
        );
      } else if (treemapRef.current) {
        treemapRef.current = applyTreemapChanges(
          treemapRef.current,
          effectiveGraph(paramsRef.current),
          treemapOptions(paramsRef.current),
        );
      } else {
        rebuild(paramsRef.current);
        return;
      }
    }
  }, [structuralKey, flowKey]);

  // Dynamic symbol LOD: when the camera settles in the module⊃symbol view,
  // re-rank symbols against the new focus center and warm-start the layout
  // so the focused district's symbols melt in and distant ones fold into
  // their "(module scope)" fillers. The set, not just the labels, changes.
  useEffect(() => {
    if (
      granularityOf(
        paramsRef.current.boundaries,
        paramsRef.current.displayLevels,
      ) !== "symbol"
    )
      return;
    if (!ringsRef.current || apiFullRef.current.nodes.length === 0) return;
    // re-budget against the new focus from the cached full graph (cheap),
    // then warm-start so the set melts to the refocused selection
    ringsRef.current = applyRingsChanges(
      ringsRef.current,
      budgetedApiGraph(apiFullRef.current),
      ringsOptions(paramsRef.current),
    );
    setFrame((f) => f + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewInfo]);

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    let disposed = false;
    // rAF stops entirely in hidden tabs; fall back to a timer so layouts
    // keep converging while the user works elsewhere
    const schedule = () => {
      if (disposed) return;
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(() => tick(performance.now()), 33);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    const tick = (now: number) => {
      // time-budgeted stepping: fixed step counts block the main thread for
      // seconds on monorepo-scale graphs. Hidden tabs get a bigger budget to
      // compensate for the ~1 tick/s timer throttling.
      const hidden = document.visibilityState === "hidden";
      const solverBudget = hidden ? 150 : 10;
      const innerBudget = hidden ? 60 : 6;
      const maxSteps = STEPS_PER_FRAME * (hidden ? 30 : 1);
      const solverStart = performance.now();
      let outerActive = false;
      let outerCells: CellResult[] = [];
      if (ringsRef.current) {
        let steps = 0;
        let active = true;
        while (
          active &&
          steps < maxSteps &&
          performance.now() - solverStart < solverBudget
        ) {
          const result = stepRingsState(ringsRef.current, 1);
          ringsRef.current = result.state;
          active = result.active;
          steps++;
        }
        outerActive = active;
        for (const layout of ringsRef.current.leafLayouts.values()) {
          outerCells.push(...layout.cells);
        }
      } else if (treemapRef.current) {
        let steps = 0;
        let active = true;
        while (
          active &&
          steps < maxSteps &&
          performance.now() - solverStart < solverBudget
        ) {
          const result = stepTreemapState(treemapRef.current, 1);
          treemapRef.current = result.state;
          active = result.active;
          steps++;
        }
        outerActive = active;
        for (const layout of treemapRef.current.leafLayouts.values()) {
          outerCells.push(...layout.cells);
        }
      }

      let innerActive = false;
      if (
        (showsSymbolLevels(paramsRef.current.displayLevels) ||
          paramsRef.current.displayLevels.includes("cfg")) &&
        granularityOf(
          paramsRef.current.boundaries,
          paramsRef.current.displayLevels,
        ) === "file"
      ) {
        syncInnerLayouts(outerCells, outerActive, innerBudget);
        for (const layout of innerLayoutsRef.current.values()) {
          if (!isConverged(layout, CONVERGENCE_TOLERANCE)) {
            innerActive = true;
            break;
          }
        }
      }
      if (innerDirtyRef.current) {
        innerDirtyRef.current = false;
        innerCellsRef.current = [...innerLayoutsRef.current.values()].flatMap(
          (l) => l.cells,
        );
      }
      // re-render only while a solver is actually advancing; a converged
      // layout would otherwise burn CPU at full frame rate. On big maps a
      // full SVG re-render costs as much as the solver budget, so while
      // converging the repaint commits at ~20fps — the solver keeps every
      // frame, the melt animation just interpolates visually coarser.
      if (outerActive || innerActive) {
        repaintSkipRef.current++;
        // information-scaled repaint cadence: a full SVG re-render costs in
        // proportion to the live element count, so the denser the map the
        // fewer frames we actually commit while solving. The solver still
        // advances every tick — only the visual melt interpolates coarser.
        const cells = outerCells.length + innerCellsRef.current.length;
        const repaintEvery =
          cells > 4000 ? 6 : cells > 1500 ? 4 : cells > 600 ? 3 : 1;
        if (repaintSkipRef.current >= repaintEvery || !outerActive) {
          repaintSkipRef.current = 0;
          setFrame((f) => f + 1);
        }
      } else if (repaintSkipRef.current > 0) {
        // flush the final state once everything settles
        repaintSkipRef.current = 0;
        setFrame((f) => f + 1);
      }
      schedule();
    };
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  const afterGraphMutation = (changedFileId?: string) => {
    refreshGraphLookups();
    if (ringsRef.current) {
      ringsRef.current = applyRingsChanges(
        ringsRef.current,
        effectiveGraph(paramsRef.current),
        ringsOptions(paramsRef.current),
      );
    }
    if (treemapRef.current) {
      treemapRef.current = applyTreemapChanges(
        treemapRef.current,
        effectiveGraph(paramsRef.current),
        treemapOptions(paramsRef.current),
      );
    }
    if (changedFileId) innerLayoutsRef.current.delete(changedFileId);
    if (paramsRef.current.source === "synthetic") {
      symbolEdgesRef.current = synthesizeSymbolEdges(graphRef.current, SEED);
    }
    setFrame((f) => f + 1);
  };

  /**
   * Display another commit of the loaded history: the commit's own diff
   * drives the highlight, and the warm-started re-flow IS the animation.
   */
  /**
   * Fold a working-tree diff into the displayed graph and warm-apply it:
   * modified files re-target their cell area by new LOC, added files slot
   * into their module, removed files (and their edges) drop. Edges are not
   * re-derived here (file-level scaffold); the diff contract drives both
   * the inner-layout invalidation and the warm re-flow.
   */
  const applyWorkingTreeDiff = (diff: {
    changed: Record<string, "added" | "modified">;
    removed: string[];
    loc?: Record<string, number>;
  }) => {
    const prev = graphRef.current;
    const byId = new Map(prev.nodes.map((n) => [n.id, n]));
    const loc = diff.loc ?? {};
    const removed = new Set(diff.removed.filter((id) => byId.has(id)));
    const nodes: AtlasNode[] = [];
    for (const node of prev.nodes) {
      if (removed.has(node.id)) continue;
      const next = loc[node.id];
      if (next != null && Math.max(next, 1) !== node.metrics.loc) {
        nodes.push({ ...node, metrics: { ...node.metrics, loc: Math.max(next, 1) } });
      } else {
        nodes.push(node);
      }
    }
    for (const [path, kind] of Object.entries(diff.changed)) {
      if (kind === "added" && !byId.has(path) && loc[path] != null) {
        nodes.push({
          id: path,
          kind: "file",
          label: path.split("/").pop() ?? path,
          metrics: { loc: Math.max(loc[path], 1) },
        });
      }
    }
    const nextGraph: AtlasGraph = {
      nodes,
      edges: prev.edges.filter(
        (e) => !removed.has(e.source) && !removed.has(e.target),
      ),
    };
    const delta = diffGraphs(prev, nextGraph);
    if (isEmptyDelta(delta)) return;
    for (const node of delta.added) innerLayoutsRef.current.delete(node.id);
    for (const node of delta.modified) innerLayoutsRef.current.delete(node.id);
    for (const id of delta.removed) innerLayoutsRef.current.delete(id);
    innerDirtyRef.current = true;
    graphRef.current = nextGraph;
    refreshGraphLookups();
    if (ringsRef.current) {
      ringsRef.current = applyRingsChanges(
        ringsRef.current,
        effectiveGraph(paramsRef.current),
        ringsOptions(paramsRef.current),
      );
    } else if (treemapRef.current) {
      treemapRef.current = applyTreemapChanges(
        treemapRef.current,
        effectiveGraph(paramsRef.current),
        treemapOptions(paramsRef.current),
      );
    }
    setFrame((f) => f + 1);
  };

  const goToCommit = (index: number) => {
    const history = commitsRef.current;
    if (!history || index < 0 || index >= history.length) return;
    if (index === commitIndexRef.current) return;
    const snapshot = history[index]!.snapshot;
    const nextGraph = snapshotToAtlasGraph(snapshot);
    // invalidation must compare displayed vs next (symbol ids carry line
    // numbers); the highlight uses the commit-vs-parent diff instead
    const scrub = diffGraphs(graphRef.current, nextGraph);
    for (const node of scrub.added) innerLayoutsRef.current.delete(node.id);
    for (const node of scrub.modified) innerLayoutsRef.current.delete(node.id);
    for (const id of scrub.removed) innerLayoutsRef.current.delete(id);
    innerDirtyRef.current = true;
    applyCommitDiff(index);
    graphRef.current = nextGraph;
    symbolsRef.current = snapshotSymbols(snapshot);
    symbolEdgesRef.current = snapshotSymbolEdges(snapshot);
    fetchedHierarchyRef.current = new Set();
    lspEdgesRef.current = new Map();
    refreshGraphLookups();
    commitIndexRef.current = index;
    if (ringsRef.current) {
      ringsRef.current = applyRingsChanges(
        ringsRef.current,
        effectiveGraph(paramsRef.current),
        ringsOptions(paramsRef.current),
      );
    } else if (treemapRef.current) {
      treemapRef.current = applyTreemapChanges(
        treemapRef.current,
        effectiveGraph(paramsRef.current),
        treemapOptions(paramsRef.current),
      );
    }
    setFrame((f) => f + 1);
  };

  /** Boundary-group cell (module, directory, ...) across layout kinds. */
  const groupCellOf = (id: string): CellResult | null => {
    const treemap = treemapRef.current;
    if (treemap) {
      for (const level of treemap.levels) {
        const cell = level.cells.get(id);
        if (cell) return cell;
      }
    }
    const rings = ringsRef.current;
    if (rings) {
      for (const level of rings.innerLevels) {
        const cell = level.cells.get(id);
        if (cell) return cell;
      }
    }
    return null;
  };

  /** Top-level group (module) of any treemap group or leaf id. */
  const treemapTopOf = (state: TreemapState, id: string): string =>
    makeTopAncestorOf(state.parentOf, (x) => state.levels[0]!.cells.has(x))(
      id,
    ) ?? id;

  /** Outer-layout cell (group or file) for an id, across layout kinds. */
  const outerCellOf = (id: string): CellResult | null => {
    const layouts =
      ringsRef.current?.leafLayouts ?? treemapRef.current?.leafLayouts;
    if (layouts) {
      const groupCell = groupCellOf(id);
      if (groupCell) return groupCell;
      for (const layout of layouts.values()) {
        const cell = layout.cells.find((c) => c.id === id);
        if (cell) return cell;
      }
      return null;
    }
    return null;
  };

  /** World-space bounding box of any visible element, across layout kinds. */
  const geometryBoundsOf = (
    id: string,
  ): { x0: number; x1: number; y0: number; y1: number } | null => {
    const circle = ringsRef.current?.circles.get(id);
    if (circle) {
      return {
        x0: circle.cx - circle.r,
        x1: circle.cx + circle.r,
        y0: circle.cy - circle.r,
        y1: circle.cy + circle.r,
      };
    }
    const port = portNodesRef.current.find((p) => p.id === id);
    if (port) return { x0: port.x, x1: port.x, y0: port.y, y1: port.y };
    const cell =
      innerCellsRef.current.find((c) => c.id === id) ?? outerCellOf(id);
    if (!cell || cell.polygon.length < 3) return null;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of cell.polygon) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    return { x0, x1, y0, y1 };
  };

  type Bounds = { x0: number; x1: number; y0: number; y1: number };

  /** Fly the camera to a view rect framing a world-space bbox. The generic
   * primitive every "focus on something" path goes through: a single id, an
   * edge's two endpoints, any set of elements — all reduce to their union
   * bbox and frame it here. */
  const focusBounds = (bounds: Bounds, padding = 2.5) => {
    // point geometry (ports) gets a fixed frame; padding then scales it
    const w = bounds.x1 - bounds.x0 || 60;
    const h = bounds.y1 - bounds.y0 || 60;
    // frame the bbox with padding: at the default the target ends up
    // ~40% of the view; larger paddings frame its neighborhood instead
    const viewW = Math.max(w, (h * WIDTH) / HEIGHT) * padding;
    setFocusRequest({
      cx: (bounds.x0 + bounds.x1) / 2,
      cy: (bounds.y0 + bounds.y1) / 2,
      viewW,
      token: (focusRequest?.token ?? 0) + 1,
    });
  };

  /** Union bbox of several elements' geometry; null if none resolve. */
  const boundsOfIds = (ids: readonly string[]): Bounds | null => {
    let acc: Bounds | null = null;
    for (const id of ids) {
      const b = geometryBoundsOf(id);
      if (!b) continue;
      acc = acc
        ? {
            x0: Math.min(acc.x0, b.x0),
            x1: Math.max(acc.x1, b.x1),
            y0: Math.min(acc.y0, b.y0),
            y1: Math.max(acc.y1, b.y1),
          }
        : b;
    }
    return acc;
  };

  /** Frame the combined bbox of a set of elements (zoom to fit them all). */
  const focusOnIds = (ids: readonly string[], padding = 2.5) => {
    const bounds = boundsOfIds(ids);
    if (bounds) focusBounds(bounds, padding);
  };

  /** Fly the camera to a view rect framing the target, and select it. */
  const jumpTo = (id: string, padding = 2.5) => {
    setSelectedId(id);
    focusOnIds([id], padding);
  };

  const mutateWeight = () => {
    const graph = graphRef.current;
    if (graph.nodes.length === 0) return;
    const rng = mutationRng.current;
    const node = graph.nodes[Math.floor(rng() * graph.nodes.length)]!;
    const factor = rng() < 0.5 ? 0.7 : 1.3;
    const updated: AtlasNode = {
      ...node,
      metrics: { loc: Math.max(1, Math.round(node.metrics.loc * factor)) },
    };
    graphRef.current = {
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === node.id ? updated : n)),
    };
    afterGraphMutation(updated.id);
  };

  const addNode = () => {
    const rng = mutationRng.current;
    const moduleIds = [
      ...new Set(
        graphRef.current.nodes.map((n) => n.id.split("/").slice(0, -1).join("/")),
      ),
    ].filter((m) => m.length > 0);
    const moduleId =
      moduleIds.length > 0
        ? moduleIds[Math.floor(rng() * moduleIds.length)]!
        : "added";
    const node: AtlasNode = {
      id: `${moduleId}/added-${nextNodeId.current++}.ts`,
      kind: "file",
      label: `added-${nextNodeId.current}.ts`,
      metrics: { loc: Math.round(20 + 980 * rng() ** 3) },
    };
    const graph = graphRef.current;
    const edges = [...graph.edges];
    if (graph.nodes.length > 0) {
      const target = graph.nodes[Math.floor(rng() * graph.nodes.length)]!;
      edges.push({ source: node.id, target: target.id });
    }
    graphRef.current = { nodes: [...graph.nodes, node], edges };
    afterGraphMutation();
  };

  const removeNode = () => {
    const graph = graphRef.current;
    if (graph.nodes.length <= 2) return;
    const rng = mutationRng.current;
    const node = graph.nodes[Math.floor(rng() * graph.nodes.length)]!;
    graphRef.current = {
      nodes: graph.nodes.filter((n) => n.id !== node.id),
      edges: graph.edges.filter(
        (e) => e.source !== node.id && e.target !== node.id,
      ),
    };
    afterGraphMutation(node.id);
    if (selectedId === node.id) setSelectedId(null);
  };

  /** Dependency-path extraction across the three levels. */
  const computeFocus = (id: string): FocusView | null => {
    const rings = ringsRef.current;
    const treemap = treemapRef.current;
    if (!rings && !treemap) return null;
    const fileLayoutsByModule = rings
      ? rings.leafLayouts
      : treemap!.leafLayouts;
    const moduleEdges = rings ? rings.topEdges : treemap!.topEdges;
    const fileToModule = new Map<string, string>();
    for (const [groupId, layout] of fileLayoutsByModule) {
      // leaf layouts hang off the innermost boundary; the focus sets work
      // at the top (module) level, so resolve through the parent chain
      const moduleId = rings ? groupId : treemapTopOf(treemap!, groupId);
      for (const cell of layout.cells) fileToModule.set(cell.id, moduleId);
    }
    const symbolsOfFiles = (fileIds: Set<string>): Set<string> => {
      const out = new Set<string>();
      for (const [symbolId, meta] of symbolMetaRef.current) {
        if (fileIds.has(meta.fileId)) out.add(symbolId);
      }
      return out;
    };
    const filesOfModules = (moduleIds: Set<string>): Set<string> => {
      const out = new Set<string>();
      for (const [fileId, moduleId] of fileToModule) {
        if (moduleIds.has(moduleId)) out.add(fileId);
      }
      return out;
    };

    const isModuleId = rings
      ? rings.circles.has(id)
      : treemap!.levels[0]!.cells.has(id);
    if (isModuleId) {
      const reach = reachSubgraph(moduleEdges, id);
      const fileIds = filesOfModules(reach.nodes);
      return {
        level: "module",
        moduleIds: reach.nodes,
        fileIds,
        symbolIds: symbolsOfFiles(fileIds),
        downstreamEdges: reach.downstreamEdges,
        upstreamEdges: reach.upstreamEdges,
      };
    }
    // intermediate boundary group (directory, file district, ...): reach
    // over that level's own network, then light up the member leaves
    const intermediateLevel = (
      rings ? rings.innerLevels : treemap!.levels.slice(1)
    ).find((level) => level.cells.has(id));
    if (intermediateLevel) {
      const parentOf = rings ? rings.parentOf : treemap!.parentOf;
      const reach = reachSubgraph(intermediateLevel.edges, id);
      const fileIds = new Set<string>();
      for (const leafId of fileToModule.keys()) {
        let current = parentOf.get(leafId) ?? null;
        while (current != null && !reach.nodes.has(current)) {
          current = parentOf.get(current) ?? null;
        }
        if (current != null) fileIds.add(leafId);
      }
      const moduleIds = new Set<string>();
      for (const fileId of fileIds) {
        const moduleId = fileToModule.get(fileId);
        if (moduleId) moduleIds.add(moduleId);
      }
      return {
        level: "module",
        moduleIds,
        fileIds,
        symbolIds: symbolsOfFiles(fileIds),
        groupIds: reach.nodes,
        downstreamEdges: reach.downstreamEdges,
        upstreamEdges: reach.upstreamEdges,
      };
    }
    if (displayGraphRef.current.nodes.some((n) => n.id === id)) {
      const reach = reachSubgraph(displayGraphRef.current.edges, id);
      const moduleIds = new Set<string>();
      for (const fileId of reach.nodes) {
        const moduleId = fileToModule.get(fileId);
        if (moduleId) moduleIds.add(moduleId);
      }
      return {
        level: "file",
        moduleIds,
        fileIds: reach.nodes,
        symbolIds: symbolsOfFiles(reach.nodes),
        downstreamEdges: reach.downstreamEdges,
        upstreamEdges: reach.upstreamEdges,
      };
    }
    const reach = reachSubgraph(symbolEdgesRef.current, id);
    const fileIds = new Set<string>();
    const symbolIds = new Set<string>();
    for (const nodeId of reach.nodes) {
      const meta = symbolMetaRef.current.get(nodeId);
      if (meta) {
        symbolIds.add(nodeId);
        fileIds.add(meta.fileId);
      } else if (fileToModule.has(nodeId)) {
        fileIds.add(nodeId);
      }
    }
    const moduleIds = new Set<string>();
    for (const fileId of fileIds) {
      const moduleId = fileToModule.get(fileId);
      if (moduleId) moduleIds.add(moduleId);
    }
    return {
      level: "symbol",
      moduleIds,
      fileIds,
      symbolIds,
      downstreamEdges: reach.downstreamEdges,
      upstreamEdges: reach.upstreamEdges,
    };
  };
  // with a multi-selection, the extraction runs from every selected node
  // and the views merge (union of reachable sets, deduped edges)
  const mergeFocusViews = (views: FocusView[]): FocusView | null => {
    if (views.length === 0) return null;
    if (views.length === 1) return views[0]!;
    const merged: FocusView = {
      level: views[views.length - 1]!.level,
      moduleIds: new Set(),
      fileIds: new Set(),
      symbolIds: new Set(),
      downstreamEdges: [],
      upstreamEdges: [],
    };
    const seenDown = new Set<string>();
    const seenUp = new Set<string>();
    for (const view of views) {
      for (const id of view.moduleIds) merged.moduleIds.add(id);
      for (const id of view.fileIds) merged.fileIds.add(id);
      for (const id of view.symbolIds) merged.symbolIds.add(id);
      if (view.groupIds) {
        merged.groupIds ??= new Set();
        for (const id of view.groupIds) merged.groupIds.add(id);
      }
      for (const edge of view.downstreamEdges) {
        const key = `${edge.source} ${edge.target}`;
        if (!seenDown.has(key)) {
          seenDown.add(key);
          merged.downstreamEdges.push(edge);
        }
      }
      for (const edge of view.upstreamEdges) {
        const key = `${edge.source} ${edge.target}`;
        if (!seenUp.has(key)) {
          seenUp.add(key);
          merged.upstreamEdges.push(edge);
        }
      }
    }
    return merged;
  };
  const focusRoots =
    focusId === null ? [] : selectedIds.length > 0 ? selectedIds : [focusId];
  const focusView = focusId
    ? mergeFocusViews(
        focusRoots
          .map(computeFocus)
          .filter((v): v is FocusView => v !== null),
      )
    : null;
  const exportedIds = exportedIdsRef.current;
  // symbol ids encode the declaration kind: symbol:<path>:<kind>:<name>:<line>
  // (the path may contain ':', so read kind as 3rd-from-last). Works for every
  // symbol-id source; symbolMeta only covers the file-nested layout path.
  const symbolKindOf = (id: string): SymbolKind | undefined => {
    const meta = symbolMetaRef.current.get(id)?.kind;
    if (meta) return meta;
    if (!id.startsWith("symbol:")) return undefined;
    const parts = id.split(":");
    if (parts.length < 5) return undefined;
    const k = parts[parts.length - 3]!;
    return SYMBOL_KIND_SET.has(k) ? (k as SymbolKind) : undefined;
  };

  /** API view: adapter ports placed on the rim, facing their consumers. */
  const portNodes = (() => {
    const rings = ringsRef.current;
    if (granularity !== "symbol" || !rings) return [];
    const out: { id: string; label: string; x: number; y: number }[] = [];
    for (const [moduleId, ports] of apiBoundaryRef.current) {
      const circle = rings.circles.get(moduleId);
      if (!circle) continue;
      const placed = ports
        .map((port, index) => {
          let sx = 0;
          let sy = 0;
          for (const partnerModule of apiPortPartnersRef.current.get(
            port.id,
          ) ?? []) {
            const partner = rings.circles.get(partnerModule);
            if (!partner) continue;
            sx += partner.cx - circle.cx;
            sy += partner.cy - circle.cy;
          }
          const angle =
            sx === 0 && sy === 0
              ? (index / ports.length) * 2 * Math.PI
              : Math.atan2(sy, sx);
          return { port, angle };
        })
        .sort((a, b) => a.angle - b.angle);
      // keep a minimum angular separation so ports don't stack
      const minSep = Math.min(
        (2 * Math.PI) / Math.max(placed.length, 1),
        0.3,
      );
      for (let i = 1; i < placed.length; i++) {
        if (placed[i]!.angle - placed[i - 1]!.angle < minSep) {
          placed[i]!.angle = placed[i - 1]!.angle + minSep;
        }
      }
      for (const { port, angle } of placed) {
        out.push({
          id: port.id,
          label: port.label,
          x: circle.cx + Math.cos(angle) * circle.r,
          y: circle.cy + Math.sin(angle) * circle.r,
        });
      }
    }
    portNodesRef.current = out;
    return out;
  })();

  const labels = labelsRef.current;
  const labelOf = (id: string) =>
    labels.get(id) ?? id.slice(id.indexOf("#") + 1).split("/").pop() ?? id;
  const parentFileOf = (id: string) =>
    symbolMetaRef.current.get(id)?.fileId ??
    (id.startsWith("symbol:")
      ? (id.split(":")[1] ?? id)
      : id.split("#")[0]!);

  // --- dependency-flow analysis: cycles and the edges that sustain them ---
  // leafGraph identity changes only on rebuild, so the memo holds between
  // animation frames
  const leafGraph =
    granularity === "symbol"
      ? displayGraphRef.current
      : graphRef.current;
  const cyclicIds = useMemo(
    () =>
      new Set(
        cyclicComponents(
          leafGraph.nodes.map((n) => n.id),
          leafGraph.edges,
        ).flat(),
      ),
    [leafGraph],
  );
  const moduleEdgesNow = ringsRef.current?.topEdges ?? null;
  const cyclicModuleIds = useMemo(() => {
    if (!moduleEdgesNow) return new Set<string>();
    const ids = [
      ...new Set(moduleEdgesNow.flatMap((e) => [e.source, e.target])),
    ];
    return new Set(cyclicComponents(ids, moduleEdgesNow).flat());
  }, [moduleEdgesNow]);
  /**
   * Hierarchy breadcrumb: the selected node's path, or — without a
   * selection — whatever the viewport center (crosshair) points at.
   */
  const breadcrumb = (() => {
    const rings = ringsRef.current;
    const treemap = treemapRef.current;
    if (!rings && !treemap) return [];
    const isModuleId = (id: string) =>
      (rings?.circles.has(id) ?? false) ||
      (treemap?.levels[0]!.cells.has(id) ?? false);
    const parts: { id: string; label: string }[] = [];
    const isSymbolId = (id: string) =>
      id.startsWith("symbol:") || id.includes("#");
    const moduleOfId = (id: string) =>
      granularity === "symbol"
        ? apiModuleIdOf(id)
        : defaultModuleIdOf(id);
    if (selectedId) {
      if (isModuleId(selectedId)) {
        parts.push({ id: selectedId, label: selectedId });
      } else if (isSymbolId(selectedId)) {
        const fileId = parentFileOf(selectedId);
        parts.push({ id: moduleOfId(fileId), label: moduleOfId(fileId) });
        if (granularity !== "symbol") {
          parts.push({ id: fileId, label: labelOf(fileId) });
        }
        parts.push({ id: selectedId, label: labelOf(selectedId) });
      } else {
        parts.push({ id: moduleOfId(selectedId), label: moduleOfId(selectedId) });
        parts.push({ id: selectedId, label: labelOf(selectedId) });
      }
      return parts;
    }
    // crosshair hit-test at the settled view center
    const p = { x: viewInfo.x, y: viewInfo.y };
    let moduleId: string | null = null;
    if (rings) {
      for (const [id, circle] of rings.circles) {
        if (Math.hypot(p.x - circle.cx, p.y - circle.cy) <= circle.r) {
          moduleId = id;
          break;
        }
      }
    } else if (treemap) {
      for (const [id, cell] of treemap.levels[0]!.cells) {
        if (cell.polygon.length >= 3 && containsPoint(cell.polygon, p)) {
          moduleId = id;
          break;
        }
      }
    }
    if (!moduleId) return [];
    parts.push({ id: moduleId, label: moduleId });
    // descend the intermediate boundary levels under the crosshair
    let leafGroupId = moduleId;
    const intermediateLevels = rings
      ? rings.innerLevels
      : treemap!.levels.slice(1);
    for (const level of intermediateLevels) {
      const hit = [...level.cells.values()].find(
        (c) => c.polygon.length >= 3 && containsPoint(c.polygon, p),
      );
      if (!hit) break;
      parts.push({ id: hit.id, label: hit.id.split("/").pop()! });
      leafGroupId = hit.id;
    }
    const layout = rings
      ? rings.leafLayouts.get(leafGroupId)
      : treemap?.leafLayouts.get(leafGroupId);
    const cell = layout?.cells.find(
      (c) => c.polygon.length >= 3 && containsPoint(c.polygon, p),
    );
    if (cell) {
      parts.push({ id: cell.id, label: labelOf(cell.id) });
      if (viewInfo.zoom >= 2.2 && granularity === "file") {
        const symbol = innerLayoutsRef.current
          .get(cell.id)
          ?.cells.find(
            (c) => c.polygon.length >= 3 && containsPoint(c.polygon, p),
          );
        if (symbol && !symbol.id.endsWith("#rest")) {
          parts.push({ id: symbol.id, label: labelOf(symbol.id) });
        }
      }
    }
    return parts;
  })();

  const activeId = selectedId;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  /** Strata visibility set fed to the map components (level kinds). */
  const visibleLevels = useMemo(
    // the leaf always draws even though "file" lives on the boundary axis,
    // not the display axis (its outline is zoom-gated, not toggled)
    () => new Set<string>([...params.displayLevels, granularity]),
    [params.displayLevels, granularity],
  );
  // --- dynamic CFG detail: fetched per symbol once it fills enough of the
  // screen, cached for the session; failures (no server) cache as null ---
  const cfgCacheRef = useRef(
    new Map<string, DetailGraph | null | "pending">(),
  );
  const [cfgVersion, setCfgVersion] = useState(0);
  // only the selected symbols carry a CFG — full-viewport CFG sweeps were
  // both heavy and visually inconsistent
  useEffect(() => {
    const p = paramsRef.current;
    if (!p.displayLevels.includes("cfg")) return;
    if (p.source === "synthetic" || p.source === "sprawlens-history") return;
    const wanted = new Set(selectedIds);
    if (activeId) wanted.add(activeId);
    for (const id of wanted) {
      if (cfgCacheRef.current.has(id)) continue;
      const request = cfgRequestOf(id);
      if (!request) {
        cfgCacheRef.current.set(id, null);
        continue;
      }
      cfgCacheRef.current.set(id, "pending");
      fetchCfg(p.source, request.file, request.line).then((graph) => {
        cfgCacheRef.current.set(id, graph);
        if (graph) setCfgVersion((v) => v + 1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, selectedIds, params.displayLevels, params.source]);

  /** Top-level scopes present in the loaded graph — the include-list
   * candidates. Derived from the raw graph so excluded scopes stay
   * listed. */
  const availableScopes = useMemo(() => {
    return [...new Set(graphRef.current.nodes.map((n) => scopeOf(n.id)))].sort();
    // graphRef refreshes only on rebuild; leafGraph tracks that identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafGraph]);

  const selectNode = (id: string | null, additive = false) => {
    if (id === null) {
      setSelectedIds([]);
      setSelectedEdges([]);
      // the dependency-path focus always tracks the selection — a stale
      // path over a different selection reads as a broken state
      setFocusId(null);
      return;
    }
    const resolved = id;
    if (additive) {
      // toggle this node, keep any selected edges
      setSelectedIds(
        selectedIds.includes(resolved)
          ? selectedIds.filter((x) => x !== resolved)
          : [...selectedIds, resolved],
      );
      if (focusId !== null) setFocusId(resolved);
      return;
    }
    // plain click replaces the whole selection with this node
    setSelectedEdges([]);
    setSelectedIds([resolved]);
    if (focusId !== null) setFocusId(resolved);
  };

  /** Pick an edge as a selectable element. Shift+click toggles it into the
   * mixed selection; a plain click replaces the selection and frames the
   * edge's endpoints. */
  const selectEdge = (source: string, target: string, additive = false) => {
    const edge = { source, target };
    if (additive) {
      setSelectedEdges(
        selectedEdges.some((e) => edgeKey(e) === edgeKey(edge))
          ? selectedEdges.filter((e) => edgeKey(e) !== edgeKey(edge))
          : [...selectedEdges, edge],
      );
      return;
    }
    setSelectedIds([]);
    setFocusId(null);
    setSelectedEdges([edge]);
    // zoom to the bbox spanning the two endpoints (generic multi-element fit)
    focusOnIds([source, target], 1.4);
  };

  // Esc drops the explicit selection (zoom focus takes over again)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIds([]);
        setSelectedEdges([]);
        setFocusId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Working-tree diff: the dev server fs-watches the repo and pushes a
  // batched diff over SSE whenever it changes. Uncommitted files highlight
  // like a history diff, and the camera optionally follows each newly
  // changed file to its neighborhood. Static builds (no dev server) fail
  // the connection a few times and give up quietly.
  /** Recent working-tree changes, newest first — revisitable from the
   * panel after the camera has moved on. */
  const recentChangesRef = useRef<
    { id: string; kind: "added" | "modified"; at: number }[]
  >([]);
  useEffect(() => {
    if (params.source !== "sprawlens") return;
    let firstPush = true;
    let failures = 0;
    const seen = new Set<string>();
    const stream = new EventSource(
      `/api/working-diff/stream?repo=sprawlens&base=${encodeURIComponent(params.diffBase)}`,
    );
    stream.onmessage = (event) => {
      failures = 0;
      const diff = JSON.parse(event.data) as {
        changed: Record<string, "added" | "modified">;
        removed: string[];
        loc?: Record<string, number>;
      };
      // incremental recompute: turn the working-tree diff into a graph
      // delta and warm-apply it so edited files re-flow in place. Gated by
      // followChanges — off keeps the highlight-only behavior. The camera
      // jump below stays gated the same way.
      if (paramsRef.current.followChanges) {
        applyWorkingTreeDiff(diff);
      }
      const known = new Set(graphRef.current.nodes.map((n) => n.id));
      const next = new Map(
        Object.entries(diff.changed).filter(([id]) => known.has(id)),
      );
      const fresh = [...next.keys()].filter((id) => !seen.has(id));
      seen.clear();
      for (const id of next.keys()) seen.add(id);
      const previous = changedFilesRef.current;
      const dirty =
        previous.size !== next.size ||
        [...next].some(([id, kind]) => previous.get(id) !== kind);
      if (dirty) {
        changedFilesRef.current = next;
        setFrame((f) => f + 1);
      }
      if (!firstPush && fresh.length > 0) {
        const now = Date.now();
        recentChangesRef.current = [
          ...fresh.map((id) => ({ id, kind: next.get(id)!, at: now })),
          ...recentChangesRef.current.filter((e) => !fresh.includes(e.id)),
        ].slice(0, 20);
        // follow saves as they happen, but not the backlog at page load
        if (paramsRef.current.followChanges) jumpTo(fresh[0]!, 6);
      }
      firstPush = false;
    };
    stream.onerror = () => {
      if (++failures >= 3) stream.close();
    };
    return () => stream.close();
  }, [params.source, params.diffBase]);

  const allCells: CellResult[] = ringsRef.current
    ? [...ringsRef.current.leafLayouts.values()].flatMap((l) => l.cells)
    : treemapRef.current
      ? [...treemapRef.current.leafLayouts.values()].flatMap((l) => l.cells)
      : [];
  const allInnerCells = innerCellsRef.current;
  const testFileIds = testFileIdsRef.current;
  const testTargets = testTargetsRef.current;
  const selected = useMemo(
    () =>
      allCells.find((c) => c.id === activeId) ??
      allInnerCells.find((c) => c.id === activeId) ??
      null,
    [allCells, allInnerCells, activeId],
  );
  const selectedIsModule =
    activeId !== null &&
    ((ringsRef.current?.circles.has(activeId) ?? false) ||
      (treemapRef.current?.levels[0]!.cells.has(activeId) ?? false));
  /** Intermediate boundary group (directory etc.) — its level kind. */
  const selectedGroupKind =
    activeId !== null && !selectedIsModule
      ? (ringsRef.current?.kindOf.get(activeId) ??
        treemapRef.current?.kindOf.get(activeId) ??
        null)
      : null;
  const selectedTest =
    activeId !== null && testFileIds.has(activeId)
      ? (graphRef.current.nodes.find((n) => n.id === activeId) ?? null)
      : null;
  const selectedPort =
    activeId !== null && granularity === "symbol"
      ? (portNodesRef.current.find((p) => p.id === activeId) ?? null)
      : null;
  const selectedIsSymbol =
    selected !== null && !allCells.some((c) => c.id === selected.id);
  const selectedRefs = useMemo(() => {
    if (!activeId) return { incoming: [], outgoing: [] };
    const edges = [
      ...(granularityOf(
        paramsRef.current.boundaries,
        paramsRef.current.displayLevels,
      ) === "symbol"
        ? displayGraphRef.current.edges
        : symbolEdgesRef.current),
      // display-only LSP overlay of the active root
      ...(lspEdgesRef.current.get(activeId) ?? []),
    ];
    return {
      incoming: [
        ...new Set(
          edges.filter((e) => e.target === activeId).map((e) => e.source),
        ),
      ],
      outgoing: [
        ...new Set(
          edges.filter((e) => e.source === activeId).map((e) => e.target),
        ),
      ],
    };
  }, [activeId, hierarchyVersion, granularity]);

  // Phase 3: on-demand call hierarchy from the LSP server. Static
  // symbolImports only know file→symbol; the LSP upgrades the selection to
  // real symbol→symbol caller/callee edges. They are a display-only
  // overlay (dashed): merging them into the structural edge set meant
  // every fetch re-projected the network and re-flowed the map, and the
  // set only ever grew — too heavy at monorepo scale.
  useEffect(() => {
    const id = activeId;
    if (!id || !id.startsWith("symbol:")) return;
    const repo = paramsRef.current.source;
    // history snapshots don't match the working tree the LSP sees
    if (repo === "synthetic" || repo === "sprawlens-history") return;
    if (fetchedHierarchyRef.current.has(id)) return;
    fetchedHierarchyRef.current.add(id);
    const parts = id.split(":"); // symbol:<path>:<kind>:<name>:<line>
    fetchCallHierarchy(repo, parts[1]!, parts[3]!)
      .then((response) => {
        const symbolsByFile = symbolsRef.current ?? new Map();
        const fileIds = new Set(graphRef.current.nodes.map((n) => n.id));
        lspEdgesRef.current.set(
          id,
          refsToEdges(id, response, symbolsByFile, fileIds),
        );
        // bounded cache: evict the oldest roots nobody has selected
        const selected = new Set(selectedIdsRef.current);
        for (const key of lspEdgesRef.current.keys()) {
          if (lspEdgesRef.current.size <= LSP_CACHE_MAX) break;
          if (selected.has(key) || key === id) continue;
          lspEdgesRef.current.delete(key);
          fetchedHierarchyRef.current.delete(key);
        }
        setHierarchyVersion((v) => v + 1);
      })
      .catch(() => {
        // server not running or transient failure: allow a later retry
        fetchedHierarchyRef.current.delete(id);
      });
  }, [activeId]);
  // the overlay shown right now: hierarchy edges of the active selection,
  // minus anything the static projection already draws solid
  const lspOverlayEdges = (() => {
    const roots = selectedIds.length > 0 ? selectedIds : activeId ? [activeId] : [];
    const out: AtlasEdge[] = [];
    const seen = new Set(
      (granularity === "symbol"
        ? displayGraphRef.current.edges
        : symbolEdgesRef.current
      ).map((e) => `${e.source}->${e.target}`),
    );
    for (const root of roots) {
      for (const edge of lspEdgesRef.current.get(root) ?? []) {
        const key = `${edge.source}->${edge.target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(edge);
      }
    }
    return out;
  })();
  const innerCells = showsSymbolLevels(params.displayLevels)
    ? allInnerCells
    : [];
  /** CFG diagrams for the selected symbols only (load + coherence). The
   * host partition is used even when the symbol level itself is hidden. */
  const cfgEntries = useMemo(() => {
    if (!visibleLevels.has("cfg")) return [] as CfgEntry[];
    const wanted = new Set(selectedIds);
    if (activeId) wanted.add(activeId);
    const cells =
      granularity === "symbol" ? allCells : allInnerCells;
    const out: CfgEntry[] = [];
    for (const cell of cells) {
      if (!wanted.has(cell.id)) continue;
      if (cell.polygon.length < 3) continue;
      if (Math.sqrt(cell.actualArea) * viewInfo.zoom < CFG_MIN_PX) continue;
      const graph = cfgCacheRef.current.get(cell.id);
      if (!graph || graph === "pending") continue;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const p of cell.polygon) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
      out.push({ id: cell.id, x0, y0, x1, y1, polygon: cell.polygon, graph });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allCells,
    allInnerCells,
    viewInfo,
    cfgVersion,
    visibleLevels,
    granularity,
    activeId,
    selectedIds,
  ]);
  /** Parent file name for disambiguating symbol references in lists. */
  const fileOf = (id: string) => {
    if (id.includes("#")) return id.split("#")[0]!.split("/").pop()!;
    if (id.startsWith("symbol:")) return id.split(":")[1]!.split("/").pop()!;
    return "";
  };

  return (
    <div
      style={{
        display: "grid",
        ...(panelSide === "right"
          ? { gridTemplateColumns: "1fr 300px", gridTemplateRows: "1fr" }
          : { gridTemplateColumns: "1fr", gridTemplateRows: "1fr 260px" }),
        gap: "12px",
        height: "100vh",
        padding: "12px",
        boxSizing: "border-box",
        fontFamily: "Monaco, ui-monospace, Menlo, monospace",
        background: PAGE_BG,
        color: INK,
        colorScheme: params.dark ? "dark" : "light",
      }}
    >
      <div
        ref={mapContainerRef}
        style={{
          background: MAP_BG,
          borderRadius: "8px",
          overflow: "hidden",
          border: `1px solid ${PANEL_BORDER}`,
          position: "relative",
        }}
      >
        {ringsRef.current ? (
          <RingsMapSvg
            rings={ringsRef.current}
            innerCells={granularity === "file" ? innerCells : []}
            fileEdges={
              granularity === "symbol"
                ? displayGraphRef.current.edges
                : graphRef.current.edges
            }
            symbolEdges={
              granularity === "symbol"
                ? displayGraphRef.current.edges
                : symbolEdgesRef.current
            }
            lspEdges={lspOverlayEdges}
            showEdges={params.showEdges || granularity === "symbol"}
            showFiles={granularity !== "module" && visibleLevels.has(granularity)}
            visibleLevels={visibleLevels}
            cfgEntries={cfgEntries}
            compactModuleLabels={granularity === "symbol"}
            cyclicIds={cyclicIds}
            cyclicModuleIds={cyclicModuleIds}
            labels={labels}
            exportedIds={exportedIds}
            symbolKindOf={symbolKindOf}
            classIdOf={classIdOf}
            showClassOverlay={showClassOverlay}
            focus={focusView}
            testFileIds={testFileIds}
            hiddenLayers={new Set(hiddenLayersOf(params.omit))}
            parentFileOf={parentFileOf}
            changedFiles={changedFilesRef.current}
            portNodes={portNodes}
            width={WIDTH}
            height={HEIGHT}
            selectedId={activeId}
            selectedIds={selectedIdSet}
            selectedEdges={selectedEdges}
            onSelect={selectNode}
            onSelectEdge={selectEdge}
            onFocusId={jumpTo}
            focusRequest={focusRequest}
            onViewSettle={(center, zoom) =>
              setViewInfo({ x: center.x, y: center.y, zoom })
            }
          />
        ) : treemapRef.current ? (
          <TreemapSvg
            state={treemapRef.current}
            innerCells={granularity === "file" ? innerCells : []}
            exportedIds={exportedIds}
            symbolKindOf={symbolKindOf}
            parentFileOf={parentFileOf}
            classIdOf={classIdOf}
            showClassOverlay={showClassOverlay}
            fileEdges={
              granularity === "symbol"
                ? displayGraphRef.current.edges
                : graphRef.current.edges
            }
            showEdges={params.showEdges}
            visibleLevels={visibleLevels}
            cfgEntries={cfgEntries}
            leafKind={granularity === "symbol" ? "symbol" : "file"}
            labels={labels}
            changedFiles={changedFilesRef.current}
            cyclicIds={cyclicIds}
            testFileIds={testFileIds}
            focus={focusView}
            width={mapSize.width}
            height={mapSize.height}
            selectedId={activeId}
            selectedIds={selectedIdSet}
            selectedEdges={selectedEdges}
            onSelect={selectNode}
            onSelectEdge={selectEdge}
            onFocusId={jumpTo}
            focusRequest={focusRequest}
            onViewSettle={(center, zoom) =>
              setViewInfo({ x: center.x, y: center.y, zoom })
            }
          />
        ) : null}
        {/* hierarchy breadcrumb: selection path, or the crosshair target */}
        {breadcrumb.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              background: PANEL_BG,
              border: `1px solid ${PANEL_BORDER}`,
              borderRadius: "6px",
              fontSize: "12px",
              maxWidth: "70%",
              overflow: "hidden",
            }}
          >
            {breadcrumb.map((part, i) => (
              <>
                {i > 0 ? <span style={{ color: "#94a3b8" }}>→</span> : null}
                <button
                  key={part.id}
                  onClick={() => setSelectedId(part.id)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "0",
                    cursor: "pointer",
                    color: i === breadcrumb.length - 1 ? "#0f172a" : "#475569",
                    fontWeight: i === breadcrumb.length - 1 ? "600" : "400",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {part.label}
                </button>
              </>
            ))}
          </div>
        ) : null}
        {/* crosshair marking what the breadcrumb describes (no selection) */}
        {!selectedId && ringsRef.current ? (
          <svg
            width="18"
            height="18"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              opacity: 0.7,
            }}
          >
            <line x1="9" y1="0" x2="9" y2="6" stroke="#0f172a" />
            <line x1="9" y1="12" x2="9" y2="18" stroke="#0f172a" />
            <line x1="0" y1="9" x2="6" y2="9" stroke="#0f172a" />
            <line x1="12" y1="9" x2="18" y2="9" stroke="#0f172a" />
          </svg>
        ) : null}
        {params.source === "sprawlens-history" && commitsRef.current ? (
          <div
            style={{
              position: "absolute",
              left: "8px",
              bottom: "8px",
              right: "270px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              background: PANEL_BG,
              border: `1px solid ${PANEL_BORDER}`,
              borderRadius: "6px",
              fontSize: "12px",
            }}
          >
            <button
              onClick={() => goToCommit(commitIndexRef.current - 1)}
              style={{ cursor: "pointer", padding: "2px 8px" }}
            >
              ◀
            </button>
            <input
              type="range"
              min={0}
              max={commitsRef.current.length - 1}
              value={commitIndexRef.current}
              onInput={(e) =>
                goToCommit(Number((e.target as HTMLInputElement).value))
              }
              style={{ flex: "1", minWidth: "80px" }}
            />
            <button
              onClick={() => goToCommit(commitIndexRef.current + 1)}
              style={{ cursor: "pointer", padding: "2px 8px" }}
            >
              ▶
            </button>
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "300px",
              }}
            >
              <b>
                {commitsRef.current[commitIndexRef.current]?.shortHash}
              </b>{" "}
              {commitsRef.current[commitIndexRef.current]?.message.split(
                "\n",
              )[0] ?? ""}
            </span>
            <span style={{ color: MUTED_INK, whiteSpace: "nowrap" }}>
              +{lastDiffRef.current.added} ~{lastDiffRef.current.modified} −
              {lastDiffRef.current.removed}
            </span>
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: panelSide === "right" ? "column" : "row",
          alignItems: panelSide === "right" ? "stretch" : "flex-start",
          gap: "12px",
          fontSize: "12px",
          color: "#0f172a",
          minHeight: "0",
          minWidth: "0",
          overflow: panelSide === "right" ? "hidden auto" : "auto hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "4px",
            flex: "none",
            flexDirection: panelSide === "right" ? "row" : "column",
          }}
        >
          {(["auto", "right", "bottom"] as PanelPosition[]).map((pos) => (
            <button
              key={pos}
              onClick={() => setPanelPos(pos)}
              style={{
                padding: "2px 8px",
                fontSize: "11px",
                cursor: "pointer",
                border: `1px solid ${PANEL_BORDER}`,
                borderRadius: "4px",
                background: panelPos === pos ? SELECT_STROKE : MAP_BG,
                color: panelPos === pos ? "#fff" : INK,
              }}
            >
              {pos}
            </button>
          ))}
        </div>
        <Section title="表示オプション">
          <Controls /* dark toggles route through onControlsChange */
            params={params}
            availableScopes={availableScopes}
            debug={DEBUG}
            onChange={onControlsChange}
            onRegenerate={() => rebuild(paramsRef.current)}
            onMutateWeight={mutateWeight}
            onAddNode={addNode}
            onRemoveNode={removeNode}
          />
        </Section>
        {recentChangesRef.current.length > 0 ? (
          <Section title="変更履歴">
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              {recentChangesRef.current.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => jumpTo(entry.id, 6)}
                  style={{
                    padding: "3px 4px",
                    fontSize: "11px",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    color: entry.kind === "added" ? "#047857" : "#b45309",
                    textAlign: "left",
                    wordBreak: "break-all",
                  }}
                >
                  {new Date(entry.at).toLocaleTimeString()}{" "}
                  {labelOf(entry.id)}
                </button>
              ))}
            </div>
          </Section>
        ) : null}
        {selected ||
        selectedIsModule ||
        selectedGroupKind ||
        selectedTest ||
        selectedPort ? (
          <Section title="選択ノード">
            <div style={{ fontWeight: "600", wordBreak: "break-all" }}>
              {labelOf(activeId!)}
              {selectedPort
                ? " (port)"
                : selectedIsSymbol
                  ? " (symbol)"
                  : selectedIsModule
                    ? " (module)"
                    : selectedGroupKind
                      ? ` (${selectedGroupKind})`
                      : selectedTest
                        ? " (test)"
                        : ""}
            </div>
            {granularity !== "symbol" ? (
              <div style={{ color: MUTED_INK, wordBreak: "break-all" }}>
                {activeId}
              </div>
            ) : null}
            {selectedIds.length > 1 ? (
              <div style={{ marginTop: "4px" }}>
                <div style={{ color: MUTED_INK }}>
                  選択中 {selectedIds.length} 件 (shift+クリックで増減):
                </div>
                {selectedIds.map((id) => (
                  <button
                    key={id}
                    onClick={() =>
                      setSelectedIds([
                        ...selectedIds.filter((x) => x !== id),
                        id,
                      ])
                    }
                    style={{
                      display: "block",
                      padding: "1px 4px",
                      fontSize: "11px",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      color: id === selectedId ? "#1d4ed8" : "#334155",
                      fontWeight: id === selectedId ? "600" : "400",
                      textAlign: "left",
                      wordBreak: "break-all",
                    }}
                  >
                    {labelOf(id)}
                  </button>
                ))}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: "6px", margin: "6px 0" }}>
              {focusId !== activeId ? (
                <button
                  onClick={() => setFocusId(activeId)}
                  style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                >
                  依存経路を抽出
                </button>
              ) : null}
              {focusId ? (
                <button
                  onClick={() => setFocusId(null)}
                  style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                >
                  全体表示に戻す
                </button>
              ) : null}
            </div>
            {selected ? (
              <>
                <div>target: {selected.targetArea.toFixed(1)} px²</div>
                <div>actual: {selected.actualArea.toFixed(1)} px²</div>
              </>
            ) : null}
            {selectedTest && testTargets.get(selectedTest.id) ? (
              <button
                onClick={() => jumpTo(testTargets.get(selectedTest.id)!)}
                style={{
                  marginTop: "4px",
                  padding: "2px 4px",
                  fontSize: "11px",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  color: "#0891b2",
                  textAlign: "left",
                }}
              >
                covers: {labelOf(testTargets.get(selectedTest.id)!)}
              </button>
            ) : null}
            {params.source === "sprawlens-history" &&
            activeId &&
            historyIndexRef.current?.nodeHistory.has(activeId) ? (
              <div style={{ marginTop: "6px" }}>
                <div style={{ fontWeight: "600" }}>
                  変更履歴 (
                  {historyIndexRef.current.nodeHistory.get(activeId)!.length}
                  )
                </div>
                {[...historyIndexRef.current.nodeHistory.get(activeId)!]
                  .reverse()
                  .map((change) => {
                    const commit = commitsRef.current?.[change.index];
                    if (!commit) return null;
                    const marker =
                      change.kind === "added"
                        ? ["＋", "#059669"]
                        : change.kind === "modified"
                          ? ["～", "#d97706"]
                          : ["－", "#dc2626"];
                    const current = change.index === commitIndexRef.current;
                    return (
                      <button
                        key={`${change.index}-${change.kind}`}
                        onClick={() => goToCommit(change.index)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "2px 4px",
                          fontSize: "11px",
                          cursor: "pointer",
                          background: current ? "#e0e7ff" : "none",
                          border: "none",
                          color: "#0f172a",
                          fontWeight: current ? "600" : "400",
                        }}
                      >
                        <span style={{ color: marker[1] }}>{marker[0]}</span>{" "}
                        <span style={{ color: MUTED_INK }}>
                          {commit.shortHash}
                        </span>{" "}
                        {commit.message.split("\n")[0]}
                      </button>
                    );
                  })}
              </div>
            ) : null}
            {selectedRefs.incoming.length > 0 ? (
              <div style={{ marginTop: "6px" }}>
                <div style={{ fontWeight: "600" }}>
                  referenced by ({selectedRefs.incoming.length})
                </div>
                {selectedRefs.incoming.slice(0, 12).map((id) => (
                  <button
                    key={id}
                    onClick={() => jumpTo(id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "2px 4px",
                      fontSize: "11px",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      color: "#0891b2",
                    }}
                  >
                    ← {labelOf(id)}
                    {granularity !== "symbol" && fileOf(id) ? (
                      <span style={{ color: "#94a3b8" }}> · {fileOf(id)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            {selectedRefs.outgoing.length > 0 ? (
              <div style={{ marginTop: "6px" }}>
                <div style={{ fontWeight: "600" }}>
                  references ({selectedRefs.outgoing.length})
                </div>
                {selectedRefs.outgoing.slice(0, 12).map((id) => (
                  <button
                    key={id}
                    onClick={() => jumpTo(id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "2px 4px",
                      fontSize: "11px",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      color: "#ea580c",
                    }}
                  >
                    → {labelOf(id)}
                    {granularity !== "symbol" && fileOf(id) ? (
                      <span style={{ color: "#94a3b8" }}> · {fileOf(id)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </Section>
        ) : null}
      </div>
    </div>
  );
}
