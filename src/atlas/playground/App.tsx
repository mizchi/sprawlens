import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AtlasGraph, AtlasNode } from "../contracts/graph.js";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
  type ClipRegion,
} from "../kernel/capacityLayout.js";
import {
  createGraphLayout,
  embedSeedHints,
  forceIterationsFor,
} from "../kernel/pipeline.js";
import { centroid, containsPoint, type Ring } from "../kernel/polygon.js";
import { createRng, type Rng } from "../kernel/rng.js";
import { CellMapSvg } from "./CellMapSvg.tsx";
import { Controls, type ClipKind, type PlaygroundParams } from "./Controls.tsx";
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
import { defaultLayerOf, matchTestTargets } from "../contracts/layers.js";
import { defaultModuleIdOf } from "../contracts/modules.js";
import { apiModuleIdOf, buildApiGraph, splitApiBoundary } from "./apiView.ts";
import { resolveSelection, reweightByPageRank } from "./viewConfig.ts";
import { fetchCallHierarchy, refsToEdges } from "./callHierarchyClient.ts";
import {
  buildHistoryIndex,
  diffGraphs,
  type HistoryEntry,
  type HistoryIndex,
} from "./history.ts";

const WIDTH = 960;
const HEIGHT = 640;
const CONVERGENCE_TOLERANCE = 0.02;
/** Zoom past this implicitly focuses the crosshair target (no selection). */
/**
 * Zoom focus engages only when the crosshair target fills this share of
 * the viewport — containing the center point alone is not enough, or a
 * sliver of a small neighboring file would steal the focus.
 */
const AUTOFOCUS_AREA_FRACTION = 0.12;
/** Call-hierarchy roots kept in memory; older unselected ones evict. */
const LSP_CACHE_MAX = 8;

function clipOf(kind: ClipKind): ClipRegion {
  return kind === "rect"
    ? { kind: "rect", x: 0, y: 0, width: WIDTH, height: HEIGHT }
    : { kind: "circle", cx: WIDTH / 2, cy: HEIGHT / 2, r: HEIGHT / 2 - 10 };
}

/** 16-gon is the circle clip with a coarse polygonization. */
function segmentsOf(kind: ClipKind): number {
  return kind === "hexadecagon" ? 16 : 64;
}

/** Shrink a convex ring toward its centroid so nested cells stay visually inside. */
function insetRing(ring: Ring, factor: number): Ring {
  const c = centroid(ring);
  return ring.map((p) => ({
    x: c.x + (p.x - c.x) * factor,
    y: c.y + (p.y - c.y) * factor,
  }));
}

function Sparkline(props: { values: number[] }) {
  const w = 220;
  const h = 48;
  const points = props.values
    .map((v, i) => {
      // log scale: 100% error at top, 0.1% at bottom
      const y = h - (h * (Math.log10(Math.max(v, 1e-3)) + 3)) / 3;
      const x = (i / Math.max(props.values.length - 1, 1)) * w;
      return `${x},${Math.min(Math.max(y, 0), h)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: `${w}px`, height: `${h}px` }}>
      <rect width={w} height={h} fill="#f1f5f9" />
      <line
        x1={0}
        x2={w}
        y1={h - (h * (Math.log10(0.02) + 3)) / 3}
        y2={h - (h * (Math.log10(0.02) + 3)) / 3}
        stroke="#94a3b8"
        stroke-dasharray="3 3"
      />
      <polyline points={points} fill="none" stroke="#dc2626" stroke-width={1.5} />
    </svg>
  );
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
        background: "#f8fafc",
        borderRadius: "6px",
        border: "1px solid #cbd5e1",
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
    layout: "rings",
    granularity: "file",
    weight: "loc",
    hidePrivate: false,
    focusGranularity: "file",
    selectMode: "auto",
    deselectOffscreen: true,
    followChanges: true,
    diffBase: "",
    invertRings: false,
    count: 120,
    seed: 1,
    clipKind: "circle",
    adaptationRate: 0.8,
    lloydRate: 0.7,
    stepsPerFrame: 2,
    // ambient edges add noise; macro module deps are opt-in via this toggle
    showEdges: false,
    showNested: true,
    hiddenLayers: [],
  });
  // multi-select: ordered ids, last one is the primary (drives the detail
  // panel, breadcrumb, and labels); shift+click toggles membership
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const setSelectedId = (id: string | null) =>
    setSelectedIds(id === null ? [] : [id]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [viewInfo, setViewInfo] = useState({
    x: WIDTH / 2,
    y: HEIGHT / 2,
    zoom: 1,
  });
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
  const layoutRef = useRef<CapacityLayoutState | null>(null);
  const ringsRef = useRef<RingsState | null>(null);
  const historyRef = useRef<number[]>([]);
  const fpsRef = useRef({ last: 0, ema: 0 });
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const mutationRng = useRef<Rng>(createRng(0xc0ffee));
  const nextNodeId = useRef(0);
  const innerLayoutsRef = useRef(new Map<string, CapacityLayoutState>());
  /** Real per-file symbols when a fixture is loaded; null = synthesize. */
  const symbolsRef = useRef<Map<string, AtlasNode[]> | null>(null);
  /** Symbol references (call-hierarchy precursor); endpoints: symbol or file ids. */
  const symbolEdgesRef = useRef<AtlasEdge[]>([]);
  /** Per-symbol metadata accumulated as nested layouts materialize. */
  const symbolMetaRef = useRef(
    new Map<string, { exported: boolean; fileId: string }>(),
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

  const ringsOptions = (p: PlaygroundParams) => ({
    width: WIDTH,
    height: HEIGHT,
    seed: p.seed,
    invert: p.invertRings,
    adaptationRate: p.adaptationRate,
    lloydRate: p.lloydRate,
    moduleIdOf: p.granularity === "symbol" ? apiModuleIdOf : undefined,
  });

  const symbolsForFile = (fileId: string): AtlasNode[] => {
    const real = symbolsRef.current?.get(fileId);
    if (real) return real;
    const loc = graphRef.current.nodes.find((n) => n.id === fileId)?.metrics
      .loc;
    return loc === undefined ? [] : synthesizeSymbols(fileId, loc, 1);
  };

  /** Graph minus hidden layers — what the layout actually subdivides. */
  const effectiveGraph = (p: PlaygroundParams): AtlasGraph => {
    let graph = graphRef.current;
    if (p.hiddenLayers.length) {
      const hidden = new Set(p.hiddenLayers);
      const nodes = graph.nodes.filter(
        (n) => !hidden.has(defaultLayerOf(n.id)),
      );
      const ids = new Set(nodes.map((n) => n.id));
      graph = {
        nodes,
        edges: graph.edges.filter(
          (e) => ids.has(e.source) && ids.has(e.target),
        ),
      };
    }
    if (p.granularity === "symbol") {
      const api = buildApiGraph(graph, symbolsForFile, symbolEdgesRef.current, {
        includePrivate: !p.hidePrivate,
        weight: p.weight,
      });
      // the network's labels come from the projected symbols
      for (const node of api.nodes) labelsRef.current.set(node.id, node.label);
      displayGraphRef.current = api;
      const split = splitApiBoundary(
        api,
        apiModuleIdOf,
        symbolEdgesRef.current,
      );
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
    }
    // file/module granularity: weight swaps in place — PageRank areas
    // follow how depended-upon a file is instead of its size
    if (p.weight === "pagerank") graph = reweightByPageRank(graph);
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
        if (paramsRef.current.hidePrivate) {
          const publicOnly = symbols.filter((s) => s.exported === true);
          if (publicOnly.length > 0) symbols = publicOnly;
        }
        for (const symbol of symbols) {
          symbolMetaRef.current.set(symbol.id, {
            exported: symbol.exported === true,
            fileId: cell.id,
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
      graph = createSyntheticGraph({ count: p.count, seed: p.seed });
      symbolsRef.current = null;
      symbolEdgesRef.current = synthesizeSymbolEdges(graph, p.seed);
    }
    graphRef.current = graph;
    nextNodeId.current = p.count;
    const visible = effectiveGraph(p);
    if (p.layout === "rings") {
      ringsRef.current = createRingsState(visible, ringsOptions(p));
      layoutRef.current = null;
    } else {
      const clip = clipOf(p.clipKind);
      const seedHints = embedSeedHints(visible, clip);
      layoutRef.current = createGraphLayout(visible, clip, {
        seed: p.seed,
        adaptationRate: p.adaptationRate,
        lloydRate: p.lloydRate,
        circleSegments: segmentsOf(p.clipKind),
        hints: seedHints ?? undefined,
        // unbudgeted force froze the page on monorepo-scale graphs
        forceIterations: seedHints
          ? 16
          : forceIterationsFor(visible.nodes.length),
      });
      ringsRef.current = null;
    }
    historyRef.current = [];
    innerLayoutsRef.current = new Map();
    symbolMetaRef.current = new Map();
    fetchedHierarchyRef.current = new Set();
    lspEdgesRef.current = new Map();
    labelsRef.current = new Map();
    exportedIdsRef.current = new Set();
    innerCellsRef.current = [];
    innerDirtyRef.current = true;
    refreshGraphLookups();
    setFocusId(null);
  };

  if (layoutRef.current === null && ringsRef.current === null) rebuild(params);

  // structural params trigger a rebuild; invert re-rings warm; solver params
  // only update options on the existing layout
  const structuralKey = `${params.source}|${params.layout}|${params.granularity}|${params.count}|${params.seed}|${params.clipKind}`;
  // weight / filters / invert re-flow warm (the diff animation); only
  // granularity and data swaps rebuild cold
  const flowKey = `${params.invertRings}|${params.hiddenLayers.join(",")}|${params.weight}|${params.hidePrivate}`;
  const structuralRef = useRef(structuralKey);
  const flowKeyRef = useRef(flowKey);
  const hidePrivateRef = useRef(params.hidePrivate);
  useEffect(() => {
    if (structuralRef.current !== structuralKey) {
      structuralRef.current = structuralKey;
      flowKeyRef.current = flowKey;
      hidePrivateRef.current = paramsRef.current.hidePrivate;
      rebuild(paramsRef.current);
      return;
    }
    if (flowKeyRef.current !== flowKey) {
      flowKeyRef.current = flowKey;
      if (hidePrivateRef.current !== params.hidePrivate) {
        hidePrivateRef.current = params.hidePrivate;
        // nested symbol layouts bake the private filter in: restart them
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
      } else {
        rebuild(paramsRef.current);
        return;
      }
    }
    if (layoutRef.current) {
      layoutRef.current = {
        ...layoutRef.current,
        options: {
          ...layoutRef.current.options,
          adaptationRate: params.adaptationRate,
          lloydRate: params.lloydRate,
        },
      };
    }
  }, [structuralKey, flowKey, params.adaptationRate, params.lloydRate]);

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
      const fps = fpsRef.current;
      if (fps.last > 0) {
        const instant = 1000 / (now - fps.last);
        fps.ema = fps.ema === 0 ? instant : fps.ema * 0.9 + instant * 0.1;
      }
      fps.last = now;

      // time-budgeted stepping: fixed step counts block the main thread for
      // seconds on monorepo-scale graphs. Hidden tabs get a bigger budget to
      // compensate for the ~1 tick/s timer throttling.
      const hidden = document.visibilityState === "hidden";
      const solverBudget = hidden ? 150 : 10;
      const innerBudget = hidden ? 60 : 6;
      const maxSteps = paramsRef.current.stepsPerFrame * (hidden ? 30 : 1);
      const solverStart = performance.now();
      let outerActive = false;
      let outerCells: CellResult[] = [];
      let maxError = 0;
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
        for (const layout of ringsRef.current.moduleLayouts.values()) {
          outerCells.push(...layout.cells);
          maxError = Math.max(maxError, layout.maxRelativeError);
        }
      } else if (layoutRef.current) {
        let state = layoutRef.current;
        outerActive = !isConverged(state, CONVERGENCE_TOLERANCE / 4);
        let steps = 0;
        while (
          outerActive &&
          steps < maxSteps &&
          performance.now() - solverStart < solverBudget
        ) {
          state = capacityStep(state);
          outerActive = !isConverged(state, CONVERGENCE_TOLERANCE / 4);
          steps++;
        }
        layoutRef.current = state;
        outerCells = state.cells;
        maxError = state.maxRelativeError;
      }
      if (outerActive) {
        historyRef.current = [...historyRef.current.slice(-179), maxError];
      }

      let innerActive = false;
      if (
        paramsRef.current.showNested &&
        paramsRef.current.granularity === "file"
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
      // layout would otherwise burn CPU at full frame rate
      if (outerActive || innerActive) setFrame((f) => f + 1);
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
    if (changedFileId) innerLayoutsRef.current.delete(changedFileId);
    if (paramsRef.current.source === "synthetic") {
      symbolEdgesRef.current = synthesizeSymbolEdges(
        graphRef.current,
        paramsRef.current.seed,
      );
    }
    setFrame((f) => f + 1);
  };

  /**
   * Display another commit of the loaded history: the commit's own diff
   * drives the highlight, and the warm-started re-flow IS the animation.
   */
  const goToCommit = (index: number) => {
    const history = commitsRef.current;
    if (!history || index < 0 || index >= history.length) return;
    if (index === commitIndexRef.current) return;
    const snapshot = history[index]!.snapshot;
    const nextGraph = snapshotToAtlasGraph(snapshot);
    // invalidation must compare displayed vs next (symbol ids carry line
    // numbers); the highlight uses the commit-vs-parent diff instead
    const scrub = diffGraphs(graphRef.current, nextGraph);
    for (const [id] of scrub.changed) innerLayoutsRef.current.delete(id);
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
    } else if (layoutRef.current) {
      const visible = effectiveGraph(paramsRef.current);
      const clip = clipOf(paramsRef.current.clipKind);
      const seedHints = embedSeedHints(visible, clip);
      layoutRef.current = createGraphLayout(visible, clip, {
        seed: paramsRef.current.seed,
        hints: seedHints ?? undefined,
        forceIterations: seedHints
          ? 16
          : forceIterationsFor(visible.nodes.length),
      });
    }
    setFrame((f) => f + 1);
  };

  /** Fly the camera to a view rect framing the target's bounding box. */
  const jumpTo = (id: string, padding = 2.5) => {
    setSelectedId(id);
    const innerCell = innerCellsRef.current.find((c) => c.id === id);
    const fileCell = ringsRef.current
      ? [...ringsRef.current.moduleLayouts.values()]
          .flatMap((l) => l.cells)
          .find((c) => c.id === id)
      : null;
    const circle = ringsRef.current?.circles.get(id);
    const port = portNodesRef.current.find((p) => p.id === id);
    let bbox: { cx: number; cy: number; w: number; h: number } | null = null;
    const polygon = innerCell?.polygon ?? fileCell?.polygon;
    if (polygon && polygon.length >= 3) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of polygon) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      bbox = {
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        w: maxX - minX,
        h: maxY - minY,
      };
    } else if (circle) {
      bbox = { cx: circle.cx, cy: circle.cy, w: circle.r * 2, h: circle.r * 2 };
    } else if (port) {
      bbox = { cx: port.x, cy: port.y, w: 60, h: 60 };
    }
    if (bbox) {
      // frame the bbox with padding: at the default the target ends up
      // ~40% of the view; larger paddings frame its neighborhood instead
      const viewW = Math.max(bbox.w, (bbox.h * WIDTH) / HEIGHT) * padding;
      setFocusRequest({
        cx: bbox.cx,
        cy: bbox.cy,
        viewW,
        token: (focusRequest?.token ?? 0) + 1,
      });
    }
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
    if (layoutRef.current) {
      layoutRef.current = applyGraphChanges(layoutRef.current, {
        upsert: [{ id: updated.id, weight: updated.metrics.loc }],
      });
    }
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
    if (layoutRef.current) {
      layoutRef.current = applyGraphChanges(layoutRef.current, {
        upsert: [{ id: node.id, weight: node.metrics.loc }],
      });
    }
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
    if (layoutRef.current) {
      layoutRef.current = applyGraphChanges(layoutRef.current, {
        remove: [node.id],
      });
    }
    afterGraphMutation(node.id);
    if (selectedId === node.id) setSelectedId(null);
  };

  /** Dependency-path extraction across the three levels. */
  const computeFocus = (id: string): FocusView | null => {
    const rings = ringsRef.current;
    if (!rings) return null;
    const fileToModule = new Map<string, string>();
    for (const [moduleId, layout] of rings.moduleLayouts) {
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

    if (rings.circles.has(id)) {
      const reach = reachSubgraph(rings.moduleEdges, id);
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

  /** API view: adapter ports placed on the rim, facing their consumers. */
  const portNodes = (() => {
    const rings = ringsRef.current;
    if (params.granularity !== "symbol" || !rings) return [];
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
    params.granularity === "symbol"
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
  const moduleEdgesNow = ringsRef.current?.moduleEdges ?? null;
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
    if (!rings) return [];
    const parts: { id: string; label: string }[] = [];
    const isSymbolId = (id: string) =>
      id.startsWith("symbol:") || id.includes("#");
    const moduleOfId = (id: string) =>
      params.granularity === "symbol"
        ? apiModuleIdOf(id)
        : defaultModuleIdOf(id);
    if (selectedId) {
      if (rings.circles.has(selectedId)) {
        parts.push({ id: selectedId, label: selectedId });
      } else if (isSymbolId(selectedId)) {
        const fileId = parentFileOf(selectedId);
        parts.push({ id: moduleOfId(fileId), label: moduleOfId(fileId) });
        if (params.granularity !== "symbol") {
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
    for (const [id, circle] of rings.circles) {
      if (Math.hypot(p.x - circle.cx, p.y - circle.cy) <= circle.r) {
        moduleId = id;
        break;
      }
    }
    if (!moduleId) return [];
    parts.push({ id: moduleId, label: moduleId });
    const layout = rings.moduleLayouts.get(moduleId);
    const cell = layout?.cells.find(
      (c) => c.polygon.length >= 3 && containsPoint(c.polygon, p),
    );
    if (cell) {
      parts.push({ id: cell.id, label: labelOf(cell.id) });
      if (viewInfo.zoom >= 2.2 && params.granularity === "file") {
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

  /**
   * Zoom focus: without an explicit selection, the crosshair target becomes
   * the implicit selection once it both contains the view center (the
   * breadcrumb hit-test) and fills enough of the screen. Candidates run
   * from focusGranularity upward: a file too small to dominate falls back
   * to its module, and so on. Explicit clicks always override; Esc clears
   * back to implicit.
   */
  const implicitId = (() => {
    if (selectedId || breadcrumb.length === 0) return null;
    const rings = ringsRef.current;
    if (!rings) return null;
    const viewportArea = (WIDTH * HEIGHT) / (viewInfo.zoom * viewInfo.zoom);
    const worldAreaOf = (id: string): number => {
      const circle = rings.circles.get(id);
      if (circle) return Math.PI * circle.r ** 2;
      const moduleLayout = rings.moduleLayouts.get(breadcrumb[0]!.id);
      const cell = moduleLayout?.cells.find((c) => c.id === id);
      if (cell) return cell.actualArea;
      const inner = innerLayoutsRef.current.get(parentFileOf(id));
      return inner?.cells.find((c) => c.id === id)?.actualArea ?? 0;
    };
    const depth = { module: 1, file: 2, symbol: 3 }[params.focusGranularity];
    for (let i = Math.min(depth, breadcrumb.length) - 1; i >= 0; i--) {
      const id = breadcrumb[i]!.id;
      if (worldAreaOf(id) >= viewportArea * AUTOFOCUS_AREA_FRACTION) return id;
    }
    return null;
  })();
  const activeId = selectedId ?? implicitId;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectNode = (id: string | null, additive = false) => {
    if (id === null) {
      setSelectedIds([]);
      // the dependency-path focus always tracks the selection — a stale
      // path over a different selection reads as a broken state
      setFocusId(null);
      return;
    }
    const resolved = resolveSelection(id, paramsRef.current.selectMode, {
      isModule: (x) => ringsRef.current?.circles.has(x) ?? false,
      parentFileOf,
      moduleOf: (x) =>
        paramsRef.current.granularity === "symbol"
          ? apiModuleIdOf(x)
          : defaultModuleIdOf(x),
    });
    const next = !additive
      ? [resolved]
      : selectedIds.includes(resolved)
        ? selectedIds.filter((x) => x !== resolved)
        : [...selectedIds, resolved];
    setSelectedIds(next);
    if (focusId !== null) {
      setFocusId(next[next.length - 1] ?? null);
    }
  };

  // Esc drops the explicit selection (zoom focus takes over again)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIds([]);
        setFocusId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Optional: an explicit selection drops once its element leaves the
  // viewport. Reacts to view settles only — never to the selection itself,
  // or a fresh jumpTo to an off-screen target would self-cancel against
  // the stale pre-flight view.
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  useEffect(() => {
    const ids = selectedIdsRef.current;
    if (ids.length === 0 || !paramsRef.current.deselectOffscreen) return;
    const halfW = WIDTH / viewInfo.zoom / 2;
    const halfH = HEIGHT / viewInfo.zoom / 2;
    const view = {
      x0: viewInfo.x - halfW,
      x1: viewInfo.x + halfW,
      y0: viewInfo.y - halfH,
      y1: viewInfo.y + halfH,
    };
    const boundsOf = (id: string) => {
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
        (ringsRef.current
          ? [...ringsRef.current.moduleLayouts.values()]
              .flatMap((l) => l.cells)
              .find((c) => c.id === id)
          : layoutRef.current?.cells.find((c) => c.id === id)) ??
        innerCellsRef.current.find((c) => c.id === id);
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
    const remaining = ids.filter((id) => {
      const bounds = boundsOf(id);
      if (!bounds) return true; // unknown geometry: keep, don't guess
      return !(
        bounds.x1 < view.x0 ||
        bounds.x0 > view.x1 ||
        bounds.y1 < view.y0 ||
        bounds.y0 > view.y1
      );
    });
    if (remaining.length !== ids.length) {
      setSelectedIds(remaining);
      // keep the path focus glued to the (new) primary selection
      setFocusId((current) =>
        current === null ? null : (remaining[remaining.length - 1] ?? null),
      );
    }
  }, [viewInfo]);

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
      };
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
    ? [...ringsRef.current.moduleLayouts.values()].flatMap((l) => l.cells)
    : (layoutRef.current?.cells ?? []);
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
    activeId !== null && (ringsRef.current?.circles.has(activeId) ?? false);
  const selectedTest =
    activeId !== null && testFileIds.has(activeId)
      ? (graphRef.current.nodes.find((n) => n.id === activeId) ?? null)
      : null;
  const selectedPort =
    activeId !== null && params.granularity === "symbol"
      ? (portNodesRef.current.find((p) => p.id === activeId) ?? null)
      : null;
  const selectedIsSymbol =
    selected !== null && !allCells.some((c) => c.id === selected.id);
  const selectedRefs = useMemo(() => {
    if (!activeId) return { incoming: [], outgoing: [] };
    const edges = [
      ...(paramsRef.current.granularity === "symbol"
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
  }, [activeId, hierarchyVersion, params.granularity]);

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
      (params.granularity === "symbol"
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
  const maxError = ringsRef.current
    ? Math.max(
        0,
        ...[...ringsRef.current.moduleLayouts.values()].map(
          (l) => l.maxRelativeError,
        ),
      )
    : (layoutRef.current?.maxRelativeError ?? 0);
  const innerCells = params.showNested ? allInnerCells : [];
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
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        background: "#e2e8f0",
      }}
    >
      <div
        style={{
          background: "#f8fafc",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
          position: "relative",
        }}
      >
        {ringsRef.current ? (
          <RingsMapSvg
            rings={ringsRef.current}
            innerCells={params.granularity === "file" ? innerCells : []}
            fileEdges={
              params.granularity === "symbol"
                ? displayGraphRef.current.edges
                : graphRef.current.edges
            }
            symbolEdges={
              params.granularity === "symbol"
                ? displayGraphRef.current.edges
                : symbolEdgesRef.current
            }
            lspEdges={lspOverlayEdges}
            showEdges={params.showEdges || params.granularity === "symbol"}
            showFiles={params.granularity !== "module"}
            compactModuleLabels={params.granularity === "symbol"}
            cyclicIds={cyclicIds}
            cyclicModuleIds={cyclicModuleIds}
            labels={labels}
            exportedIds={exportedIds}
            focus={focusView}
            testFileIds={testFileIds}
            hiddenLayers={new Set(params.hiddenLayers)}
            parentFileOf={parentFileOf}
            changedFiles={changedFilesRef.current}
            portNodes={portNodes}
            width={WIDTH}
            height={HEIGHT}
            selectedId={activeId}
            selectedIds={selectedIdSet}
            onSelect={selectNode}
            focusRequest={focusRequest}
            onViewSettle={(center, zoom) =>
              setViewInfo({ x: center.x, y: center.y, zoom })
            }
          />
        ) : layoutRef.current ? (
          <CellMapSvg
            state={layoutRef.current}
            edges={graphRef.current.edges}
            showEdges={params.showEdges}
            innerCells={innerCells}
            labels={labels}
            changedFiles={changedFilesRef.current}
            width={WIDTH}
            height={HEIGHT}
            selectedId={activeId}
            selectedIds={selectedIdSet}
            onSelect={selectNode}
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
              background: "rgba(248, 250, 252, 0.92)",
              border: "1px solid #cbd5e1",
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
        {/* debug stats float over the map, folded by default */}
        <Section
          title="ステータス"
          defaultOpen={false}
          style={{
            position: "absolute",
            right: "8px",
            bottom: "8px",
            width: "248px",
            background: "rgba(248, 250, 252, 0.92)",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div>
              max relative error: {(maxError * 100).toFixed(2)}%
              {maxError < CONVERGENCE_TOLERANCE ? " (converged)" : ""}
            </div>
            <div>fps: {fpsRef.current.ema.toFixed(0)}</div>
            <div>
              cells: {allCells.length}
              {ringsRef.current
                ? ` / modules: ${ringsRef.current.circles.size}`
                : ""}
            </div>
            {focusView ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span style={{ color: "#0369a1" }}>
                  focus: {labelOf(focusId!)}
                  {focusRoots.length > 1
                    ? ` +${focusRoots.length - 1}`
                    : ""}{" "}
                  ({focusView.level})
                </span>
                <button
                  onClick={() => setFocusId(null)}
                  style={{
                    padding: "2px 6px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  解除
                </button>
              </div>
            ) : null}
            <Sparkline values={historyRef.current} />
          </div>
        </Section>
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
              background: "rgba(248, 250, 252, 0.92)",
              border: "1px solid #cbd5e1",
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
            <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>
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
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                background: panelPos === pos ? "#1d4ed8" : "#f8fafc",
                color: panelPos === pos ? "#fff" : "#0f172a",
              }}
            >
              {pos}
            </button>
          ))}
        </div>
        <Section title="表示オプション">
          <Controls
            params={params}
            availableLayers={[
              ...new Set(
                graphRef.current.nodes.map((n) => defaultLayerOf(n.id)),
              ),
            ].sort()}
            onChange={setParams}
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
        {selected || selectedIsModule || selectedTest || selectedPort ? (
          <Section title="選択ノード">
            <div style={{ fontWeight: "600", wordBreak: "break-all" }}>
              {labelOf(activeId!)}
              {selectedPort
                ? " (port)"
                : selectedIsSymbol
                  ? " (symbol)"
                  : selectedIsModule
                    ? " (module)"
                    : selectedTest
                      ? " (test)"
                      : ""}
            </div>
            {params.granularity !== "symbol" ? (
              <div style={{ color: "#64748b", wordBreak: "break-all" }}>
                {activeId}
              </div>
            ) : null}
            {selectedIds.length > 1 ? (
              <div style={{ marginTop: "4px" }}>
                <div style={{ color: "#64748b" }}>
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
                        <span style={{ color: "#64748b" }}>
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
                    {params.granularity !== "symbol" && fileOf(id) ? (
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
                    {params.granularity !== "symbol" && fileOf(id) ? (
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
