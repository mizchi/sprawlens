import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useQueryStates } from "nuqs";
import { makeUrlParamParsers } from "./urlParams.ts";
import type { AtlasGraph, AtlasNode, SymbolKind } from "@sprawlens/schema";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
  type ClipRegion,
} from "@sprawlens/layout";
import { centroid, containsPoint, type Ring, type Vec2 } from "@sprawlens/layout";
import { createRng, type Rng } from "@sprawlens/layout";
import { Controls, type PlaygroundParams } from "./Controls.tsx";
import { CameraPanel, LayersMenu } from "./OverlayPanels.tsx";
import { SvgRenderer } from "./renderer/SvgRenderer.tsx";
import { fetchHover } from "./cfgClient.ts";
import {
  HIGHLIGHT_THEME,
  parseHoverMarkdown,
  tokenizeCode,
} from "./highlightCode.ts";
import type { MapHandlers } from "./renderer/contract.ts";
import { buildScene } from "./engine/buildScene.ts";
import { useSelection } from "./engine/useSelection.ts";
import { useCamera, type Bounds } from "./engine/useCamera.ts";
import { useViewportSize } from "./useViewportSize.ts";
import { useAltKey } from "./useAltKey.ts";
import { useColorScheme } from "./useColorScheme.ts";
import { useEventSource } from "./useEventSource.ts";
import { useSymbolDetail } from "./engine/useSymbolDetail.ts";
import { useSolverLoop } from "./engine/useSolverLoop.ts";
import {
  buildSatelliteLayers,
  DEFAULT_LAYER_MANIFEST,
} from "./layerModel.ts";
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
import { ServicesView } from "./ServicesView.tsx";
import {
  snapshotExternalDeps,
  snapshotSymbolEdges,
  snapshotSymbols,
  snapshotTestTree,
  snapshotToAtlasGraph,
  testRunOverlay,
  traceOverlay,
  type ExternalDep,
  type LayerManifestEntry,
  type ServiceGraph,
  type SnapshotLike,
  type TestRun,
  type TestStatus,
  type TestTree,
  type Trace,
  type TraceTimeline,
} from "@sprawlens/schema";
import { apply, layerTransform } from "@sprawlens/layout";
import { sprawlensSnapshot } from "./fixtures/sprawlens.ts";
import {
  applyRingsChanges,
  createRingsState,
  type RingsState,
} from "./ringsController.ts";
import {
  applyTreemapChanges,
  createTreemapState,
  type TreemapState,
} from "./treemapController.ts";
import { reachSubgraph } from "@sprawlens/layout";
import { cyclicComponents } from "@sprawlens/layout";
import type { FocusRequest, FocusView } from "./RingsMapSvg.tsx";
import {
  createSyntheticGraph,
  synthesizeSymbolEdges,
  synthesizeSymbols,
} from "./synthetic.ts";
import type { AtlasEdge } from "@sprawlens/schema";
import { TracePlayer } from "./TracePlayer.tsx";
import { TestLogPanel } from "./TestLogPanel.tsx";
import { TestReporterPanel } from "./TestReporterPanel.tsx";
import { HistoryTimeline } from "./HistoryTimeline.tsx";
import { CommitLog } from "./CommitLog.tsx";
import {
  projectTimelineCursor,
  stepClockUs,
  timelineDurationUs,
} from "./tracePlayer.ts";
import {
  classGrouping,
  deriveModuleIdOf,
  directoryGrouping,
  moduleGrouping,
  parentFileOf as contractParentFileOf,
  serviceGrouping,
  type Grouping,
  type ModuleIdOf,
} from "@sprawlens/schema";
import { layerOfNode, matchTestTargets } from "@sprawlens/schema";
import {
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
import { diffGraphs, isEmptyDelta } from "@sprawlens/schema";
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
const CONVERGENCE_TOLERANCE = 0.02;

/**
 * A content fingerprint of a served snapshot: it changes iff the analysis
 * (files, their symbols, and import edges) changed. The live stream re-analyzes
 * on any fs event — including ones that don't change the code (an LSP touching
 * its caches, editor temp files) — and re-pushes an identical snapshot. Without
 * this, a symbol-granularity view cold-rebuilds on every such push and the
 * rings reshuffle "with no code change". Skipping equal signatures stops that.
 */
function snapshotSignature(snap: SnapshotLike): string {
  const parts: string[] = [];
  for (const node of snap.nodes) {
    if (node.type !== "file") continue;
    const syms = (node.symbols ?? []).map((s) => `${s.id}#${s.loc}`).join(",");
    parts.push(`${node.id}:${node.loc ?? 0}:${node.layer ?? ""}:${syms}`);
  }
  parts.push("|");
  for (const edge of snap.edges) {
    parts.push(`${edge.type}:${edge.from}>${edge.to}:${edge.resolved ? 1 : 0}`);
  }
  return parts.join(";");
}
/** Solver parameters: long-stable knobs, hardcoded out of the UI. */
const SYNTH_COUNT = 120;
/** Bucket for files that match no service's source globs, when nesting by service. */
const UNASSIGNED_SERVICE = "(no service)";
const ADAPTATION_RATE = 0.8;
const LLOYD_RATE = 0.7;
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

/**
 * Best-effort per-symbol diff between two snapshots. Symbol ids embed the
 * declaration line, so they shift on any edit above — match symbols by their
 * (name, kind) within a file instead, then report add / modify keyed by the
 * AFTER snapshot's symbol id (which the symbol cells use). Modification is
 * inferred from LOC / complexity, the only stable per-symbol metrics we keep.
 */
function changedSymbolsBetween(
  before: SnapshotLike,
  after: SnapshotLike,
): Map<string, "added" | "modified"> {
  const beforeByFile = new Map<
    string,
    Map<string, { loc: number; complexity?: number }>
  >();
  for (const n of before.nodes) {
    if (n.type !== "file" || !n.path) continue;
    const m = new Map<string, { loc: number; complexity?: number }>();
    for (const s of n.symbols ?? [])
      m.set(`${s.name}\u0000${s.kind}`, { loc: s.loc, complexity: s.complexity });
    beforeByFile.set(n.path, m);
  }
  const result = new Map<string, "added" | "modified">();
  for (const n of after.nodes) {
    if (n.type !== "file" || !n.path) continue;
    const prev = beforeByFile.get(n.path);
    for (const s of n.symbols ?? []) {
      const p = prev?.get(`${s.name}\u0000${s.kind}`);
      if (!p) result.set(s.id, "added");
      else if (p.loc !== s.loc || p.complexity !== s.complexity)
        result.set(s.id, "modified");
    }
  }
  return result;
}

export function App() {
  const systemPrefersDark =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: dark)").matches;
  // render-affecting settings mirrored to the URL (reproducible / shareable).
  // `params` stays the single interface the app + Controls use; this seeds its
  // synced fields from the URL on mount and an effect below writes them back.
  const [urlParams, setUrlParams] = useQueryStates(
    useMemo(() => makeUrlParamParsers(systemPrefersDark), [systemPrefersDark]),
  );
  const seed = urlParams.seed;
  const [params, setParams] = useState<PlaygroundParams>(() => ({
    source: urlParams.source,
    layout: urlParams.layout,
    boundaries: urlParams.boundaries,
    dark: urlParams.dark,
    displayLevels: urlParams.displayLevels,
    omit: ["local"],
    omitModules: [],
    weight: urlParams.weight,
    followChanges: true,
    diffBase: "",
    // ambient edges add noise; macro module deps are opt-in via this toggle
    showEdges: urlParams.showEdges,
    // nest the module map inside terraform service nodes; opt-in, needs a
    // sprawlens.toml [[service]] source mapping to have anything to nest
    groupByService: urlParams.groupByService,
    // label visibility floor (on-screen px) + font multiplier, slider-tunable
    labelMinPx: 9,
    labelScale: 1,
    // flat top-down by default; the stacked-plane tilt is opt-in. when on, the
    // planes lie back (pitch) as axis-aligned rectangles — alt+drag tilts them.
    tilt: {
      enabled: urlParams.tilt,
      theta: 0,
      pitch: 0.9,
      // per-layer plane visibility (layer name -> shown); names come from the
      // server's layer manifest (sprawlens.toml), test/deps are the built-ins
      layers: {},
      // gap is a fraction of the plane's height, so the stack auto-scales with
      // the viewport instead of a fixed world distance
      gap: 0.7,
    },
  }));
  // mirror the synced settings back to the URL whenever they change. nuqs omits
  // default-valued keys, so a no-change view keeps a clean URL.
  useEffect(() => {
    void setUrlParams({
      source: params.source,
      layout: params.layout,
      boundaries: params.boundaries,
      displayLevels: params.displayLevels,
      weight: params.weight,
      showEdges: params.showEdges,
      groupByService: params.groupByService,
      dark: params.dark,
      tilt: params.tilt.enabled,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.source,
    params.layout,
    params.boundaries,
    params.displayLevels,
    params.weight,
    params.showEdges,
    params.groupByService,
    params.dark,
    params.tilt.enabled,
  ]);
  // selection state machine (nodes + edges + dependency-path focus root); the
  // host composes camera framing (selectEdge / jumpTo) around its primitives
  const {
    selectedIds,
    selectedEdges,
    focusId,
    selectedId,
    selectedIdSet,
    selectedIdsRef,
    setFocusId,
    setSelectedId,
    promoteToPrimary,
    deselect,
    selectNode,
    selectEdgeState,
  } = useSelection();
  // camera: pending fly-to + settled view; focusBounds frames a world bbox
  const { focusRequest, viewInfo, focusBounds, onViewSettle } =
    useCamera({ width: WIDTH, height: HEIGHT });
  const [, setFrame] = useState(0);

  // LSP hover tooltip: hovering a symbol cell fetches textDocument/hover from
  // the server's detail provider (TS today; tree-sitter-only languages have
  // none, so it just stays hidden) and shows it at the cursor. Cached per
  // symbol and debounced so map panning doesn't spam the server.
  // pinned top-right (below the header), not at the cursor, so it never sits
  // under the mouse you're pointing with
  const [hoverTip, setHoverTip] = useState<string | null>(null);
  // the upper "service" layer (terraform): a standalone force-directed plane,
  // toggled over the code map. Independent of the hierarchy engine for now.
  const [servicesMode, setServicesMode] = useState(false);
  const hoverCacheRef = useRef(new Map<string, string | null>());
  const hoverTimerRef = useRef(0);
  const hoveredSymbolRef = useRef<string | null>(null);
  const onSymbolHover = (id: string | null, _screen: Vec2 | null) => {
    window.clearTimeout(hoverTimerRef.current);
    hoveredSymbolRef.current = id;
    if (!id) {
      setHoverTip(null);
      return;
    }
    // /api/hover is only meaningful for a CLI-served repo; the fixture sources
    // have no server, so skip those (a failed fetch resolves to null anyway,
    // but this avoids a request per hover on the static deploy)
    const src = paramsRef.current.source;
    if (src === "synthetic" || src === "sprawlens-history") return;
    const parts = id.split(":"); // symbol:<path>:<kind>:<name>:<line>
    if (parts[0] !== "symbol" || !parts[1] || !parts[3]) return;
    const [file, name] = [parts[1], parts[3]];
    const line = Number(parts[parts.length - 1]) || 0;
    const cached = hoverCacheRef.current.get(id);
    if (cached !== undefined) {
      setHoverTip(cached ?? null);
      return;
    }
    hoverTimerRef.current = window.setTimeout(() => {
      void fetchHover(paramsRef.current.source, file, name, line).then((md) => {
        hoverCacheRef.current.set(id, md);
        if (hoveredSymbolRef.current === id) setHoverTip(md ?? null);
      });
    }, 220);
  };

  // double-click a test-case cell → run just that case (POST /api/test-run/case);
  // merge the fresh result into the run so its tint / duration / covers refresh.
  const onRunTest = (testId: string) => {
    const src = paramsRef.current.source;
    if (src === "synthetic" || src === "sprawlens-history") return;
    void fetch("/api/test-run/case", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ testId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((result: TestRun["results"][number] | null) => {
        if (!result) return;
        setTestRun((prev) => {
          const results = prev ? [...prev.results] : [];
          const idx = results.findIndex((r) => r.testId === result.testId);
          if (idx >= 0) results[idx] = result;
          else results.push(result);
          return { schemaVersion: 1, ...(prev ?? {}), results };
        });
      })
      .catch(() => {});
  };

  const graphRef = useRef<AtlasGraph>(null as unknown as AtlasGraph);
  const ringsRef = useRef<RingsState | null>(null);
  const treemapRef = useRef<TreemapState | null>(null);
  /** Frames since the last repaint commit while a big map converges. */
  const repaintSkipRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  // The OS color scheme drives dark mode: the initial value reads it, and
  // OS color-scheme sync (manual control pins the theme until reload); the
  // returned wrapper records a manual dark toggle as the override.
  const { onParamsChange: onControlsChange } = useColorScheme(
    setParams,
    () => paramsRef.current.dark,
  );
  // The treemap lays out at the viewport's real pixel size so the map
  // maximizes the screen; resizes re-solve the layout, so they throttle
  // to one rebuild per pause. Rings keep the fixed canvas (radial scale).
  const {
    size: mapSize,
    sizeRef: mapSizeRef,
    ref: mapContainerRef,
  } = useViewportSize({ width: WIDTH, height: HEIGHT });
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
  /** External-package imports for the Deps plane (empty for synthetic data). */
  const externalDepsRef = useRef<ExternalDep[]>([]);
  /** Test-case tree for the nested test plane (null when none was extracted). */
  const testTreeRef = useRef<TestTree | null>(null);
  /** Per-symbol metadata accumulated as nested layouts materialize. */
  const symbolMetaRef = useRef(
    new Map<
      string,
      { exported: boolean; fileId: string; kind?: SymbolKind }
    >(),
  );
  /** Lazily fetched large fixture (served from public-atlas/). */
  const playwrightSnapRef = useRef<SnapshotLike | null>(null);
  /** Snapshot served by the CLI at /api/snapshot (fetched once). */
  const servedSnapRef = useRef<SnapshotLike | null>(null);
  /** Fingerprint of the last applied served snapshot, so the live stream can
   * drop re-emitted, unchanged snapshots instead of cold-rebuilding. */
  const lastSnapSigRef = useRef<string | null>(null);
  /** Terraform service graph from /api/services (fetched once): drives the
   * "group by service" nesting (fileServices) and the service-level edges. The
   * ref is for the synchronous reads in boundariesOf/nativeEdges; the state
   * feeds the standalone ServicesView so it doesn't re-fetch the same endpoint. */
  const serviceGraphRef = useRef<ServiceGraph | null>(null);
  const [serviceGraph, setServiceGraph] = useState<ServiceGraph | null>(null);
  // a runtime trace ingested by the CLI (--trace); drives the execution-path
  // overlay. Null in dev/demo and when no trace was passed.
  const [trace, setTrace] = useState<Trace | null>(null);
  // an ordered execution timeline (captureSelfTrace.mts); drives the trace
  // player. Null until a timeline is loaded. The cursor is the current step;
  // playing advances it by wall-clock. Ephemeral (not URL-synced).
  const [timeline, setTimeline] = useState<TraceTimeline | null>(null);
  const [timelineCursor, setTimelineCursor] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  // commit-log layout: a vertical Git-client list (right) or the horizontal
  // timeline (bottom). Toggleable so both can be compared.
  const [historyOrientation, setHistoryOrientation] = useState<"vertical" | "horizontal">(
    "vertical",
  );
  // experimental features (trace player, commit-log, test reporter) are off
  // unless the server was started with --experimental or the URL opts in.
  const [configExperimental, setConfigExperimental] = useState(false);
  const experimentalOn = urlParams.experimental || configExperimental;
  // a test run ingested by the CLI (--test-report); tints the test plane cells
  // pass/fail/skip. Null in dev/demo and when no report was passed.
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  /** Layer render manifest from the server (sprawlens.toml); defaults to the
   * built-in test/deps presets for demo / fixtures with no server config. */
  const [layerManifest, setLayerManifest] = useState<LayerManifestEntry[]>(
    DEFAULT_LAYER_MANIFEST,
  );
  // launched by the CLI? a snapshot is served — adopt it as the default source
  // (cached here so the rebuild below doesn't refetch). No-ops in dev/demo.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/snapshot")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: SnapshotLike | null) => {
        if (cancelled || !json) return;
        servedSnapRef.current = json;
        // seed the fingerprint so the first stream emit (the same snapshot) is
        // recognized as unchanged and doesn't reshuffle
        lastSnapSigRef.current = snapshotSignature(json);
        setParams((p) => (p.source === "sprawlens" ? { ...p, source: "served" } : p));
      })
      .catch(() => {});
    // the layer manifest tells the panel which planes exist and how to lay
    // each out; absent (dev/demo) keeps the built-in presets
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { layers?: LayerManifestEntry[]; experimental?: boolean } | null) => {
        if (cancelled || !json) return;
        if (json.experimental) setConfigExperimental(true);
        if (json.layers && json.layers.length > 0) setLayerManifest(json.layers);
      })
      .catch(() => {});
    // the terraform service graph (upper layer): cached so "group by service"
    // can nest the module map inside services. Empty/absent in dev/demo.
    fetch("/api/services")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: ServiceGraph | null) => {
        if (cancelled || !json) return;
        serviceGraphRef.current = json;
        setServiceGraph(json);
        // if the user already enabled nesting before this resolved, rebuild
        if (paramsRef.current.groupByService) rebuild(paramsRef.current);
      })
      .catch(() => {});
    // a runtime trace (--trace) for the execution-path overlay; null when none
    fetch("/api/trace")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: Trace | null) => {
        if (cancelled || !json) return;
        setTrace(json);
      })
      .catch(() => {});
    // an ordered execution timeline for the trace player. In dev it is the
    // captured fixture served from public-atlas; under `sprawlens serve` it can
    // come from /api/trace-timeline. Null when neither is present.
    Promise.any([
      fetch("/self-timeline.json").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/trace-timeline").then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then((json: TraceTimeline) => {
        if (cancelled || !json?.steps?.length) return;
        setTimeline(json);
      })
      .catch(() => {});
    // a test run (--test-report) for the reporter overlay; null when none
    fetch("/api/test-run")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: TestRun | null) => {
        if (cancelled || !json) return;
        setTestRun(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  /** Git-log history fixture and the commit currently on display. */
  const commitsRef = useRef<HistoryEntry[] | null>(null);
  const historyIndexRef = useRef<HistoryIndex | null>(null);
  const commitIndexRef = useRef(-1);
  /** Inclusive commit-range selection [a,b] (shift-click on the timeline); the
   * end b is displayed and every node changed across the range is highlighted.
   * Null for a single-commit view. */
  const commitRangeRef = useRef<[number, number] | null>(null);
  const changedFilesRef = useRef(new Map<string, "added" | "modified">());
  /** Per-symbol diff for the displayed history commit (empty otherwise). */
  const changedSymbolsRef = useRef(new Map<string, "added" | "modified">());
  /** Files a satellite layer's edges point at; each keeps a budgeted cell so it
   * surfaces to be linked + highlighted. Empty when no planes are shown. */
  const referencedFilesRef = useRef<Set<string>>(new Set());
  const lastDiffRef = useRef({ added: 0, modified: 0, removed: 0 });
  // symbol-detail caches reset on a cold rebuild; the hook (which needs the
  // solved cells) is created below, so rebuild reaches it through this ref
  const resetDetailRef = useRef<() => void>(() => {});
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
        .filter((n) => layerOfNode(n) === "test")
        .map((n) => n.id),
    );
    testTargetsRef.current = matchTestTargets(graph);
    const labels = labelsRef.current;
    for (const node of graph.nodes) labels.set(node.id, node.label);
  };

  // Module grouping derived from the actual directory tree (containers vs
  // modules), so it works for any language layout, not just src/packages
  // conventions. Memoized by graph identity — the file set only changes when
  // graphRef.current is reassigned to a new object.
  const moduleIdOfRef = useRef<{ graph: AtlasGraph | null; fn: ModuleIdOf }>({
    graph: null,
    fn: (id) => id,
  });
  const currentModuleIdOf = (): ModuleIdOf => {
    const graph = graphRef.current;
    if (moduleIdOfRef.current.graph !== graph) {
      moduleIdOfRef.current = {
        graph,
        fn: deriveModuleIdOf(
          graph.nodes.filter((node) => node.kind === "file").map((node) => node.id),
        ),
      };
    }
    return moduleIdOfRef.current.fn;
  };
  /** Module of any id (file/symbol) under the derived, language-neutral rule. */
  const moduleOfId = (id: string): string =>
    currentModuleIdOf()(contractParentFileOf(id));

  /** Subdivision rings above the leaf (module ⊃ directory); the leaf and
   * file outlines live on the display axis, not here. */
  const boundariesOf = (p: PlaygroundParams): Grouping[] => {
    // the class level groups symbol leaves by their class; it only applies
    // when symbols are the leaves (no file boundary nesting them per file)
    const symbolLeaves =
      granularityOf(p.boundaries, p.displayLevels) === "symbol";
    // with a directory boundary the class rest bucket must nest under the
    // directory (its parent), not the module — otherwise the one module-wide
    // bucket is shared across directories and empties all but one
    const hasDirectory = p.boundaries.includes("directory");
    const dir = directoryGrouping(DIRECTORY_DEPTH);
    const moduleIdOf = currentModuleIdOf();
    const groupings = p.boundaries.flatMap((level): Grouping[] => {
      if (level === "module") return [moduleGrouping(moduleIdOf)];
      if (level === "directory") return [dir];
      if (level === "class" && symbolLeaves)
        return [
          classGrouping(
            moduleIdOf,
            hasDirectory ? (id) => dir.groupOf(id) : undefined,
          ),
        ];
      return [];
    });
    const inner = groupings.length > 0 ? groupings : [moduleGrouping(moduleIdOf)];
    // the upper "service" layer (Phase B): nest the whole module map inside
    // terraform service nodes by prepending a service boundary. Only when the
    // toggle is on and a sprawlens.toml source mapping gave us file→service.
    const fileServices = serviceGraphRef.current?.fileServices;
    if (p.groupByService && fileServices && Object.keys(fileServices).length > 0) {
      const serviceOf = (file: string): string =>
        fileServices[file] ?? UNASSIGNED_SERVICE;
      return [serviceGrouping(serviceOf), ...inner];
    }
    return inner;
  };

  /** Service-to-service communication edges (terraform flow), keyed for the
   * service boundary level. Endpoints are service ids = serviceOf values. */
  const serviceNativeEdges = (
    p: PlaygroundParams,
  ): ReadonlyMap<string, readonly AtlasEdge[]> | undefined => {
    const graph = serviceGraphRef.current;
    if (!p.groupByService || !graph?.fileServices) return undefined;
    const edges: AtlasEdge[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: "flow",
      ...(e.weight !== undefined ? { weight: e.weight } : {}),
      ...(e.via ? { refs: [e.via] } : {}),
    }));
    return new Map([["service", edges]]);
  };

  const ringsOptions = (p: PlaygroundParams) => ({
    width: WIDTH,
    height: HEIGHT,
    seed,
    adaptationRate: ADAPTATION_RATE,
    lloydRate: LLOYD_RATE,
    boundaries: boundariesOf(p),
    nativeEdges: serviceNativeEdges(p),
  });

  const treemapOptions = (p: PlaygroundParams) => ({
    width: mapSizeRef.current.width,
    height: mapSizeRef.current.height,
    seed,
    adaptationRate: ADAPTATION_RATE,
    lloydRate: LLOYD_RATE,
    boundaries: boundariesOf(p),
    nativeEdges: serviceNativeEdges(p),
  });

  const symbolsForFile = (fileId: string): AtlasNode[] => {
    const real = symbolsRef.current?.get(fileId);
    if (real) return real;
    const loc = graphRef.current.nodes.find((n) => n.id === fileId)?.metrics
      .loc;
    return loc === undefined ? [] : synthesizeSymbols(fileId, loc, 1);
  };

  /**
   * Budget priority for a symbol in the module⊃symbol view: its area weight
   * scaled by how close its module sits to the map center. The framing is
   * fixed (the initial view), NOT the live camera, so zooming and panning
   * never re-budget — the symbol set stays put while the user navigates and
   * only a rebuild (code change / structural toggle) re-selects it. Module
   * centers come from the current layout; with none yet (cold) it falls back
   * to pure area.
   */
  const symbolPriorityOf = (symbolId: string, weight: number): number => {
    // a changed symbol must survive the budget so the diff shows at symbol
    // granularity instead of folding into "(module scope)"
    const file = symbolId.startsWith("symbol:")
      ? (symbolId.split(":")[1] ?? symbolId)
      : symbolId.split("#")[0]!;
    const changedBoost =
      changedFilesRef.current.size > 0 &&
      (changedFilesRef.current.has(file) ||
        changedSymbolsRef.current.has(symbolId))
        ? 1e6
        : 0;
    const rings = ringsRef.current;
    if (!rings) return weight + changedBoost;
    const circle = rings.circles.get(moduleOfId(symbolId));
    if (!circle) return weight + changedBoost;
    // fixed framing (map center, base zoom) — see the doc comment above
    const dx = circle.cx - WIDTH / 2;
    const dy = circle.cy - HEIGHT / 2;
    const radius = WIDTH * 0.6;
    const proximity = 1 / (1 + (dx * dx + dy * dy) / (radius * radius));
    // sqrt flattens the area weight so small members aren't crushed by large
    // siblings — the mild center bias matches the initial view's framing
    return Math.sqrt(weight) * proximity + changedBoost;
  };

  /**
   * Apply the focus-weighted symbol budget to the cached full api graph
   * and wire the resulting network up (labels, boundary ports). Returns
   * the internal symbols the layout subdivides. Cheap — no transitive
   * weights — so it runs on every focus change.
   */
  const budgetedApiGraph = (full: AtlasGraph): AtlasGraph => {
    // a fixed budget, not a zoom-driven one: the set is chosen once per build
    // (and on a code change) and stays put as the camera moves, so zooming in
    // to read never reshuffles the rings
    const budget = SYMBOL_BUDGET;
    const api = applySymbolBudget(full, {
      budget,
      priorityOf: symbolPriorityOf,
      // "scope" unchecked → drop the "(module scope)" fillers so cells size by
      // real symbols (useful for Rust, where docs/macros/imports pool into a
      // huge module-scope blob)
      dropFolded: paramsRef.current.omit.includes("scope"),
      // with a directory boundary, fold per directory so each keeps its own
      // scope filler (a single per-module filler would become one giant
      // directory that swamps the real ones and collapses the layout)
      fillerKeyOf: paramsRef.current.boundaries.includes("directory")
        ? (id) => directoryGrouping(DIRECTORY_DEPTH).groupOf(id)
        : moduleOfId,
      // cross-layer-referenced files always keep a cell so their edge lands and
      // they can be highlighted, no matter how the budget would rank them
      ensure:
        referencedFilesRef.current.size > 0
          ? {
              files: referencedFilesRef.current,
              fileOf: (id) =>
                id.startsWith("symbol:")
                  ? (id.split(":")[1] ?? id)
                  : id.split("#")[0]!,
            }
          : undefined,
    });
    for (const node of api.nodes) labelsRef.current.set(node.id, node.label);
    displayGraphRef.current = api;
    const split = splitApiBoundary(api, moduleOfId, symbolEdgesRef.current);
    apiBoundaryRef.current = split.boundaryByModule;
    const partners = new Map<string, Set<string>>();
    for (const edge of api.edges) {
      const sourceModule = moduleOfId(edge.source);
      if (sourceModule === moduleOfId(edge.target)) continue;
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
    // each enabled satellite plane lifts its files onto their own layer, so the
    // source plane is laid out without them (they reappear below, under their
    // targets). external-only planes (deps) have no source nodes to lift.
    const shownPlanes = p.tilt.enabled
      ? Object.entries(p.tilt.layers)
          .filter(([, on]) => on)
          .map(([name]) => name)
      : [];
    const hiddenLayers =
      shownPlanes.length > 0
        ? [...new Set([...hiddenLayersOf(p.omit), ...shownPlanes])]
        : hiddenLayersOf(p.omit);
    const omitScopes = new Set(p.omitModules);
    if (hiddenLayers.length || omitScopes.size) {
      const hidden = new Set(hiddenLayers);
      const nodes = graph.nodes.filter(
        (n) =>
          !hidden.has(layerOfNode(n)) && !omitScopes.has(scopeOf(n.id)),
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
        // a changed symbol is shown even when private, so the diff is visible
        // at symbol granularity without flipping the whole "local" filter
        keep: (id) => {
          const file = id.startsWith("symbol:")
            ? (id.split(":")[1] ?? id)
            : id.split("#")[0]!;
          return (
            changedFilesRef.current.has(file) ||
            changedSymbolsRef.current.has(id)
          );
        },
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
        // "scope" unchecked → drop the per-file "(module scope)" remainder cell
        // so the named symbols fill the file instead of a non-symbol blob
        if (paramsRef.current.omit.includes("scope")) {
          symbols = symbols.filter((s) => !s.id.endsWith("#rest"));
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
      changedSymbolsRef.current = new Map();
      lastDiffRef.current = { added: 0, modified: 0, removed: 0 };
      return;
    }
    changedFilesRef.current = diff.changed;
    // refine to a per-symbol diff against the parent commit's snapshot
    const before = commitsRef.current?.[index - 1]?.snapshot;
    const after = commitsRef.current?.[index]?.snapshot;
    changedSymbolsRef.current =
      before && after ? changedSymbolsBetween(before, after) : new Map();
    lastDiffRef.current = {
      added: [...diff.changed.values()].filter((k) => k === "added").length,
      modified: [...diff.changed.values()].filter((k) => k === "modified")
        .length,
      removed: diff.removed.length,
    };
  };

  /** Union every commit's diff across an inclusive range [a,b] so the map
   * highlights everything that changed anywhere in the selected span (not just
   * the last commit). The end commit b's snapshot is what's displayed. */
  const applyRangeDiff = (a: number, b: number) => {
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.max(a, b);
    const files = new Map<string, "added" | "modified">();
    const symbols = new Map<string, "added" | "modified">();
    let added = 0;
    let modified = 0;
    let removed = 0;
    for (let i = lo; i <= hi; i++) {
      const diff = historyIndexRef.current?.diffs[i];
      if (!diff) continue;
      for (const [id, kind] of diff.changed) files.set(id, kind);
      const before = commitsRef.current?.[i - 1]?.snapshot;
      const after = commitsRef.current?.[i]?.snapshot;
      if (before && after)
        for (const [id, kind] of changedSymbolsBetween(before, after)) symbols.set(id, kind);
      removed += diff.removed.length;
    }
    for (const kind of files.values()) kind === "added" ? added++ : modified++;
    changedFilesRef.current = files;
    changedSymbolsRef.current = symbols;
    lastDiffRef.current = { added, modified, removed };
  };

  const rebuild = (p: PlaygroundParams) => {
    let graph: AtlasGraph;
    // only the history source carries a per-symbol diff; clear it for the rest
    // (the history branch recomputes it via applyCommitDiff below)
    changedSymbolsRef.current = new Map();
    if (p.source === "sprawlens") {
      graph = snapshotToAtlasGraph(sprawlensSnapshot);
      symbolsRef.current = snapshotSymbols(sprawlensSnapshot);
      symbolEdgesRef.current = snapshotSymbolEdges(sprawlensSnapshot);
      externalDepsRef.current = snapshotExternalDeps(sprawlensSnapshot);
      testTreeRef.current = snapshotTestTree(sprawlensSnapshot);
    } else if (p.source === "sprawlens-history") {
      const history = commitsRef.current;
      if (!history) {
        graph = { nodes: [], edges: [] };
        symbolsRef.current = null;
        symbolEdgesRef.current = [];
        testTreeRef.current = null;
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
        const range = commitRangeRef.current;
        // a range selection displays its end commit and highlights the union of
        // changes across the span; a single selection shows just that commit
        const shown = range ? Math.max(range[0], range[1]) : index;
        commitIndexRef.current = shown;
        const snapshot = history[shown]!.snapshot;
        graph = snapshotToAtlasGraph(snapshot);
        symbolsRef.current = snapshotSymbols(snapshot);
        symbolEdgesRef.current = snapshotSymbolEdges(snapshot);
        externalDepsRef.current = snapshotExternalDeps(snapshot);
        testTreeRef.current = snapshotTestTree(snapshot);
        if (range) applyRangeDiff(range[0], range[1]);
        else applyCommitDiff(shown);
      }
    } else if (p.source === "playwright") {
      const snapshot = playwrightSnapRef.current;
      if (!snapshot) {
        // fetch once, then rebuild with the real data
        graph = { nodes: [], edges: [] };
        symbolsRef.current = null;
        symbolEdgesRef.current = [];
        testTreeRef.current = null;
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
        externalDepsRef.current = snapshotExternalDeps(snapshot);
        testTreeRef.current = snapshotTestTree(snapshot);
      }
    } else if (p.source === "served") {
      const snapshot = servedSnapRef.current;
      if (!snapshot) {
        graph = { nodes: [], edges: [] };
        symbolsRef.current = null;
        symbolEdgesRef.current = [];
        testTreeRef.current = null;
        fetch("/api/snapshot")
          .then((r) => r.json())
          .then((json: SnapshotLike) => {
            servedSnapRef.current = json;
            if (paramsRef.current.source === "served") {
              rebuild(paramsRef.current);
              setFrame((f) => f + 1);
            }
          })
          .catch((error) => console.error("served snapshot load failed", error));
      } else {
        graph = snapshotToAtlasGraph(snapshot);
        symbolsRef.current = snapshotSymbols(snapshot);
        symbolEdgesRef.current = snapshotSymbolEdges(snapshot);
        externalDepsRef.current = snapshotExternalDeps(snapshot);
        testTreeRef.current = snapshotTestTree(snapshot);
      }
    } else {
      graph = createSyntheticGraph({ count: SYNTH_COUNT, seed });
      symbolsRef.current = null;
      symbolEdgesRef.current = synthesizeSymbolEdges(graph, seed);
      externalDepsRef.current = [];
      testTreeRef.current = null;
    }
    graphRef.current = graph;
    nextNodeId.current = SYNTH_COUNT;
    // reset the per-view lookups BEFORE the projection: effectiveGraph
    // registers the symbol labels, which a later wipe would erase
    innerLayoutsRef.current = new Map();
    symbolMetaRef.current = new Map();
    resetDetailRef.current();
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
  const structuralKey = `${params.source}|${params.layout}|${granularity}|${params.boundaries.join("+")}|${treemapSizeKey}|svc:${params.groupByService}`;
  // weight / filters re-flow warm (the diff animation); only granularity
  // and data swaps rebuild cold
  const shownPlanesKey = params.tilt.enabled
    ? Object.entries(params.tilt.layers)
        .filter(([, on]) => on)
        .map(([name]) => name)
        .sort()
        .join("+")
    : "";
  const detailKey = `${params.omit.join("+")}|${params.omitModules.join(",")}|planes:${shownPlanesKey}`;
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


  // the solver's animation loop (time-budgeted outer + inner stepping, paced
  // repaints); the central layout refs stay here as the whole render reads them
  useSolverLoop({
    ringsRef,
    treemapRef,
    innerLayoutsRef,
    innerCellsRef,
    innerDirtyRef,
    repaintSkipRef,
    paramsRef,
    syncInnerLayouts,
    convergenceTolerance: CONVERGENCE_TOLERANCE,
    onFrame: () => setFrame((f) => f + 1),
    // expose a settled signal for the rendering harness: a global flag + a
    // data-converged attribute on the map root, flipped as the layout settles.
    onSettleChange: (settled) => {
      (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged =
        settled;
      mapContainerRef.current?.setAttribute("data-converged", settled ? "1" : "0");
    },
  });

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
      symbolEdgesRef.current = synthesizeSymbolEdges(graphRef.current, seed);
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

  /**
   * Apply a freshly re-analyzed snapshot from the live stream: refresh the
   * symbol/edge/dep projections, then either cold-rebuild (symbol granularity,
   * so new symbols get laid out) or warm-apply the graph delta in place (file
   * granularity), keeping camera + positions. This is what makes fs edits show
   * up — symbols and import edges, not just file sizes.
   */
  const applyServedSnapshot = (snap: SnapshotLike) => {
    // the stream re-analyzes on any fs event; ignore a re-emitted snapshot whose
    // content is unchanged so an LSP/editor touching files never reshuffles the
    // map "with no code change"
    const sig = snapshotSignature(snap);
    if (sig === lastSnapSigRef.current) return;
    lastSnapSigRef.current = sig;
    servedSnapRef.current = snap;
    symbolsRef.current = snapshotSymbols(snap);
    symbolEdgesRef.current = snapshotSymbolEdges(snap);
    externalDepsRef.current = snapshotExternalDeps(snap);
    testTreeRef.current = snapshotTestTree(snap);
    const symbolGranularity =
      granularityOf(
        paramsRef.current.boundaries,
        paramsRef.current.displayLevels,
      ) === "symbol";
    if (symbolGranularity) {
      rebuild(paramsRef.current);
      setFrame((f) => f + 1);
      return;
    }
    const prev = graphRef.current;
    const nextGraph = snapshotToAtlasGraph(snap);
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
    // a cold rebuild re-solves the layout for the commit's snapshot so the
    // changed symbols actually surface (a warm reflow leaves new leaves
    // folded, hiding the diff at symbol granularity)
    commitIndexRef.current = index;
    rebuild(paramsRef.current);
    setFrame((f) => f + 1);
  };

  /** Timeline click: show a single commit, dropping any range selection. */
  const selectCommit = (index: number) => {
    const hadRange = commitRangeRef.current !== null;
    commitRangeRef.current = null;
    if (index === commitIndexRef.current) {
      if (hadRange) {
        rebuild(paramsRef.current);
        setFrame((f) => f + 1);
      }
      return;
    }
    goToCommit(index);
  };

  /** Timeline shift-click: select the inclusive range from `anchor` to `index`,
   * display its end commit, and highlight every node changed across the span. */
  const selectCommitRange = (anchor: number, index: number) => {
    const history = commitsRef.current;
    if (!history) return;
    const lo = Math.max(0, Math.min(anchor, index));
    const hi = Math.min(history.length - 1, Math.max(anchor, index));
    commitRangeRef.current = [lo, hi];
    commitIndexRef.current = hi;
    rebuild(paramsRef.current);
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
  /** Diff kind for any leaf, file or symbol. A file matches directly; a symbol
   * inherits its file's change so the diff stays visible at symbol granularity,
   * with its own precise change (history) taking priority when present. */
  const changedOf = (id: string): "added" | "modified" | undefined => {
    const direct = changedFilesRef.current.get(id);
    if (direct) return direct;
    const file = parentFileOf(id);
    if (file === id) return undefined;
    return (
      changedSymbolsRef.current.get(id) ?? changedFilesRef.current.get(file)
    );
  };

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
      // the per-module "(rest):<module>" bucket is an implementation detail
      // (it holds every non-class symbol) — show it as the module scope
      const label = hit.id.startsWith("(rest):")
        ? "(module scope)"
        : hit.id.split("/").pop()!;
      parts.push({ id: hit.id, label });
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
  /** Strata visibility set fed to the map components (level kinds). */
  const visibleLevels = useMemo(
    // the leaf always draws even though "file" lives on the boundary axis,
    // not the display axis (its outline is zoom-gated, not toggled)
    () => new Set<string>([...params.displayLevels, granularity]),
    [params.displayLevels, granularity],
  );
  /** Top-level scopes present in the loaded graph — the include-list
   * candidates. Derived from the raw graph so excluded scopes stay
   * listed. */
  const availableScopes = useMemo(() => {
    return [...new Set(graphRef.current.nodes.map((n) => scopeOf(n.id)))].sort();
    // graphRef refreshes only on rebuild; leafGraph tracks that identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafGraph]);

  // pick an edge, then frame its endpoints on a plain (replacing) click — the
  // camera half of the selection lives here where the geometry does
  const selectEdge = (source: string, target: string, additive = false) => {
    if (selectEdgeState(source, target, additive)) focusOnIds([source, target], 1.4);
  };

  // hold alt to reveal every cross-layer edge at once (default is hover-gated)
  const altEdges = useAltKey();

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
  // per-connection bookkeeping for the working-diff handler (reset on each
  // (re)subscribe via onOpen); the handler itself stays here as it drives the
  // data pipeline (warm-apply / rebuild / camera follow).
  const firstPushRef = useRef(true);
  const seenChangesRef = useRef(new Set<string>());
  // live working-tree diff for the dev server (sprawlens) and the CLI (served);
  // the server resolves an unknown repo name to its only repo.
  const liveDiff = params.source === "sprawlens" || params.source === "served";
  useEventSource(
    liveDiff
      ? `/api/working-diff/stream?repo=${params.source}&base=${encodeURIComponent(params.diffBase)}`
      : null,
    {
      onOpen: () => {
        firstPushRef.current = true;
        seenChangesRef.current = new Set();
        // drop any stale diff carried over from a previous source (e.g. history)
        if (changedFilesRef.current.size > 0) {
          changedFilesRef.current = new Map();
          setFrame((f) => f + 1);
        }
      },
      onMessage: (data) => {
        const diff = JSON.parse(data) as {
          changed: Record<string, "added" | "modified">;
          removed: string[];
          loc?: Record<string, number>;
        };
        // incremental recompute: turn the working-tree diff into a graph delta
        // and warm-apply it so edited files re-flow in place. Gated by
        // followChanges — off keeps the highlight-only behavior.
        if (paramsRef.current.followChanges) {
          applyWorkingTreeDiff(diff);
        }
        const known = new Set(graphRef.current.nodes.map((n) => n.id));
        const next = new Map(
          Object.entries(diff.changed).filter(([id]) => known.has(id)),
        );
        const seen = seenChangesRef.current;
        const fresh = [...next.keys()].filter((id) => !seen.has(id));
        seen.clear();
        for (const id of next.keys()) seen.add(id);
        const previous = changedFilesRef.current;
        const dirty =
          previous.size !== next.size ||
          [...next].some(([id, kind]) => previous.get(id) !== kind);
        if (dirty) {
          changedFilesRef.current = next;
          // at symbol granularity a warm reflow leaves the changed (esp. private)
          // symbols folded, so the diff never shows; a cold rebuild lays them out
          // with the keep/priority boost. file granularity recolors in place.
          if (
            granularityOf(
              paramsRef.current.boundaries,
              paramsRef.current.displayLevels,
            ) === "symbol"
          ) {
            rebuild(paramsRef.current);
          }
          setFrame((f) => f + 1);
        }
        if (!firstPushRef.current && fresh.length > 0) {
          const now = Date.now();
          recentChangesRef.current = [
            ...fresh.map((id) => ({ id, kind: next.get(id)!, at: now })),
            ...recentChangesRef.current.filter((e) => !fresh.includes(e.id)),
          ].slice(0, 20);
          // follow saves as they happen, but not the backlog at page load
          if (paramsRef.current.followChanges) jumpTo(fresh[0]!, 6);
        }
        firstPushRef.current = false;
      },
    },
  );

  // Live snapshot stream (CLI serve): the server re-analyzes on fs change and
  // pushes a fresh snapshot, which we warm-apply so symbols + import edges
  // update in place. Only the served source has a live analyzer; the baked and
  // history sources have none, so the stream 404s and stays closed.
  useEventSource(
    params.source === "served" ? `/api/snapshot/stream?repo=${params.source}` : null,
    {
      onMessage: (data) => {
        try {
          applyServedSnapshot(JSON.parse(data) as SnapshotLike);
        } catch (error) {
          console.error("snapshot stream", error);
        }
      },
    },
  );

  const allCells: CellResult[] = ringsRef.current
    ? [...ringsRef.current.leafLayouts.values()].flatMap((l) => l.cells)
    : treemapRef.current
      ? [...treemapRef.current.leafLayouts.values()].flatMap((l) => l.cells)
      : [];
  const allInnerCells = innerCellsRef.current;
  const testFileIds = testFileIdsRef.current;
  const testTargets = testTargetsRef.current;
  // per-symbol detail (call hierarchy + CFG), fetched from the provider's
  // neutral detail endpoints — LSP today, tree-sitter / moon ide tomorrow
  const {
    detailOverlayEdges,
    cfgEntries,
    hierarchyVersion,
    resetDetail,
    detailEdgesOf,
  } = useSymbolDetail({
    activeId,
    selectedIds,
    selectedIdsRef,
    granularity,
    visibleLevels,
    zoom: viewInfo.zoom,
    allCells,
    allInnerCells,
    paramsRef,
    graphRef,
    symbolsRef,
    displayGraphRef,
    symbolEdgesRef,
    source: params.source,
    displayLevels: params.displayLevels,
  });
  resetDetailRef.current = resetDetail;
  // every stacked plane below the source is a SolvedLayer built by the same
  // pipeline (layout + cross-layer links); adding a layer type is one builder
  const enabledPlanesKey = Object.entries(params.tilt.layers)
    .filter(([, on]) => on)
    .map(([name]) => name)
    .sort()
    .join("+");
  // per-test covered symbols (from --test-traces): links each case cell to the
  // source it exercised, drawn by the existing cross-layer ropes.
  const testCovers = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!testRun) return map;
    for (const [id, ids] of Object.entries(testRunOverlay(testRun).coversOf))
      map.set(id, ids);
    return map;
  }, [testRun]);
  const satelliteLayers = useMemo(() => {
    if (!params.tilt.enabled || enabledPlanesKey === "") return [];
    const ext =
      params.layout === "rings" ? { width: WIDTH, height: HEIGHT } : mapSize;
    return buildSatelliteLayers({
      manifest: layerManifest,
      enabled: new Set(enabledPlanesKey.split("+")),
      graph: graphRef.current,
      externalDeps: externalDepsRef.current,
      testTree: testTreeRef.current,
      coversOf: testCovers,
      ext,
      labelOf: (id) => labelsRef.current.get(id) ?? id.split("/").pop() ?? id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leafGraph,
    params.tilt.enabled,
    enabledPlanesKey,
    layerManifest,
    params.layout,
    mapSize,
    testCovers,
  ]);
  // the files every plane's edges point at; budget ensures they keep a cell.
  // when the set changes (planes toggled), rebuild so the budget re-applies.
  useEffect(() => {
    const next = new Set<string>();
    for (const layer of satelliteLayers)
      for (const n of layer.placed) for (const sid of n.sourceIds) next.add(sid);
    const prev = referencedFilesRef.current;
    const changed =
      prev.size !== next.size || [...next].some((f) => !prev.has(f));
    if (changed) {
      referencedFilesRef.current = next;
      rebuild(paramsRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satelliteLayers]);
  // refit the camera to the whole stack whenever the layer set changes (or the
  // viewport resizes) so a newly added / removed plane is framed full-screen
  useEffect(() => {
    const ext =
      params.layout === "rings" ? { width: WIDTH, height: HEIGHT } : mapSize;
    if (!params.tilt.enabled || satelliteLayers.length === 0) {
      focusBounds({ x0: 0, y0: 0, x1: ext.width, y1: ext.height }, 1.04);
      return;
    }
    const center = { x: ext.width / 2, y: ext.height / 2 };
    const opts = {
      theta: params.tilt.theta,
      squash: Math.cos(params.tilt.pitch),
      center,
    };
    const gap = params.tilt.gap * ext.height;
    const corners = [
      { x: 0, y: 0 },
      { x: ext.width, y: 0 },
      { x: ext.width, y: ext.height },
      { x: 0, y: ext.height },
    ];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i <= satelliteLayers.length; i++) {
      const t = layerTransform({ ...opts, gap, index: i });
      for (const c of corners) {
        const p = apply(t, c);
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
    }
    focusBounds({ x0, y0, x1, y1 }, 1.04);
    // depend on the layer *count*, not the satelliteLayers array identity: the
    // array is rebuilt on every re-analysis snapshot (it tracks leafGraph), and
    // refitting then would stomp the user's zoom/pan on every live update. The
    // refit only needs to fire when a plane is added/removed (count changes) or
    // the viewport/layout/tilt changes — never on a same-shape data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satelliteLayers.length, params.tilt.enabled, params.layout, mapSize]);
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
  // the full ingested/run result for the selected test — drives the log panel.
  // Keyed off activeId directly (not selectedTest) so it works whether the test
  // was picked from the dot panel or a test-plane cell.
  const selectedTestResult =
    activeId && testRun
      ? (testRun.results.find((r) => r.testId === activeId) ?? null)
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
      // display-only call-hierarchy overlay of the active root
      ...detailEdgesOf(activeId),
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

  const innerCells = showsSymbolLevels(params.displayLevels)
    ? allInnerCells
    : [];
  // project the trace onto symbol-keyed edges + heat for the overlay. A loaded
  // timeline drives a moving comet at the playback cursor; otherwise an ingested
  // static trace lights its whole call path at once.
  const { traceEdges, traceHeat } = useMemo(() => {
    if (timeline) return projectTimelineCursor(timeline, timelineCursor);
    if (!trace) return { traceEdges: [] as AtlasEdge[], traceHeat: new Map<string, number>() };
    const overlay = traceOverlay(trace);
    const edges: AtlasEdge[] = overlay.edges.map((e) => ({
      source: e.from,
      target: e.to,
    }));
    const heat = new Map<string, number>();
    for (const [id, weight] of Object.entries(overlay.nodeWeight))
      heat.set(id, overlay.maxNodeWeight > 0 ? weight / overlay.maxNodeWeight : 0);
    return { traceEdges: edges, traceHeat: heat };
  }, [trace, timeline, timelineCursor]);
  // playback: advance the cursor by captured wall-clock so the whole trace plays
  // in ~12s regardless of how long the real run took. Restarts from 0 if resumed
  // at the end. Driven by rAF; re-armed only when the timeline or play state flips.
  useEffect(() => {
    if (!timeline || !timelinePlaying) return;
    const dur = timelineDurationUs(timeline);
    const rate = dur / 12; // captured µs per real second
    let cursor = timelineCursor >= timeline.steps.length - 1 ? 0 : timelineCursor;
    let posUs = stepClockUs(timeline, cursor);
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      posUs += ((now - last) / 1000) * rate;
      last = now;
      while (cursor + 1 < timeline.steps.length && stepClockUs(timeline, cursor + 1) <= posUs)
        cursor++;
      setTimelineCursor(cursor);
      if (cursor >= timeline.steps.length - 1) {
        setTimelinePlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, timelinePlaying]);
  // project the ingested test run onto test-case-id-keyed status + duration maps
  const { testStatus, testDuration } = useMemo(() => {
    if (!testRun)
      return {
        testStatus: new Map<string, TestStatus>(),
        testDuration: new Map<string, number>(),
      };
    const overlay = testRunOverlay(testRun);
    return {
      testStatus: new Map<string, TestStatus>(
        Object.entries(overlay.statusOf),
      ),
      testDuration: new Map<string, number>(Object.entries(overlay.durationOf)),
    };
  }, [testRun]);
  /** Alt+drag on the map: horizontal rotates the plane, vertical pitches it.
   * Auto-enables tilt so the gesture is self-explanatory. */
  const onTiltDrag = (dxPx: number, dyPx: number) => {
    setParams((p) => ({
      ...p,
      tilt: {
        ...p.tilt,
        enabled: true,
        theta: p.tilt.theta + dxPx * 0.01,
        pitch: Math.min(
          Math.max(p.tilt.pitch + dyPx * 0.01, 0),
          (80 * Math.PI) / 180,
        ),
      },
    }));
  };

  /** Parent file name for disambiguating symbol references in lists. */
  const fileOf = (id: string) => {
    if (id.includes("#")) return id.split("#")[0]!.split("/").pop()!;
    if (id.startsWith("symbol:")) return id.split(":")[1]!.split("/").pop()!;
    return "";
  };

  // The renderer boundary: assemble the renderer-agnostic scene + interaction
  // handlers, then hand them to a renderer (SVG today). Fields identical across
  // layouts live in `common`; each layout adds its own geometry + affordances.
  const handlers: MapHandlers = {
    selectedId: activeId,
    selectedIds: selectedIdSet,
    selectedEdges,
    focusRequest,
    onSelect: selectNode,
    onSelectEdge: selectEdge,
    onFocusId: jumpTo,
    onTiltDrag,
    onViewSettle,
    onSymbolHover,
    onRunTest,
  };
  const scene = buildScene({
    rings: ringsRef.current,
    treemap: treemapRef.current,
    granularity,
    innerCells,
    displayEdges: displayGraphRef.current.edges,
    graphEdges: graphRef.current.edges,
    symbolEdges: symbolEdgesRef.current,
    detailEdges: detailOverlayEdges,
    traceEdges,
    traceHeat,
    testStatus,
    testDuration,
    visibleLevels,
    cfgEntries,
    cyclicIds,
    cyclicModuleIds,
    labels,
    exportedIds,
    symbolKindOf,
    focus: focusView,
    testFileIds,
    layers: satelliteLayers,
    altEdges,
    parentFileOf,
    changedOf,
    portNodes,
    hiddenLayers: new Set(hiddenLayersOf(params.omit)),
    showEdges: params.showEdges,
    tilt: params.tilt,
    labelMinPx: params.labelMinPx,
    labelScale: params.labelScale,
    ringsExtent: { width: WIDTH, height: HEIGHT },
    treemapExtent: mapSize,
  });

  // the service layer (terraform) only exists when the repo has .tf that
  // resolves to services; otherwise the toggle is hidden, not just inert
  const hasServiceLayer = (serviceGraph?.services.length ?? 0) > 0;

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily: "Monaco, ui-monospace, Menlo, monospace",
        background: PAGE_BG,
        color: INK,
        colorScheme: params.dark ? "dark" : "light",
      }}
    >
      <div
        ref={mapContainerRef}
        style={{
          position: "absolute",
          inset: "0",
          background: MAP_BG,
          overflow: "hidden",
        }}
      >
        {scene ? <SvgRenderer scene={scene} {...handlers} /> : null}
        {/* upper service layer (terraform): a full-map overlay when toggled on */}
        {servicesMode && hasServiceLayer ? (
          <div style={{ position: "absolute", inset: "0", background: MAP_BG }}>
            <ServicesView graph={serviceGraph} dark={params.dark} ink={INK} />
          </div>
        ) : null}
        {/* toggle: code map ⇄ services (terraform upper layer). Only offered
            when the repo actually has a recognized service layer (.tf). */}
        {hasServiceLayer ? (
          <button
            onClick={() => setServicesMode((v) => !v)}
            title="toggle the terraform service layer"
            style={{
              position: "absolute",
              top: "8px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 70,
              padding: "4px 12px",
              fontSize: "11px",
              fontFamily: "inherit",
              cursor: "pointer",
              borderRadius: "999px",
              border: `1px solid ${PANEL_BORDER}`,
              background: servicesMode ? "#0891b2" : PANEL_BG,
              color: servicesMode ? "#fff" : INK,
            }}
          >
            {servicesMode ? "● services" : "○ services"}
          </button>
        ) : null}
        {/* LSP hover tooltip, pinned top-right below the header so it never
            sits under the cursor; code fences syntax-highlighted, prose kept */}
        {hoverTip ? (
          <div
            style={{
              position: "absolute",
              top: "48px",
              right: "12px",
              maxWidth: "420px",
              maxHeight: "60vh",
              overflow: "auto",
              background: PANEL_BG,
              color: INK,
              border: `1px solid ${PANEL_BORDER}`,
              borderRadius: "6px",
              padding: "8px 10px",
              fontSize: "11px",
              lineHeight: "1.45",
              wordBreak: "break-word",
              pointerEvents: "none",
              zIndex: 60,
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            }}
          >
            {parseHoverMarkdown(hoverTip).map((block, bi) =>
              block.type === "code" ? (
                <pre
                  key={bi}
                  style={{
                    margin: bi === 0 ? 0 : "6px 0 0",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "11px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {tokenizeCode(block.text).map((tok, ti) => (
                    <span
                      key={ti}
                      style={{
                        color:
                          HIGHLIGHT_THEME[params.dark ? "dark" : "light"][
                            tok.kind
                          ],
                      }}
                    >
                      {tok.text}
                    </span>
                  ))}
                </pre>
              ) : (
                <div
                  key={bi}
                  style={{
                    margin: bi === 0 ? 0 : "6px 0 0",
                    whiteSpace: "pre-wrap",
                    opacity: 0.85,
                  }}
                >
                  {block.text}
                </div>
              ),
            )}
          </div>
        ) : null}
        {/* hierarchy breadcrumb: selection path, or the crosshair target */}
        {breadcrumb.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: "8px",
              // clear the layers hamburger button (top-left)
              left: "48px",
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
          experimentalOn ? (
          <>
            {/* toggle the commit-log layout (vertical list ⇄ horizontal bar) */}
            <button
              onClick={() =>
                setHistoryOrientation((o) => (o === "vertical" ? "horizontal" : "vertical"))
              }
              title="toggle commit-log layout"
              style={{
                position: "absolute",
                top: 12,
                right: historyOrientation === "vertical" ? 340 : 12,
                zIndex: 31,
                cursor: "pointer",
                padding: "3px 8px",
                borderRadius: 6,
                border: "none",
                background: "rgba(15,23,42,0.86)",
                color: "#e2e8f0",
                fontSize: 11,
              }}
            >
              {historyOrientation === "vertical" ? "⇄ horizontal" : "⇄ vertical"}
            </button>
            {historyOrientation === "vertical" ? (
              <CommitLog
                commits={commitsRef.current}
                index={commitIndexRef.current}
                range={commitRangeRef.current}
                onSelect={selectCommit}
                onRangeSelect={selectCommitRange}
              />
            ) : (
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
                  onClick={() => selectCommit(commitIndexRef.current - 1)}
                  style={{ cursor: "pointer", padding: "2px 8px" }}
                >
                  ◀
                </button>
                <HistoryTimeline
                  commits={commitsRef.current}
                  index={commitIndexRef.current}
                  range={commitRangeRef.current}
                  onSelect={selectCommit}
                  onRangeSelect={selectCommitRange}
                />
                <button
                  onClick={() => selectCommit(commitIndexRef.current + 1)}
                  style={{ cursor: "pointer", padding: "2px 8px" }}
                >
                  ▶
                </button>
                <span style={{ color: MUTED_INK, whiteSpace: "nowrap" }}>
                  +{lastDiffRef.current.added} ~{lastDiffRef.current.modified} −
                  {lastDiffRef.current.removed}
                </span>
              </div>
            )}
          </>
          ) : (
            // stable (non-experimental) history navigation: a plain slider
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
                onInput={(e) => goToCommit(Number((e.target as HTMLInputElement).value))}
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
                <b>{commitsRef.current[commitIndexRef.current]?.shortHash}</b>{" "}
                {commitsRef.current[commitIndexRef.current]?.message.split("\n")[0] ?? ""}
              </span>
              <span style={{ color: MUTED_INK, whiteSpace: "nowrap" }}>
                +{lastDiffRef.current.added} ~{lastDiffRef.current.modified} −
                {lastDiffRef.current.removed}
              </span>
            </div>
          )
        ) : null}
        {/* floating overlays: structural axes + view options (left drawer),
            camera / dark / GitHub (top-right) */}
        <LayersMenu
          params={params}
          availableScopes={availableScopes}
          planes={layerManifest.map((l) => l.name)}
          onChange={onControlsChange}
        >
          <Controls
            params={params}
            availableScopes={availableScopes}
            debug={DEBUG}
            onChange={onControlsChange}
            onRegenerate={() => rebuild(paramsRef.current)}
            onMutateWeight={mutateWeight}
            onAddNode={addNode}
            onRemoveNode={removeNode}
          />
        </LayersMenu>
        <CameraPanel params={params} onChange={onControlsChange} />
        {/* dev toggle for experimental features (the --experimental flag forces
            them on regardless; this only flips the URL opt-in) */}
        <button
          onClick={() => setUrlParams({ experimental: urlParams.experimental ? null : true })}
          title="toggle experimental features"
          style={{
            position: "absolute",
            left: 8,
            top: 44,
            zIndex: 3,
            cursor: "pointer",
            padding: "2px 8px",
            borderRadius: 6,
            border: "none",
            background: experimentalOn ? "#7c3aed" : "rgba(15,23,42,0.6)",
            color: "#e2e8f0",
            fontSize: 10,
            opacity: 0.85,
          }}
        >
          exp {experimentalOn ? "on" : "off"}
        </button>
        {experimentalOn && testRun ? (
          <TestReporterPanel
            results={testRun.results}
            activeId={activeId}
            onSelect={(testId) => jumpTo(testId, 6)}
          />
        ) : null}
        {experimentalOn && timeline ? (
          <TracePlayer
            timeline={timeline}
            cursor={timelineCursor}
            playing={timelinePlaying}
            onCursor={(c) => {
              setTimelinePlaying(false);
              setTimelineCursor(c);
            }}
            onTogglePlay={() => setTimelinePlaying((p) => !p)}
          />
        ) : null}
      </div>
      {/* detail / history overlay: floats over the right of the full-screen
          map, only when there is a selection or recent change to show */}
      {/* working-tree change log: small overlay, bottom-left */}
      {recentChangesRef.current.length > 0 ? (
        <div
          style={{
            position: "absolute",
            left: "8px",
            bottom: "8px",
            width: "260px",
            maxHeight: "40vh",
            overflowY: "auto",
            background: PANEL_BG,
            border: `1px solid ${PANEL_BORDER}`,
            borderRadius: "10px",
            padding: "8px 10px",
            fontSize: "12px",
            color: INK,
          }}
        >
          <div style={{ fontWeight: "600", marginBottom: "4px" }}>Change history</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
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
                  color: entry.kind === "added" ? "#34d399" : "#fbbf24",
                  textAlign: "left",
                  wordBreak: "break-all",
                }}
              >
                {new Date(entry.at).toLocaleTimeString()} {labelOf(entry.id)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {/* selected nodes: closeable cards stacking up from the bottom-right */}
      {selectedIds.length > 0 ? (
        <div
          style={{
            position: "absolute",
            right: "8px",
            bottom: "8px",
            width: "300px",
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "calc(100vh - 60px)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            overflowY: "auto",
            fontSize: "12px",
          }}
        >
          {selectedIds.map((id) => {
            const isActive = id === activeId;
            return (
              <div
                key={id}
                style={{
                  flex: "none",
                  background: PANEL_BG,
                  border: `1px solid ${id === selectedId ? SELECT_STROKE : PANEL_BORDER}`,
                  borderRadius: "10px",
                  padding: "8px 10px",
                  color: INK,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <button
                    onClick={() => promoteToPrimary(id)}
                    style={{
                      flex: "1",
                      minWidth: "0",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      color: INK,
                      cursor: "pointer",
                      fontWeight: "600",
                      wordBreak: "break-all",
                      padding: "0",
                    }}
                  >
                    {labelOf(id)}
                    {isActive ? (
                      <span style={{ color: MUTED_INK, fontWeight: "400" }}>
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
                      </span>
                    ) : null}
                  </button>
                  <button
                    title="close"
                    onClick={() => deselect(id)}
                    style={{
                      flex: "none",
                      background: "none",
                      border: "none",
                      color: MUTED_INK,
                      cursor: "pointer",
                      fontSize: "15px",
                      lineHeight: "1",
                      padding: "0 2px",
                    }}
                  >
                    ×
                  </button>
                </div>
                {isActive ? (
                  <div style={{ maxHeight: "42vh", overflowY: "auto", marginTop: "6px" }}>
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
            {experimentalOn && selectedTestResult ? (
              <TestLogPanel result={selectedTestResult} />
            ) : null}
            {params.source === "sprawlens-history" &&
            activeId &&
            historyIndexRef.current?.nodeHistory.has(activeId) ? (
              <div style={{ marginTop: "6px" }}>
                <div style={{ fontWeight: "600" }}>
                  Change history (
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
                  </div>
                ) : null}
              </div>
            );
          })}
          {/* one action for the whole selected stack: focus merges every
              selected node's dependency paths (see focusRoots) */}
          <div style={{ display: "flex", flex: "none" }}>
            <button
              onClick={() => setFocusId(focusId ? null : activeId)}
              style={{
                flex: "1",
                padding: "6px 8px",
                fontSize: "12px",
                cursor: "pointer",
                background: PANEL_BG,
                color: INK,
                border: `1px solid ${PANEL_BORDER}`,
                borderRadius: "8px",
              }}
            >
              {focusId
                ? "Back to full view"
                : `Extract dependency paths (${selectedIds.length})`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
