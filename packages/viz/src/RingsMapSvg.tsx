import { useMemo, useRef, useState } from "preact/hooks";
import type { AtlasEdge, SymbolKind } from "@sprawlens/schema";
import { isStaticKind, SymbolTag, symbolGlyphOf } from "./symbolIcons.tsx";
import type { CellResult } from "@sprawlens/layout";
import type { Vec2 } from "@sprawlens/layout";
import {
  apply,
  layerTransform,
  toMatrixString,
  uprightAt,
  type Affine,
} from "@sprawlens/layout";
import type { RingsState } from "./ringsController.ts";
import type { TiltParams } from "./Controls.tsx";

import { CfgLayer, cfgAnchorsOf, type CfgEntry } from "./CfgLayer.tsx";
import {
  ACTIVE_EDGE,
  CIRCLE_CYCLE_FILL,
  CIRCLE_FILL,
  CIRCLE_STROKE,
  DIM,
  DOWNSTREAM_COLOR,
  DOWNSTREAM_FILL,
  ExitPreviewsLayer,
  EXPORTED_DOT,
  EXPORTED_LABEL,
  FILE_LABEL_INK,
  focusDimOf,
  INTERNAL_LABEL,
  LEAF_STROKE,
  LEAF_BORDER_MIN_PX,
  MACRO_EDGE,
  MODULE_LABEL_INK,
  PORT_FILL,
  SYMBOL_DOMINANT_FRACTION,
  SYMBOL_KIND_COLORS,
  SYMBOL_EDGE,
  SYMBOL_STROKE,
  SYMBOL_ZOOM,
  TEST_LABEL_INK,
  InnerLevelsLayer,
  isWatermarkSized,
  leafFillOf,
  makeEdgeBundler,
  makeTopAncestorOf,
  RaisedEdgePath,
  selectionDirections,
  DEPS_INK,
  PlaneLayerView,
  propagateLinkTints,
  SELECT_STROKE,
  LINKED_STROKE,
  UPSTREAM_COLOR,
  UPSTREAM_FILL,
  WatermarkLabelsLayer,
} from "./mapShared.tsx";
import type { SolvedLayer } from "./layerModel.ts";
import { symbolNameOf } from "./cfgClient.ts";
import {
  EDGE_PICK_DOMINANCE,
  EDGE_PICK_NODE_PX,
  EDGE_PICK_PX,
  pickNearestEdge,
  type EdgePickCandidate,
} from "./edgePick.ts";
import { segmentInView } from "./viewCulling.ts";
import {
  useMapViewport,
  type FocusRequest,
  type FocusView,
} from "./useMapViewport.ts";

export type { FocusRequest, FocusView } from "./useMapViewport.ts";


type Props = {
  rings: RingsState;
  innerCells: CellResult[];
  fileEdges: AtlasEdge[];
  /** Symbol references; endpoints may be symbol ids or file ids. */
  symbolEdges: AtlasEdge[];
  /** LSP call-hierarchy overlay for the selection — drawn dashed. */
  lspEdges?: AtlasEdge[];
  showEdges: boolean;
  labels: Map<string, string>;
  exportedIds: Set<string>;
  focus: FocusView | null;
  /** File ids on the test layer; rendered with a muted fill. */
  testFileIds: Set<string>;
  /** Solved satellite planes (tests, deps, ...) stacked below the source. */
  layers?: SolvedLayer[];
  /** Alt held → show every cross-layer edge; otherwise hover-gated. */
  altEdges?: boolean;
  /** Layer ids switched off; "source" hides the file/symbol map itself. */
  hiddenLayers: Set<string>;
  /** Symbol id → parent file id (precomputed; string parsing here was hot). */
  parentFileOf: (id: string) => string;
  /** Diff kind for a leaf (file or symbol); symbols inherit / refine the file
   * change so the diff shows at symbol granularity too. */
  changedOf: (id: string) => "added" | "modified" | undefined;
  /** API view: adapter ports sitting on the module rim. */
  portNodes: { id: string; label: string; x: number; y: number }[];
  /** Module granularity hides the file subdivision entirely. */
  showFiles?: boolean;
  /** Stratum visibility by level kind ("module", "directory", "symbol",
   * ...): the partition still uses hidden levels, they just don't draw. */
  visibleLevels?: ReadonlySet<string>;
  /** Dynamic CFG diagrams hosted by symbol cells (zoom-gated). */
  cfgEntries?: CfgEntry[];
  /** Symbol network: module labels show only the leaf directory until the
   * circle dominates the view, then expand to the full path, one segment
   * per line. */
  compactModuleLabels?: boolean;
  /** Nodes inside dependency cycles: their cells get a red-tinted fill. */
  cyclicIds?: Set<string>;
  /** Modules inside module-level cycles: red-tinted circles. */
  cyclicModuleIds?: Set<string>;
  width: number;
  height: number;
  /** Stacked-plane tilt; when enabled the content group carries its affine. */
  tilt?: TiltParams;
  /** Alt+drag tilt deltas (screen px) bubbled up from the viewport. */
  onTiltDrag?: (dxPx: number, dyPx: number) => void;
  selectedId: string | null;
  /** Symbol declaration kind per id, for the zoomed-in classification icons. */
  symbolKindOf?: (id: string) => SymbolKind | undefined;
  /** Full multi-selection (shift+click); selectedId is its primary. */
  selectedIds?: Set<string>;
  /** Picked dependency edges (proximity click); raised above the map. */
  selectedEdges?: { source: string; target: string }[];
  onSelect: (id: string | null, additive?: boolean) => void;
  /** Pick the dependency edge nearest a background click; shift adds it to
   * the multi-selection. */
  onSelectEdge?: (source: string, target: string, additive?: boolean) => void;
  /** Fly the camera to an element (off-screen dependency name click). */
  onFocusId?: (id: string) => void;
  focusRequest: FocusRequest | null;
  /** Fired when a view settles (LOD commit); world center + zoom. */
  onViewSettle?: (center: Vec2, zoom: number) => void;
};

/** Short fallback label: symbol ids reduce to the bare symbol name —
 * never the directory path, which is unreadable at map scale. */
function fallbackLabel(id: string): string {
  const symbolName = symbolNameOf(id);
  if (symbolName) return symbolName;
  const hash = id.indexOf("#");
  if (hash >= 0) return id.slice(hash + 1);
  return id.split("/").pop() ?? id;
}

/** Cells smaller than this on screen render as nothing — the module
 * circle's fill carries the texture; zooming in reveals them. */
const MIN_CELL_PX = 2.5;
/** Edges shorter than this on screen are sub-pixel noise. */
const MIN_EDGE_PX = 6;
/** Symbol cells smaller than this on screen don't get a classification icon
 * (no room); icons only appear in the symbol layer (zoom >= SYMBOL_ZOOM). */
const SYMBOL_ICON_MIN_PX = 26;
/** Class members (method/property) only tag once their cell is this big — far
 * past plain symbols — so the overview shows classes, not their innards. */
const MEMBER_TAG_MIN_PX = 55;
/** Macro module-edge decorations, all in screen pixels. */
const MACRO_ARROW_PX = 8;
const MACRO_LABEL_PX = 10.5;
/** Reference labels are a semantic-zoom detail: the macro overview shows
 * direction (arrows) and bundle thickness only, and names appear once the
 * user zooms past this scale into a region. */
const MACRO_LABEL_MIN_ZOOM = 1.5;
/** Even when zoomed in, suppress names on edges too short on screen to host
 * them, so a dense cluster doesn't pile labels. */
const MACRO_LABEL_MIN_PX = 100;
/** Reference names listed before collapsing the rest into "+N more". */
const MACRO_REF_MAX = 4;

export function RingsMapSvg(props: Props) {
  const {
    rings,
    innerCells,
    fileEdges,
    symbolEdges,
    showEdges,
    labels,
    exportedIds,
    focus,
    testFileIds,
    hiddenLayers,
    parentFileOf,
    changedOf,
    portNodes,
    width,
    height,
    tilt,
    onTiltDrag,
    selectedId,
    onSelect,
    focusRequest,
    onViewSettle,
  } = props;
  const showFiles = props.showFiles ?? true;
  const levelVisible = (kind: string): boolean =>
    props.visibleLevels?.has(kind) ?? true;
  const compactModuleLabels = props.compactModuleLabels ?? false;
  const multiSelected = props.selectedIds ?? new Set<string>();
  const lspEdges = props.lspEdges ?? [];
  const isSelected = (id: string | null): boolean =>
    id !== null && (id === selectedId || multiSelected.has(id));
  const cyclicIds = props.cyclicIds ?? new Set<string>();
  const cyclicModuleIds = props.cyclicModuleIds ?? new Set<string>();
  const onSelectEdge = props.onSelectEdge;
  const selectedEdges = props.selectedEdges ?? [];
  const isSelectedEdge = (s: string, t: string) =>
    selectedEdges.some((e) => e.source === s && e.target === t);
  // assigned below once geometry is in scope; the hook calls them in the
  // click capture / hover phases so edges win over the shapes beneath them
  const pickEdgeRef = useRef<(x: number, y: number, shift: boolean) => boolean>(
    () => false,
  );
  const hoverEdgeRef = useRef<(x: number, y: number) => void>(() => {});
  const { svgProps, committedView, zoom, contentRef, clientToWorld, toViewScale } =
    useMapViewport({
      width,
      height,
      focusRequest,
      onViewSettle,
      onPickEdge: (x, y, shift) => pickEdgeRef.current(x, y, shift),
      onHover: (x, y) => hoverEdgeRef.current(x, y),
      onTilt: onTiltDrag,
    });
  // affine that lays the plane flat (pitch squash) and spins it (rotate); the
  // content group carries it so all geometry and edges inherit one transform.
  // labels read `tiltAffine` to stay upright on top.
  const tiltActive =
    !!tilt?.enabled &&
    (tilt.theta !== 0 || tilt.pitch !== 0 || tilt.tests || tilt.deps);
  const tiltOpts = tilt
    ? {
        theta: tilt.theta,
        squash: Math.cos(tilt.pitch),
        center: { x: width / 2, y: height / 2 },
      }
    : null;
  const tiltAffine: Affine | undefined =
    tiltActive && tiltOpts
      ? layerTransform({ ...tiltOpts, gap: 0, index: 0 })
      : undefined;
  const tiltMatrix = tiltAffine ? toMatrixString(tiltAffine) : undefined;
  // every satellite plane is the same tilt dropped `planeIndex` gaps down
  const layers = props.layers ?? [];
  const satellitesOn = !!tilt?.enabled && layers.length > 0 && !!tiltOpts;
  const planeFor = (index: number): Affine | undefined =>
    tilt && tiltOpts
      ? layerTransform({ ...tiltOpts, gap: tilt.gap * height, index })
      : undefined;
  // representative upper-plane point per source file = centroid of its leaf
  // cells; satellite cross-layer links drop to / rise from these
  const sourceSiteOf = useMemo(() => {
    // a cross-layer link points at a file, but at symbol granularity a file is
    // many cells; anchoring on the file's *largest* cell keeps the edge landing
    // on a real (and tinted) cell instead of the centroid gap between symbols
    const best = new Map<string, { site: Vec2; area: number }>();
    if (satellitesOn) {
      for (const layout of rings.leafLayouts.values())
        for (const c of layout.cells) {
          const f = parentFileOf(c.id);
          const e = best.get(f);
          if (!e || c.actualArea > e.area)
            best.set(f, { site: c.site, area: c.actualArea });
        }
    }
    const m = new Map<string, Vec2>();
    for (const [f, e] of best) m.set(f, e.site);
    return m;
  }, [rings, parentFileOf, satellitesOn]);
  // every node's screen point across all planes: source files on the tilted
  // source plane, each satellite node on its own plane. Cross-layer edges
  // resolve their endpoints through this, so a dep edge lands on the tests
  // plane (its test importers) rather than being dropped.
  const screenPos = useMemo(() => {
    const m = new Map<string, Vec2>();
    if (tiltAffine)
      for (const [f, site] of sourceSiteOf) m.set(f, apply(tiltAffine, site));
    for (const layer of layers) {
      const t = planeFor(layer.planeIndex);
      if (!t) continue;
      for (const n of layer.placed) m.set(n.id, apply(t, n.site));
    }
    return m;
  }, [sourceSiteOf, layers, tiltAffine, height]);
  // ids referenced as an endpoint of some cross-layer edge — highlighted
  const referencedIds = useMemo(() => {
    const s = new Set<string>();
    for (const layer of layers)
      for (const n of layer.placed) for (const sid of n.sourceIds) s.add(sid);
    return s;
  }, [layers]);
  // cross-plane hovered node id: hovering a source cell or a satellite node
  // lights only its cross-layer edges (alt overrides to show all)
  const [linkHover, setLinkHover] = useState<string | null>(null);
  // selection keeps its edges up persistently: each selected id plus its file
  // (edges target file ids, so a selected symbol still matches)
  const pinnedLinkIds = useMemo(() => {
    const s = new Set<string>();
    const add = (id: string) => {
      s.add(id);
      s.add(parentFileOf(id));
    };
    if (selectedId) add(selectedId);
    for (const id of multiSelected) add(id);
    return s;
  }, [selectedId, multiSelected, parentFileOf]);
  // source files whose cross-layer edges are currently shown → tint their cell
  // region in the connecting layer's edge colour, so the targets read at a
  // glance. Mirrors the edge gate (hover / selection / alt).
  const activeLinkTint = useMemo(
    () =>
      satellitesOn
        ? propagateLinkTints(layers, {
            hover: linkHover,
            pinned: pinnedLinkIds,
            all: !!props.altEdges,
            tintFor: (id) => (id === "deps" ? DEPS_INK : TEST_LABEL_INK),
          })
        : new Map<string, string>(),
    [layers, linkHover, pinnedLinkIds, props.altEdges, satellitesOn],
  );
  // while a link highlight is active the always-on "referenced" amber would
  // fight it, so it yields: amber only shows when nothing is being explored
  const hasActiveLinks = activeLinkTint.size > 0;
  const [hoveredEdge, setHoveredEdge] = useState<{
    source: string;
    target: string;
  } | null>(null);
  const hoveredEdgeRef = useRef<{ source: string; target: string } | null>(null);

  // rings keeps its identity once converged, innerCells once settled — these
  // memos stop per-commit Map/array rebuilds (a major GC-pressure source)
  const fileCells = useMemo(
    () =>
      showFiles ? [...rings.leafLayouts.values()].flatMap((l) => l.cells) : [],
    [rings, showFiles],
  );
  const fileSiteById = useMemo(
    () => new Map(fileCells.map((c) => [c.id, c.site])),
    [fileCells],
  );
  const symbolSiteById = useMemo(
    () => new Map(innerCells.map((c) => [c.id, c.site])),
    [innerCells],
  );
  const portSiteById = useMemo(
    () => new Map(portNodes.map((p) => [p.id, { x: p.x, y: p.y }])),
    [portNodes],
  );
  /** Symbols one edge away from the selection (either direction); only
   * these label on unfocused files — anything else is noise. */
  const linkedToSelection = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedId && multiSelected.size === 0) return ids;
    for (const edge of symbolEdges) {
      if (
        isSelected(edge.source) ||
        isSelected(parentFileOf(edge.source))
      ) {
        ids.add(edge.target);
      }
      if (
        isSelected(edge.target) ||
        isSelected(parentFileOf(edge.target))
      ) {
        ids.add(edge.source);
      }
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolEdges, selectedId, multiSelected, parentFileOf]);
  // displayed CFGs re-anchor reference edges: incoming at the entry
  // terminal, outgoing at the step block that makes the call
  const cfgAnchors = useMemo(
    () => cfgAnchorsOf(props.cfgEntries ?? []),
    [props.cfgEntries],
  );
  const resolveSite = (id: string): Vec2 | undefined => {
    const site =
      symbolSiteById.get(id) ?? fileSiteById.get(id) ?? portSiteById.get(id);
    if (site) return site;
    for (const level of rings.innerLevels) {
      const cell = level.cells.get(id);
      if (cell) return cell.site;
    }
    const circle = rings.circles.get(id);
    return circle ? { x: circle.cx, y: circle.cy } : undefined;
  };
  // HEB bundling, same as the treemap: control points run the parent
  // chain; raw symbols (below the layout leaves) hang off their file
  const bundleParentOf = useMemo(() => {
    const map = new Map(rings.parentOf);
    for (const cell of innerCells) {
      if (!map.has(cell.id)) map.set(cell.id, parentFileOf(cell.id));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rings.parentOf, innerCells, parentFileOf]);
  const positionOf = useMemo(() => {
    const map = new Map<string, Vec2>();
    for (const [id, circle] of rings.circles) {
      map.set(id, { x: circle.cx, y: circle.cy });
    }
    for (const level of rings.innerLevels) {
      for (const [id, cell] of level.cells) map.set(id, cell.site);
    }
    for (const cell of fileCells) map.set(cell.id, cell.site);
    for (const cell of innerCells) map.set(cell.id, cell.site);
    for (const port of portNodes) map.set(port.id, { x: port.x, y: port.y });
    return map;
  }, [rings, fileCells, innerCells, portNodes]);
  const bundleOf = useMemo(
    () =>
      makeEdgeBundler({
        parentOf: bundleParentOf,
        positionOf,
        span: Math.hypot(width, height),
        cfgAnchors,
      }),
    [bundleParentOf, positionOf, cfgAnchors, width, height],
  );
  const edgeEndpoints = (edge: AtlasEdge): [Vec2, Vec2] | null => {
    let a = resolveSite(edge.source);
    let b = resolveSite(edge.target);
    if (!a || !b) return null;
    const sourceCfg = cfgAnchors.get(edge.source);
    if (sourceCfg) {
      const name = symbolNameOf(edge.target);
      a = (name ? sourceCfg.calls.get(name) : undefined) ?? a;
    }
    const targetCfg = cfgAnchors.get(edge.target);
    if (targetCfg) b = targetCfg.entry;
    return [a, b];
  };
  const moduleList = useMemo(() => [...rings.circles.entries()], [rings]);
  const topAncestorOf = makeTopAncestorOf(rings.parentOf, (id) =>
    rings.circles.has(id),
  );

  const sourceVisible = !hiddenLayers.has("source");
  const showInner = sourceVisible && zoom > 0.8;
  const symbolMode = sourceVisible && zoom >= SYMBOL_ZOOM;
  // viewport culling, always on — visibility is decided by the committed
  // view rect, never by zoom alone (slack = own size keeps partially
  // visible cells alive)
  const inView = (p: Vec2, slack: number) =>
    p.x >= committedView.x - slack &&
    p.x <= committedView.x + committedView.w + slack &&
    p.y >= committedView.y - slack &&
    p.y <= committedView.y + committedView.h + slack;
  const cellVisible = (cell: CellResult) =>
    inView(cell.site, Math.sqrt(cell.actualArea) * 1.5);

  // proximity edge picking: a click (or hover) resolves to the nearest
  // *prominent* edge by distance, not paint order. Only the macro module
  // structure and the lit dependency edges (selection / focus / lsp, added in
  // resolveEdgeAt) are grabbable — the faint ambient mesh is context, and
  // grabbing it would steal clicks meant for the nodes beneath. Module edges
  // are trimmed to the visible rim-to-rim segment so they don't intrude on a
  // circle's interior.
  const pickCandidates = useMemo<EdgePickCandidate[]>(() => {
    const out: EdgePickCandidate[] = [];
    if (!focus) {
      for (const edge of rings.topEdges) {
        const a = rings.circles.get(edge.source);
        const b = rings.circles.get(edge.target);
        if (!a || !b) continue;
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const len = Math.hypot(dx, dy);
        if (len <= a.r + b.r) continue; // overlapping circles: no visible edge
        const ux = dx / len;
        const uy = dy / len;
        out.push({
          source: edge.source,
          target: edge.target,
          points: [
            { x: a.cx + ux * a.r, y: a.cy + uy * a.r },
            { x: b.cx - ux * b.r, y: b.cy - uy * b.r },
          ],
        });
      }
    }
    return out;
  }, [rings, focus]);

  // Dynamic nested-symbol LOD: instead of fixed zoom thresholds, budget the
  // on-screen element count. Visible file cells get their internals in
  // descending screen-area order until the symbol budget is spent, so the
  // biggest cells in view always show detail and dense overviews stay flat.
  const SYMBOL_BUDGET = 1500;
  // symbols below this on-screen size are unreadable and unclickable —
  // they are skipped entirely and don't consume the budget
  const MIN_SYMBOL_PX = 12;
  const allowedFiles = (() => {
    const allowed = new Set<string>();
    if (!showInner) return allowed;
    const symbolCountByFile = new Map<string, number>();
    for (const cell of innerCells) {
      if (Math.sqrt(cell.actualArea) * zoom < MIN_SYMBOL_PX) continue;
      const file = parentFileOf(cell.id);
      symbolCountByFile.set(file, (symbolCountByFile.get(file) ?? 0) + 1);
    }
    const candidates = fileCells
      .filter((c) => c.polygon.length >= 3 && cellVisible(c))
      .map((c) => ({ id: c.id, screenArea: c.actualArea * zoom * zoom }))
      .sort((a, b) => b.screenArea - a.screenArea);
    let used = 0;
    for (const candidate of candidates) {
      const count = symbolCountByFile.get(candidate.id) ?? 0;
      if (used + count > SYMBOL_BUDGET) break;
      used += count;
      allowed.add(candidate.id);
    }
    // the selection's files always show their internals
    if (selectedId !== null) allowed.add(parentFileOf(selectedId));
    for (const id of multiSelected) allowed.add(parentFileOf(id));
    return allowed;
  })();
  const innerVisible = (cell: CellResult) =>
    isSelected(cell.id) ||
    (Math.sqrt(cell.actualArea) * zoom >= MIN_SYMBOL_PX &&
      allowedFiles.has(parentFileOf(cell.id)) &&
      cellVisible(cell));

  // polygon point strings survive across re-renders as long as the cell
  // objects do (zoom/pan commits re-render unchanged geometry)
  const pointsCache = useRef(new WeakMap<CellResult, string>()).current;
  const pointsOf = (cell: CellResult): string => {
    let points = pointsCache.get(cell);
    if (!points) {
      points = cell.polygon.map((p) => `${p.x},${p.y}`).join(" ");
      pointsCache.set(cell, points);
    }
    return points;
  };
  // highlighted cells stay visible at any size (signal > texture)
  const mustRender = (id: string) =>
    isSelected(id) || changedOf(id) !== undefined || cyclicIds.has(id);
  // filter once; the render lists below share these instead of re-testing
  // visibility per layer (3x the cells each render adds up at 4k+ symbols)
  const visibleFileCells = fileCells.filter(
    (c) =>
      c.polygon.length >= 3 &&
      cellVisible(c) &&
      (Math.sqrt(c.actualArea) * zoom >= MIN_CELL_PX || mustRender(c.id)),
  );
  const visibleInnerCells = innerCells.filter(
    (c) => c.polygon.length >= 3 && innerVisible(c),
  );
  /** Files whose symbols are labeled right now: the file's own foreground
   * name yields instead of stacking on top of the symbol's name. */
  const labeledSymbolFiles = (() => {
    const files = new Set<string>();
    for (const cell of visibleInnerCells) {
      if (cell.id.endsWith("#rest")) continue;
      const dominant =
        Math.sqrt(cell.actualArea) * zoom >=
        Math.min(width, height) * SYMBOL_DOMINANT_FRACTION;
      if (
        dominant ||
        linkedToSelection.has(cell.id) ||
        isSelected(parentFileOf(cell.id)) ||
        cell.id === selectedId
      ) {
        files.add(parentFileOf(cell.id));
      }
    }
    return files;
  })();
  // reference edges touching the selection stay visible at any zoom,
  // colored by direction (outgoing = dependencies, incoming = dependents)
  /**
   * Off-screen reference previews: when an edge leaves the viewport, the
   * far node's name docks at the point where the line crosses the screen
   * edge — you can read (and click) what's at the other end without
   * panning. One preview per far node.
   */
  // an endpoint belongs to the selection directly or via its parent file
  // (raw symbol references carry symbol ids; a selected file owns them)
  const noSelection = selectedId === null && multiSelected.size === 0;
  const directions = selectionDirections({
    edges: noSelection ? [] : symbolEdges,
    isSelected: (id) => isSelected(id),
    parentFileOf,
  });
  const lspDirections = selectionDirections({
    edges: noSelection ? [] : lspEdges,
    isSelected: (id) => isSelected(id),
    parentFileOf,
  });
  const selectedOutgoing = directions.outgoing;
  const selectedIncoming = directions.incoming;
  const lspOutgoing = lspDirections.outgoing;
  const lspIncoming = lspDirections.incoming;

  // The lit dependency edges (selection / focus / lsp) are drawn dashed and
  // must be grabbable too — they are the lines you actually want to catch
  // around a selection. Few in number, so build them every render (no memo)
  // and rank them first so they win ties over the ambient mesh.
  const litEdges = focus
    ? [...focus.downstreamEdges, ...focus.upstreamEdges]
    : [...selectedOutgoing, ...selectedIncoming, ...lspOutgoing, ...lspIncoming];
  const resolveEdgeAt = (
    clientX: number,
    clientY: number,
  ): { source: string; target: string } | null => {
    const world = clientToWorld(clientX, clientY);
    if (!world) return null;
    // edges are paint-through, so elementFromPoint reports the node/background
    // beneath the cursor: over a node shape the radius tightens so the node
    // stays selectable; over empty canvas it stays wide.
    const el = document.elementFromPoint(clientX, clientY);
    const tag = el?.tagName?.toLowerCase();
    const px =
      tag === "circle" || tag === "polygon" ? EDGE_PICK_NODE_PX : EDGE_PICK_PX;
    const lit: EdgePickCandidate[] = [];
    for (const edge of litEdges) {
      const bundle = bundleOf(edge);
      if (bundle) {
        lit.push({
          source: edge.source,
          target: edge.target,
          points: bundle.points,
        });
      }
    }
    const hit = pickNearestEdge(
      world,
      [...lit, ...pickCandidates],
      px * toViewScale(),
      EDGE_PICK_DOMINANCE,
    );
    return hit ? { source: hit.source, target: hit.target } : null;
  };
  pickEdgeRef.current = (clientX, clientY, shift) => {
    if (!onSelectEdge) return false;
    const hit = resolveEdgeAt(clientX, clientY);
    if (!hit) return false;
    onSelectEdge(hit.source, hit.target, shift);
    return true;
  };
  // hover preview: surface the edge a click would pick (and a pointer cursor).
  // only flip state when the hovered edge changes, to avoid per-move churn
  hoverEdgeRef.current = (clientX, clientY) => {
    const next = onSelectEdge ? resolveEdgeAt(clientX, clientY) : null;
    const cur = hoveredEdgeRef.current;
    if (cur?.source !== next?.source || cur?.target !== next?.target) {
      hoveredEdgeRef.current = next;
      setHoveredEdge(next);
    }
  };
  // nodes one reference away from the selection, keyed by direction —
  // their backgrounds take the matching edge color
  const dependencyIds = new Set([
    ...directions.dependencyIds,
    ...lspDirections.dependencyIds,
  ]);
  const dependentIds = new Set([
    ...directions.dependentIds,
    ...lspDirections.dependentIds,
  ]);

  const dim = focusDimOf(focus);
  const moduleOpacity = dim.module;
  const fileOpacity = dim.leaf;
  const symbolOpacity = dim.symbol;

  /**
   * Screen-space label sizing: a label's natural size (world * zoom) must
   * reach `min` screen px to be shown, and is capped at `max` screen px so
   * deep zoom never produces wall-sized text. Returns world units.
   */
  // beyond symbol zoom, fixed screen-px caps make labels look tiny inside
  // huge cells; let the cap grow gently (sqrt, at most 2.5x)
  const labelGrowth = Math.min(2.5, Math.max(1, Math.sqrt(zoom / SYMBOL_ZOOM)));
  const screenFont = (
    worldBase: number,
    min: number,
    max: number,
    force = false,
    hideAbove = Infinity,
  ): number | null => {
    const screen = worldBase * zoom;
    // natural size beyond hideAbove means the viewport sits inside the cell;
    // its label is just noise there
    if ((screen < min || screen > hideAbove) && !force) return null;
    return Math.min(Math.max(screen, min), max * labelGrowth) / zoom;
  };
  /** Screen-constant radius in world units. */
  const screenRadius = (px: number) => px / zoom;

  return (
    <svg
      {...svgProps}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        touchAction: "none",
        // a pan drag must never text-select the labels it sweeps over
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: hoveredEdge ? "pointer" : "grab",
      }}
      onClick={() => onSelect(null)}
    >
      {/* vector-effect does not inherit from <g>; apply to every shape so
          stroke widths (including selection highlights) stay in screen px */}
      <style>
        {"polygon, line, circle, path { vector-effect: non-scaling-stroke; }"}
      </style>
      <g ref={contentRef} transform={tiltMatrix}>
      {/* aggregated module dependencies: the macro structure, always on.
          a→b reads "a imports b": the arrow points at the target, and the
          imported symbol names are listed under the edge (zoom-gated). */}
      {!focus ? (
        <g stroke={MACRO_EDGE} fill="none">
          {rings.topEdges.map((edge) => {
            const a = rings.circles.get(edge.source);
            const b = rings.circles.get(edge.target);
            if (!a || !b) return null;
            const dx = b.cx - a.cx;
            const dy = b.cy - a.cy;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            // arrowhead just outside the target circle, pointing inward
            const head = MACRO_ARROW_PX / zoom;
            const tip = b.r + 2 / zoom; // apex distance from b center, a-side
            const ax = b.cx - ux * tip;
            const ay = b.cy - uy * tip;
            const cx = b.cx - ux * (tip + head);
            const cy = b.cy - uy * (tip + head);
            const w = head * 0.5;
            const refs = edge.refs ?? [];
            // labels need room: gate on the edge's on-screen length
            const mx = (a.cx + b.cx) / 2;
            const my = (a.cy + b.cy) / 2;
            const labelled =
              refs.length > 0 &&
              zoom > MACRO_LABEL_MIN_ZOOM &&
              len * zoom > MACRO_LABEL_MIN_PX &&
              inView({ x: mx, y: my }, 0);
            const shown = refs.slice(0, MACRO_REF_MAX);
            const extra = refs.length - shown.length;
            const fs = MACRO_LABEL_PX / zoom;
            const lines = extra > 0 ? [...shown, `+${extra} more`] : shown;
            return (
              <g key={`${edge.source}->${edge.target}`}>
                <line
                  x1={a.cx}
                  y1={a.cy}
                  x2={b.cx}
                  y2={b.cy}
                  stroke-width={1 + Math.log2(1 + (edge.weight ?? 1))}
                  stroke-opacity={0.35}
                />
                {len > b.r + tip + head ? (
                  <polygon
                    points={`${ax},${ay} ${cx + -uy * w},${cy + ux * w} ${cx - -uy * w},${cy - ux * w}`}
                    fill={MACRO_EDGE}
                    stroke="none"
                    fill-opacity={0.55}
                  />
                ) : null}
                {labelled ? (
                  <text
                    transform={uprightAt(tiltAffine, { x: mx, y: my })}
                    font-size={fs}
                    text-anchor="middle"
                    fill={MODULE_LABEL_INK}
                    fill-opacity={0.85}
                    stroke="none"
                    style={{ pointerEvents: "none" }}
                  >
                    {lines.map((name) => (
                      <tspan key={name} x={0} dy={fs * 1.1}>
                        {name}
                      </tspan>
                    ))}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}
      <g
        style={{
          display: levelVisible(
            rings.kindOf.get(moduleList[0]?.[0] ?? "") ?? "module",
          )
            ? ""
            : "none",
        }}
      >
        {moduleList.map(([id, circle]) => (
          <circle
            key={id}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fill={
              dependencyIds.has(id)
                ? DOWNSTREAM_FILL
                : dependentIds.has(id)
                  ? UPSTREAM_FILL
                  : cyclicModuleIds.has(id)
                    ? CIRCLE_CYCLE_FILL
                    : CIRCLE_FILL
            }
            stroke={isSelected(id) ? SELECT_STROKE : CIRCLE_STROKE}
            stroke-width={isSelected(id) ? 2.4 : 1.2}
            opacity={moduleOpacity(id)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(id, event.shiftKey);
            }}
          />
        ))}
      </g>
      {/* intermediate boundary districts (shared with treemap) */}
      <InnerLevelsLayer
        levels={rings.innerLevels}
        topAncestorOf={topAncestorOf}
        isSelected={(id) => isSelected(id)}
        onSelect={onSelect}
        dim={dim}
        zoom={zoom}
        labels={labels}
        visibleLevels={props.visibleLevels}
        tilt={tiltAffine}
      />
      <g style={{ display: sourceVisible ? "" : "none" }}>
        {visibleFileCells.map((cell) => {
          // the fill texture always reads; the outline is zoom-gated so a
          // macro view shows colored regions, not a mesh of borders
          const border =
            isSelected(cell.id) ||
            Math.sqrt(cell.actualArea) * zoom >= LEAF_BORDER_MIN_PX;
          // referenced by a cross-layer edge (a test / dep points here): give
          // the source file a bright outline so the nodes in play surface.
          // referencedIds are file paths, so a symbol cell matches via its file.
          // hidden while a link highlight is active so it doesn't fight the tint.
          const linked =
            !isSelected(cell.id) &&
            !hasActiveLinks &&
            referencedIds.size > 0 &&
            (referencedIds.has(cell.id) ||
              referencedIds.has(parentFileOf(cell.id)));
          // dim cells the active highlight doesn't touch, so the tinted ones pop
          const dimmed =
            hasActiveLinks &&
            !isSelected(cell.id) &&
            !activeLinkTint.has(parentFileOf(cell.id));
          return (
            <polygon
              key={cell.id}
              points={pointsOf(cell)}
              fill={leafFillOf(cell.id, {
                changedOf,
                cyclicIds,
                testFileIds,
                dependencyIds,
                dependentIds,
                topAncestorOf,
              })}
              stroke={
                isSelected(cell.id)
                  ? SELECT_STROKE
                  : linked
                    ? LINKED_STROKE
                    : border
                      ? LEAF_STROKE
                      : "none"
              }
              stroke-width={isSelected(cell.id) ? 2 : linked ? 1.4 : 0.8}
              stroke-opacity={linked ? 0.95 : undefined}
              opacity={fileOpacity(cell.id) * (dimmed ? 0.35 : 1)}
              onMouseEnter={
                satellitesOn
                  ? () => setLinkHover(parentFileOf(cell.id))
                  : undefined
              }
              onMouseLeave={satellitesOn ? () => setLinkHover(null) : undefined}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id, event.shiftKey);
              }}
            />
          );
        })}
      </g>
      {activeLinkTint.size > 0 ? (
        <g style={{ pointerEvents: "none" }}>
          {visibleFileCells.map((cell) => {
            const tint = activeLinkTint.get(parentFileOf(cell.id));
            if (!tint) return null;
            return (
              <polygon
                key={`lt:${cell.id}`}
                points={pointsOf(cell)}
                fill={tint}
                fill-opacity={0.28}
                stroke={tint}
                stroke-opacity={0.55}
                stroke-width={1}
              />
            );
          })}
        </g>
      ) : null}
      {sourceVisible ? (
        <WatermarkLabelsLayer
          cells={visibleFileCells}
          zoom={zoom}
          labelOf={(id) => labels.get(id) ?? fallbackLabel(id)}
          dim={dim}
          view={committedView}
          tilt={tiltAffine}
        />
      ) : null}
      {showInner ? (
        <g
          stroke={SYMBOL_STROKE}
          stroke-width={0.4}
          stroke-opacity={0.8}
         
        >
          {visibleInnerCells.map((cell) =>
            true ? (
              <polygon
                key={cell.id}
                points={pointsOf(cell)}
                fill={
                  dependencyIds.has(cell.id)
                    ? DOWNSTREAM_FILL
                    : dependentIds.has(cell.id)
                      ? UPSTREAM_FILL
                      : "transparent"
                }
                stroke={isSelected(cell.id) ? SELECT_STROKE : undefined}
                stroke-width={isSelected(cell.id) ? 1.6 : undefined}
                opacity={symbolOpacity(cell.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(cell.id, event.shiftKey);
                }}
              />
            ) : null,
          )}
        </g>
      ) : null}
      <CfgLayer
        entries={props.cfgEntries ?? []}
        zoom={zoom}
        view={committedView}
      />
      {showEdges && sourceVisible && !focus && !symbolMode ? (
        <g fill="none">
          {fileEdges.map((edge) => {
            const active =
              isSelected(edge.source) ||
              isSelected(edge.target) ||
              isSelected(rings.parentOf.get(edge.source) ?? "") ||
              isSelected(rings.parentOf.get(edge.target) ?? "");
            // off-screen ambient edges are pure overdraw; the selection's
            // own edges stay regardless so they read at any pan
            if (!active) {
              const ends = edgeEndpoints(edge);
              if (
                !ends ||
                !segmentInView(ends[0], ends[1], committedView, committedView.w * 0.1)
              ) {
                return null;
              }
            }
            const bundle = bundleOf(edge);
            if (!bundle) return null;
            if (!active && bundle.chord * zoom < MIN_EDGE_PX) return null;
            return (
              <path
                key={`${edge.source}-${edge.target}`}
                d={bundle.d}
                stroke={active ? ACTIVE_EDGE : UPSTREAM_COLOR}
                stroke-opacity={active ? 0.9 : selectedId ? 0.08 : 0.22}
                stroke-width={active ? 1.8 : 1}
                style={{ pointerEvents: "none" }}
              />
            );
          })}
        </g>
      ) : null}
      {showEdges && !focus && symbolMode ? (
        <g stroke={SYMBOL_EDGE} stroke-opacity={0.45} fill="none">
          {symbolEdges.map((edge) => {
            const ends = edgeEndpoints(edge);
            if (!ends) return null;
            const slack = committedView.w * 0.1;
            if (!inView(ends[0], slack) && !inView(ends[1], slack)) {
              return null;
            }
            const bundle = bundleOf(edge);
            if (!bundle) return null;
            return (
              <path
                key={`${edge.source}-${edge.target}`}
                d={bundle.d}
                stroke-width={0.6}
                style={{ pointerEvents: "none" }}
              />
            );
          })}
        </g>
      ) : null}
      {focus
        ? (
            [
              [focus.downstreamEdges, DOWNSTREAM_COLOR],
              [focus.upstreamEdges, UPSTREAM_COLOR],
            ] as const
          ).map(([edges, color]) => (
            <g key={color} stroke={color} stroke-opacity={0.85} fill="none">
              {edges.map((edge) => {
                const bundle = bundleOf(edge);
                if (!bundle) return null;
                return (
                  <path
                    key={`focus-${edge.source}-${edge.target}`}
                    d={bundle.d}
                    stroke-width={
                      focus.level === "module"
                        ? 1.5 + Math.log2(1 + (edge.weight ?? 1))
                        : 1.2
                    }
                    style={{ pointerEvents: "none" }}
                  />
                );
              })}
            </g>
          ))
        : null}
      {(
        [
          [selectedOutgoing, DOWNSTREAM_COLOR],
          [selectedIncoming, UPSTREAM_COLOR],
        ] as const
      ).map(([edges, color]) =>
        edges.length > 0 ? (
          <g
            key={`sel-${color}`}
            stroke={color}
            stroke-opacity={0.9}
            stroke-dasharray={`${5 / zoom} ${4 / zoom}`}
            fill="none"
          >
            {edges.map((edge) => {
              const bundle = bundleOf(edge);
              if (!bundle) return null;
              return (
                <path
                  key={`sel-${edge.source}-${edge.target}`}
                  d={bundle.d}
                  stroke-width={1.6}
                  style={{ pointerEvents: "none" }}
                />
              );
            })}
          </g>
        ) : null,
      )}
      {(
        [
          [lspOutgoing, DOWNSTREAM_COLOR],
          [lspIncoming, UPSTREAM_COLOR],
        ] as const
      ).map(([edges, color]) =>
        edges.length > 0 ? (
          <g
            key={`lsp-${color}`}
            stroke={color}
            stroke-opacity={0.85}
            stroke-dasharray={`${8 / zoom} ${5 / zoom}`}
            fill="none"
          >
            {edges.map((edge) => {
              const bundle = bundleOf(edge);
              if (!bundle) return null;
              return (
                <path
                  key={`lsp-${edge.source}-${edge.target}`}
                  d={bundle.d}
                  stroke-width={1.4}
                  style={{ pointerEvents: "none" }}
                />
              );
            })}
          </g>
        ) : null,
      )}
      {/* hover preview: a faint accent over the edge a click would pick */}
      {hoveredEdge && !isSelectedEdge(hoveredEdge.source, hoveredEdge.target)
        ? (() => {
            const a = rings.circles.get(hoveredEdge.source);
            const b = rings.circles.get(hoveredEdge.target);
            if (a && b) {
              const dx = b.cx - a.cx;
              const dy = b.cy - a.cy;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const x1 = a.cx + ux * a.r;
              const y1 = a.cy + uy * a.r;
              const x2 = b.cx - ux * b.r;
              const y2 = b.cy - uy * b.r;
              // a wide translucent halo signals the fat grab zone, a crisp
              // core says exactly which edge a click would take
              return (
                <g style={{ pointerEvents: "none" }}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={SELECT_STROKE}
                    stroke-width={8}
                    stroke-opacity={0.2}
                    stroke-linecap="round"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={SELECT_STROKE}
                    stroke-width={2.5}
                    stroke-opacity={0.85}
                  />
                </g>
              );
            }
            const bundle = bundleOf(hoveredEdge);
            return bundle ? (
              <g style={{ pointerEvents: "none" }}>
                <RaisedEdgePath d={bundle.d} width={8} opacity={0.2} />
                <RaisedEdgePath d={bundle.d} width={2} opacity={0.85} />
              </g>
            ) : null;
          })()
        : null}
      {/* picked edge, raised above unrelated modules: bold, arrowed, with its
          referenced symbols always shown (pointer-through so the endpoints
          underneath stay clickable) */}
      {selectedEdges.map((selectedEdge) => {
        const key = `${selectedEdge.source}->${selectedEdge.target}`;
        return (() => {
            const a = rings.circles.get(selectedEdge.source);
            const b = rings.circles.get(selectedEdge.target);
            if (a && b) {
              const dx = b.cx - a.cx;
              const dy = b.cy - a.cy;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const head = (MACRO_ARROW_PX + 2) / zoom;
              const tipDist = b.r + 2 / zoom;
              const ax = b.cx - ux * tipDist;
              const ay = b.cy - uy * tipDist;
              const hx = b.cx - ux * (tipDist + head);
              const hy = b.cy - uy * (tipDist + head);
              const w = head * 0.5;
              const top = rings.topEdges.find(
                (e) =>
                  e.source === selectedEdge.source &&
                  e.target === selectedEdge.target,
              );
              const refs = top?.refs ?? [];
              const shown = refs.slice(0, MACRO_REF_MAX);
              const extra = refs.length - shown.length;
              const fs = MACRO_LABEL_PX / zoom;
              const lines = extra > 0 ? [...shown, `+${extra} more`] : shown;
              return (
                <g key={key} style={{ pointerEvents: "none" }}>
                  <line
                    x1={a.cx}
                    y1={a.cy}
                    x2={b.cx}
                    y2={b.cy}
                    stroke={SELECT_STROKE}
                    stroke-width={1.5 + Math.log2(1 + (top?.weight ?? 1))}
                    stroke-opacity={0.95}
                  />
                  <polygon
                    points={`${ax},${ay} ${hx + -uy * w},${hy + ux * w} ${hx - -uy * w},${hy - ux * w}`}
                    fill={SELECT_STROKE}
                  />
                  {[a, b].map((c, i) => (
                    <circle
                      key={i}
                      cx={c.cx}
                      cy={c.cy}
                      r={c.r}
                      fill="none"
                      stroke={SELECT_STROKE}
                      stroke-width={2.4}
                    />
                  ))}
                  {lines.length > 0 ? (
                    <text
                      transform={uprightAt(tiltAffine, {
                        x: (a.cx + b.cx) / 2,
                        y: (a.cy + b.cy) / 2,
                      })}
                      font-size={fs}
                      text-anchor="middle"
                      fill={SELECT_STROKE}
                    >
                      {lines.map((name) => (
                        <tspan key={name} x={0} dy={fs * 1.1}>
                          {name}
                        </tspan>
                      ))}
                    </text>
                  ) : null}
                </g>
              );
            }
            const bundle = bundleOf({
              source: selectedEdge.source,
              target: selectedEdge.target,
            });
            if (!bundle) return null;
            return <RaisedEdgePath key={key} d={bundle.d} />;
          })();
      })}
      {/* names of reference targets that left the screen, docked where
          their edge crosses the viewport border */}
      {(focus
        ? ([
            [focus.downstreamEdges, DOWNSTREAM_COLOR, "exit-focus-down"],
            [focus.upstreamEdges, UPSTREAM_COLOR, "exit-focus-up"],
          ] as const)
        : ([
            [
              [...selectedOutgoing, ...lspOutgoing],
              DOWNSTREAM_COLOR,
              "exit-sel-down",
            ],
            [
              [...selectedIncoming, ...lspIncoming],
              UPSTREAM_COLOR,
              "exit-sel-up",
            ],
          ] as const)
      ).map(([edges, color, key]) => (
        <ExitPreviewsLayer
          key={key}
          edges={edges}
          color={color}
          view={committedView}
          endpointsOf={edgeEndpoints}
          labelOf={(id) => labels.get(id) ?? fallbackLabel(id)}
          onSelect={onSelect}
          onFocus={props.onFocusId}
          zoom={zoom}
          tilt={tiltAffine}
        />
      ))}
      {/* symbol sites are conceptual edge waypoints only — no dots */}
      {/* adapter ports on the module rim (API view) */}
      {portNodes.length > 0 ? (
        <g>
          {portNodes.map((port) => {
            if (!inView({ x: port.x, y: port.y }, 20)) return null;
            const opacity = focus
              ? focus.fileIds.has(port.id) || focus.symbolIds.has(port.id)
                ? 1
                : DIM
              : 1;
            return (
              <g key={port.id} opacity={opacity}>
                <circle
                  cx={port.x}
                  cy={port.y}
                  r={screenRadius(isSelected(port.id) ? 5 : 3.6)}
                  fill={PORT_FILL}
                  stroke={isSelected(port.id) ? SELECT_STROKE : EXPORTED_DOT}
                  stroke-width={isSelected(port.id) ? 2.4 : 1.8}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(port.id, event.shiftKey);
                  }}
                />
                <text
                  transform={uprightAt(tiltAffine, {
                    x: port.x,
                    y: port.y - screenRadius(7),
                  })}
                  font-size={11 / zoom}
                  text-anchor="middle"
                  font-weight="600"
                  fill={EXPORTED_LABEL}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {port.label}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}
      <g
        text-anchor="middle"
        style={{
          pointerEvents: "none",
          userSelect: "none",
          display: levelVisible(
            rings.kindOf.get(moduleList[0]?.[0] ?? "") ?? "module",
          )
            ? ""
            : "none",
        }}
      >
        {moduleList.map(([id, circle]) => {
          // modules are the macro anchors: always labeled, 10–18px on screen
          const fontSize = screenFont(circle.r * 0.18, 10, 18, true);
          if (fontSize === null) return null;
          const segments = id.split("/");
          const expanded =
            compactModuleLabels &&
            segments.length > 1 &&
            circle.r * zoom >= Math.min(width, height) * 0.3;
          if (expanded) {
            // zoomed in: full path, one segment per line
            const lineHeight = fontSize * 1.1;
            return (
              <text
                key={id}
                transform={uprightAt(tiltAffine, {
                  x: circle.cx,
                  y:
                    circle.cy -
                    circle.r -
                    fontSize * 0.4 -
                    (segments.length - 1) * lineHeight,
                })}
                font-size={fontSize}
                font-weight="600"
                fill={MODULE_LABEL_INK}
                opacity={moduleOpacity(id)}
              >
                {segments.map((segment, i) => (
                  <tspan key={segment} x={0} dy={i === 0 ? 0 : lineHeight}>
                    {i < segments.length - 1 ? `${segment}/` : segment}
                  </tspan>
                ))}
              </text>
            );
          }
          return (
            <text
              key={id}
              transform={uprightAt(tiltAffine, {
                x: circle.cx,
                y: circle.cy - circle.r - fontSize * 0.4,
              })}
              font-size={fontSize}
              font-weight="600"
              fill={MODULE_LABEL_INK}
              opacity={moduleOpacity(id)}
            >
              {compactModuleLabels
                ? segments[segments.length - 1]
                : id}
            </text>
          );
        })}
        {showInner
          ? visibleFileCells.map((cell) => {
              // past the watermark size the background copy takes over
              if (isWatermarkSized(cell, zoom)) return null;
              // a labeled symbol owns the spot — no stacked file name
              if (labeledSymbolFiles.has(cell.id)) return null;
              const fontSize = screenFont(
                Math.sqrt(cell.actualArea) * 0.18,
                9,
                15,
                cell.id === selectedId,
                Infinity, // the watermark gate above already capped it
              );
              if (fontSize === null) return null;
              return (
                <text
                  key={cell.id}
                  transform={uprightAt(tiltAffine, {
                    x: cell.site.x,
                    y: cell.site.y + fontSize * 0.35,
                  })}
                  font-size={fontSize}
                  fill={
                    testFileIds.has(cell.id) ? TEST_LABEL_INK : FILE_LABEL_INK
                  }
                  opacity={fileOpacity(cell.id)}
                >
                  {labels.get(cell.id) ?? fallbackLabel(cell.id)}
                </text>
              );
            })
          : null}
        {showInner
          ? visibleInnerCells.map((cell) => {
              // module-scope filler cells stay unlabeled to reduce noise
              if (cell.id.endsWith("#rest") && cell.id !== selectedId)
                return null;
              const exported = exportedIds.has(cell.id);
              // symbol names are noise until you commit to the symbol:
              // show them only when (a) the cell dominates the screen,
              // (b) its file is selected, (c) it's the selection itself,
              // (d) the selection references it directly
              const linked = linkedToSelection.has(cell.id);
              const fileSelected = isSelected(parentFileOf(cell.id));
              const dominant =
                Math.sqrt(cell.actualArea) * zoom >=
                Math.min(width, height) * SYMBOL_DOMINANT_FRACTION;
              const name = labels.get(cell.id) ?? fallbackLabel(cell.id);
              const kind = props.symbolKindOf?.(cell.id);
              const glyph = symbolGlyphOf(kind, name);
              // class members are detail: keep them hidden until a deep zoom
              // makes their cell large, so the overview shows classes/functions
              const isMember = glyph === "method" || glyph === "property";
              const onScreen = Math.sqrt(cell.actualArea) * zoom;
              const roomy =
                symbolMode &&
                onScreen >= (isMember ? MEMBER_TAG_MIN_PX : SYMBOL_ICON_MIN_PX);
              // members never ride the dominant/linked shortcut — only room
              const passes = isMember
                ? roomy || cell.id === selectedId
                : linked || fileSelected || dominant || roomy || cell.id === selectedId;
              if (!passes) return null;
              const fontSize = screenFont(
                Math.sqrt(cell.actualArea) * 0.3,
                exported ? 7 : 13,
                12,
                isSelected(cell.id) || fileSelected || dominant || linked,
                200,
              );
              if (fontSize === null) return null;
              return (
                <SymbolTag
                  key={cell.id}
                  cx={cell.site.x}
                  cy={cell.site.y - screenRadius(4)}
                  name={name}
                  glyph={glyph}
                  static={isStaticKind(kind)}
                  fontSize={fontSize}
                  color={
                    glyph
                      ? SYMBOL_KIND_COLORS[glyph]!
                      : exported
                        ? EXPORTED_LABEL
                        : INTERNAL_LABEL
                  }
                  opacity={symbolOpacity(cell.id)}
                  tilt={tiltAffine}
                />
              );
            })
          : null}
      </g>
      </g>
      {tiltAffine
        ? layers.map((layer, i) => {
            const tilt1 = planeFor(layer.planeIndex);
            if (!tilt1) return null;
            return (
              <PlaneLayerView
                key={layer.id}
                tilt0={tiltAffine}
                tilt1={tilt1}
                extent={layer.extent}
                screenPosOf={(id) => screenPos.get(id)}
                referencedIds={referencedIds}
                placed={layer.placed}
                districts={layer.districts}
                color={layer.id === "deps" ? DEPS_INK : TEST_LABEL_INK}
                withSourceFrame={i === 0}
                zoom={zoom}
                onSelect={onSelect}
                onLinkSelect={(id, additive) => {
                  onSelect(id, additive);
                  props.onFocusId?.(id);
                }}
                selectedId={selectedId}
                altEdges={props.altEdges}
                hoverId={linkHover}
                onHover={setLinkHover}
                pinnedIds={pinnedLinkIds}
                tintOf={(id) => activeLinkTint.get(id)}
                linksActive={hasActiveLinks}
              />
            );
          })
        : null}
    </svg>
  );
}
