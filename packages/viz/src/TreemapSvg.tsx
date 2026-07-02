import { useMemo, useRef, useState } from "preact/hooks";
import type { AtlasEdge, SymbolKind, TestStatus } from "@sprawlens/schema";
import { isStaticKind, SymbolTag, symbolGlyphOf } from "./symbolIcons.tsx";
import type { CellResult } from "@sprawlens/layout";
import type { Vec2 } from "@sprawlens/layout";
import {
  apply,
  containsPoint,
  layerTransform,
  toMatrixString,
  uprightAt,
  type Affine,
} from "@sprawlens/layout";
import { anyPlaneShown, type TiltParams } from "./Controls.tsx";
import { CfgLayer, cfgAnchorsOf, type CfgEntry } from "./CfgLayer.tsx";
import { makeEdgeEndpointResolver } from "./edgeEndpoints.ts";
import {
  ACTIVE_EDGE,
  BUNDLE_STRENGTH,
  districtFill,
  districtLabelFill,
  districtStroke,
  DOWNSTREAM_COLOR,
  ExitPreviewsLayer,
  EXPORTED_LABEL,
  FILE_LABEL_INK,
  INTERNAL_LABEL,
  LEAF_STROKE,
  LEAF_BORDER_MIN_PX,
  makeEdgeBundler,
  REFERENCE_BUNDLE_STRENGTH,
  SYMBOL_DOMINANT_FRACTION,
  SYMBOL_KIND_COLORS,
  SYMBOL_STROKE,
  SYMBOL_ZOOM,
  selectionDirections,
  focusDimOf,
  focusNodeOutlineVisual,
  InnerLevelsLayer,
  isWatermarkSized,
  leafFillOf,
  makeTopAncestorOf,
  DEPS_INK,
  BundledEdges,
  PlaneLayerView,
  propagateLinkTints,
  RaisedEdgePath,
  SELECT_STROKE,
  SELECT_HALO_STROKE,
  LINKED_STROKE,
  TEST_LABEL_INK,
  TEST_STATUS_FILL,
  UPSTREAM_COLOR,
  WatermarkLabelsLayer,
} from "./mapShared.tsx";
import type { SolvedLayer } from "./layerModel.ts";
import { symbolNameOf } from "./cfgClient.ts";
import type { EdgePickCandidate } from "./edgePick.ts";
import { resolveEdgeAtClient } from "./edgePickDom.ts";
import { ambientEdgeVisual, REFERENCE_EDGE_BASE } from "./edgeStyle.ts";
import { cellInView, segmentInView } from "./viewCulling.ts";
import type { TreemapState } from "./treemapController.ts";
import { useMapViewport, type FocusRequest, type FocusView } from "./useMapViewport.ts";
import {
  diffForegroundStrokeWidth,
  diffOutlineOpacity,
  diffStrokeWidth,
  formatDiffPercent,
  type NodeDiffStat,
} from "./diffStats.ts";

type Props = {
  state: TreemapState;
  fileEdges: AtlasEdge[];
  showEdges: boolean;
  /** Hierarchy-path bundling strength: 1 = fully bundled, 0 = straight. */
  bundleStrength?: number;
  labels?: Map<string, string>;
  /** Diff kind for a leaf (file or symbol); symbols inherit / refine the file
   * change so the diff shows at symbol granularity too. */
  changedOf?: (id: string) => "added" | "modified" | undefined;
  /** Diff density for a leaf, used as outline weight and optional label text. */
  diffStatOf?: (id: string) => NodeDiffStat | undefined;
  cyclicIds?: Set<string>;
  /** File ids on the test layer; rendered with the shared muted fill. */
  testFileIds?: Set<string>;
  /** Solved satellite planes (tests, deps, ...) stacked below the source. */
  layers?: SolvedLayer[];
  /** Alt held → show every cross-layer edge; otherwise hover-gated. */
  altEdges?: boolean;
  /** Runtime-trace overlay: executed call path (symbol→symbol), drawn solid. */
  traceEdges?: AtlasEdge[];
  /** Per-symbol execution heat in [0,1] for tinting hot cells. */
  traceHeat?: Map<string, number>;
  /** Test reporter: test-case id → status (tints the test plane) and → ms. */
  testStatus?: Map<string, TestStatus>;
  testDuration?: Map<string, number>;
  /** Nested symbol layouts inside the file cells (file granularity). */
  innerCells?: CellResult[];
  exportedIds?: Set<string>;
  /** Symbol declaration kind per id, for the zoomed-in classification icons. */
  symbolKindOf?: (id: string) => SymbolKind | undefined;
  /** Symbol id → parent file id, for label gating. */
  parentFileOf?: (id: string) => string;
  /** Dependency-path extraction: members stay lit, everything else dims. */
  focus?: FocusView | null;
  /** Stratum visibility by level kind: the partition still uses hidden
   * levels (placement, confinement), they just don't draw. */
  visibleLevels?: ReadonlySet<string>;
  /** Kind of the leaf cells ("file" or "symbol"). */
  leafKind?: string;
  /** Minimum on-screen px a label needs to be drawn (slider-tunable). */
  labelMinPx?: number;
  /** Label font-size multiplier (slider-tunable). */
  labelScale?: number;
  /** Dynamic CFG diagrams hosted by symbol cells (zoom-gated). */
  cfgEntries?: CfgEntry[];
  width: number;
  height: number;
  /** Stacked-plane tilt; when enabled the content group carries its affine. */
  tilt?: TiltParams;
  /** Alt+drag tilt deltas (screen px) bubbled up from the viewport. */
  onTiltDrag?: (dxPx: number, dyPx: number) => void;
  selectedId: string | null;
  selectedIds?: Set<string>;
  /** Picked dependency edges (proximity click); raised above the map. */
  selectedEdges?: { source: string; target: string }[];
  /** Command-palette preview target: outlined (not selected) so the user sees
   * which node the camera auto-focused. */
  previewId?: string | null;
  onSelect: (id: string | null, additive?: boolean) => void;
  /** Pick the dependency edge nearest a background click; shift adds it to
   * the multi-selection. */
  onSelectEdge?: (source: string, target: string, additive?: boolean) => void;
  /** Fly the camera to an element (off-screen dependency name click). */
  onFocusId?: (id: string) => void;
  focusRequest?: FocusRequest | null;
  /** Fired when a view settles (LOD commit); world center + zoom. */
  onViewSettle?: (center: Vec2, zoom: number) => void;
  /** Pointer entered/left a symbol cell; client coords drive the host tooltip. */
  onSymbolHover?: (symbolId: string | null, screen: Vec2 | null) => void;
  /** Double-click a test-case cell → run just that case. */
  onRunTest?: (testId: string) => void;
};

/** Cells smaller than this on screen are not worth a polygon. */
const MIN_CELL_PX = 2.5;
const DIFF_DENSITY_STROKE = "hsl(29 96% 58%)";
/** Edges shorter than this on screen are sub-pixel noise. */
const MIN_EDGE_PX = 6;
/** Symbol cells at least this big on screen show their classification tag. */
const SYMBOL_ICON_MIN_PX = 26;
/** Class members stay collapsed until their cell is this big on screen. */
const MEMBER_TAG_MIN_PX = 55;

export function TreemapSvg(props: Props) {
  const { state, width, height, tilt, onTiltDrag, selectedId, onSelect } = props;
  // slider-tunable label sizing: floor (min on-screen px) + font multiplier;
  // labelFactor (9px baseline) scales the visibility gates too
  const labelMinPx = props.labelMinPx ?? 9;
  const labelScale = props.labelScale ?? 1;
  const labelFactor = labelMinPx / 9;
  /** Font size (world units) clamped to [labelMinPx, maxPx] on screen, scaled. */
  const labelFont = (worldBase: number, maxPx: number, zoom: number): number =>
    Math.min(Math.max(worldBase, labelMinPx / zoom), maxPx / zoom) * labelScale;
  const multiSelected = props.selectedIds ?? new Set<string>();
  const isSelected = (id: string): boolean => id === selectedId || multiSelected.has(id);
  const cyclicIds = props.cyclicIds ?? new Set<string>();
  const focus = props.focus ?? null;
  const bundleStrength = props.bundleStrength ?? BUNDLE_STRENGTH;
  const traceEdges = props.traceEdges ?? [];
  const traceHeat = props.traceHeat;
  // warm tint for an executed symbol, hotter (redder, more opaque) with self time
  const traceFillOf = (id: string): string | undefined => {
    const heat = traceHeat?.get(id);
    if (heat === undefined) return undefined;
    const alpha = 0.18 + 0.55 * heat;
    return `rgba(255, ${Math.round(150 - 110 * heat)}, 40, ${alpha.toFixed(3)})`;
  };

  const levelVisible = (kind: string): boolean => props.visibleLevels?.has(kind) ?? true;
  const leafVisible = levelVisible(props.leafKind ?? "file");
  const onSelectEdge = props.onSelectEdge;
  const selectedEdges = props.selectedEdges ?? [];
  const isSelectedEdge = (s: string, t: string) =>
    selectedEdges.some((e) => e.source === s && e.target === t);
  const pickEdgeRef = useRef<(x: number, y: number, shift: boolean) => boolean>(() => false);
  const hoverEdgeRef = useRef<(x: number, y: number) => void>(() => {});
  const { svgProps, zoom, committedView, contentRef, clientToWorld, toViewScale } = useMapViewport({
    width,
    height,
    focusRequest: props.focusRequest,
    onViewSettle: props.onViewSettle,
    onPickEdge: (x, y, shift) => pickEdgeRef.current(x, y, shift),
    onHover: (x, y) => hoverEdgeRef.current(x, y),
    onTilt: onTiltDrag,
  });
  // affine that lays the plane flat (pitch) and spins it (rotate); labels read
  // `tiltAffine` to stay upright on top
  const tiltActive =
    !!tilt?.enabled && (tilt.theta !== 0 || tilt.pitch !== 0 || anyPlaneShown(tilt));
  const tiltOpts = tilt
    ? {
        theta: tilt.theta,
        squash: Math.cos(tilt.pitch),
        center: { x: width / 2, y: height / 2 },
      }
    : null;
  const tiltAffine: Affine | undefined =
    tiltActive && tiltOpts ? layerTransform({ ...tiltOpts, gap: 0, index: 0 }) : undefined;
  const tiltMatrix = tiltAffine ? toMatrixString(tiltAffine) : undefined;
  const layers = props.layers ?? [];
  const satellitesOn = !!tilt?.enabled && layers.length > 0 && !!tiltOpts;
  const planeFor = (index: number): Affine | undefined =>
    tilt && tiltOpts ? layerTransform({ ...tiltOpts, gap: tilt.gap * height, index }) : undefined;
  // representative upper-plane point per source file = centroid of leaf cells
  const sourceSiteOf = useMemo(() => {
    // anchor on the file's largest cell so symbol-granularity links land on a
    // real (tinted) cell, not the centroid gap between a file's symbols
    const best = new Map<string, { site: Vec2; area: number }>();
    const parentFileOf = props.parentFileOf ?? ((id: string) => id);
    if (satellitesOn) {
      for (const layout of state.leafLayouts.values())
        for (const c of layout.cells) {
          const f = parentFileOf(c.id);
          const e = best.get(f);
          if (!e || c.actualArea > e.area) best.set(f, { site: c.site, area: c.actualArea });
        }
    }
    const m = new Map<string, Vec2>();
    for (const [f, e] of best) m.set(f, e.site);
    return m;
  }, [state, props.parentFileOf, satellitesOn]);
  // every node's screen point across all planes (see RingsMapSvg): lets a dep
  // edge resolve onto the tests plane instead of being dropped.
  const screenPos = useMemo(() => {
    const m = new Map<string, Vec2>();
    if (tiltAffine) for (const [f, site] of sourceSiteOf) m.set(f, apply(tiltAffine, site));
    for (const layer of layers) {
      const t = planeFor(layer.planeIndex);
      if (!t) continue;
      for (const n of layer.placed) m.set(n.id, apply(t, n.site));
    }
    return m;
  }, [sourceSiteOf, layers, tiltAffine, height]);
  const referencedIds = useMemo(() => {
    const s = new Set<string>();
    for (const layer of layers)
      for (const n of layer.placed) for (const sid of n.sourceIds) s.add(sid);
    return s;
  }, [layers]);
  // referencedIds are file paths; a symbol cell counts as referenced when its
  // parent file is. `linkedCell` works at either granularity.
  const linkedCell = (id: string) =>
    referencedIds.size > 0 &&
    (referencedIds.has(id) || referencedIds.has((props.parentFileOf ?? ((x) => x))(id)));
  // cross-plane hovered node id (a source cell's file, or a satellite node);
  // its cross-layer edges light up. alt overrides to show all.
  const [linkHover, setLinkHover] = useState<string | null>(null);
  const fileIdOf = props.parentFileOf ?? ((x) => x);
  // selection keeps its edges up persistently (id + its file, since edges
  // target file ids)
  const pinnedLinkIds = useMemo(() => {
    const s = new Set<string>();
    const add = (id: string) => {
      s.add(id);
      s.add(fileIdOf(id));
    };
    if (selectedId) add(selectedId);
    for (const id of multiSelected) add(id);
    return s;
  }, [selectedId, multiSelected, fileIdOf]);
  // files whose cross-layer edges are currently shown → tint them in the
  // connecting layer's edge colour (mirrors the edge gate)
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
  // amber "referenced" cue yields while a link highlight is active (see rings)
  const hasActiveLinks = activeLinkTint.size > 0;
  const [hoveredEdge, setHoveredEdge] = useState<{
    source: string;
    target: string;
  } | null>(null);
  const hoveredEdgeRef = useRef<{ source: string; target: string } | null>(null);
  /** Last symbol cell the cursor was over, so hover fires only on change. */
  const hoverSymRef = useRef<string | null>(null);

  const topCells = state.levels[0]!.cells;
  const innerLevels = state.levels.slice(1);
  const fileCells = useMemo(() => [...state.leafLayouts.values()].flatMap((l) => l.cells), [state]);
  const positionOf = useMemo(() => {
    const map = new Map<string, Vec2>();
    // every boundary level contributes bundling control points
    for (const level of state.levels) {
      for (const [id, cell] of level.cells) map.set(id, cell.site);
    }
    for (const cell of fileCells) map.set(cell.id, cell.site);
    for (const cell of props.innerCells ?? []) map.set(cell.id, cell.site);
    // anchor any trace endpoint with no cell of its own to its enclosing cell,
    // so the executed-path edge still lands where the symbol lives
    const anchor = (id: string): void => {
      if (map.has(id)) return;
      let cur: string | null = state.parentOf.get(id) ?? null;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const at = map.get(cur);
        if (at) {
          map.set(id, at);
          return;
        }
        cur = state.parentOf.get(cur) ?? null;
      }
    };
    for (const edge of traceEdges) {
      anchor(edge.source);
      anchor(edge.target);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, fileCells, props.innerCells, traceEdges]);
  const parentModuleOf = (id: string): string | null => state.parentOf.get(id) ?? null;
  const topAncestorOf = makeTopAncestorOf(state.parentOf, (id) => topCells.has(id));

  // displayed CFGs re-anchor reference edges: incoming at the entry
  // terminal, outgoing at the step block that makes the call
  const cfgAnchors = useMemo(() => cfgAnchorsOf(props.cfgEntries ?? []), [props.cfgEntries]);
  const bundleOf = useMemo(
    () =>
      makeEdgeBundler({
        parentOf: state.parentOf,
        positionOf,
        strength: bundleStrength,
        span: Math.hypot(width, height),
        cfgAnchors,
      }),
    [state.parentOf, positionOf, bundleStrength, cfgAnchors, width, height],
  );
  // the lit reference fans bundle harder than the ambient mesh so a node's
  // many references group into trunks; rendering and proximity picking share
  // this so a click still lands on the drawn curve (mirrors RingsMapSvg)
  const referenceBundleOf = useMemo(
    () =>
      makeEdgeBundler({
        parentOf: state.parentOf,
        positionOf,
        strength: REFERENCE_BUNDLE_STRENGTH,
        span: Math.hypot(width, height),
        cfgAnchors,
      }),
    [state.parentOf, positionOf, cfgAnchors, width, height],
  );

  // viewport culling, shared with rings: at monorepo scale most of the
  // cost is cells and edges that sit entirely off-screen. The committed
  // view rect (post zoom/pan) decides visibility; slack keeps partially
  // visible geometry alive so panning never reveals an empty margin.
  const edgeSlack = committedView.w * 0.1;
  const edgeInView = (edge: AtlasEdge): boolean => {
    const a = positionOf.get(edge.source);
    const b = positionOf.get(edge.target);
    return a != null && b != null && segmentInView(a, b, committedView, edgeSlack);
  };

  const bundled = useMemo(() => {
    if (!props.showEdges || focus) return [];
    return props.fileEdges.flatMap((edge) => {
      if (!edgeInView(edge)) return [];
      const b = bundleOf(edge);
      return b ? [b] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.fileEdges,
    props.showEdges,
    focus,
    state,
    positionOf,
    bundleStrength,
    cfgAnchors,
    committedView,
  ]);

  // proximity edge picking: a background click selects the nearest visible
  // dependency edge, resolving overlaps by distance, not paint order (shared
  // with the rings layout via edgePick)

  const dim = focusDimOf(focus);
  const moduleOpacity = dim.module;
  const fileOpacity = dim.leaf;
  const structureOpacity = focus ? 0.5 : 1;

  // selection split: what the selection depends on vs what depends on it,
  // drawn regardless of the ambient-edges toggle (same as rings)
  const noSelection = selectedId === null && multiSelected.size === 0;
  const directions = useMemo(
    () =>
      selectionDirections({
        edges: noSelection || focus ? [] : props.fileEdges,
        isSelected,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.fileEdges, selectedId, multiSelected, noSelection, focus],
  );

  // grabbable edges are the *prominent* ones — the lit selection/focus
  // dependencies — not the faint ambient mesh, which would steal clicks from
  // the cells beneath it.
  const candidates: EdgePickCandidate[] = useMemo(() => {
    const out: EdgePickCandidate[] = [];
    const litEdges = focus
      ? [...focus.downstreamEdges, ...focus.upstreamEdges]
      : [...directions.outgoing, ...directions.incoming];
    for (const edge of litEdges) {
      const bundle = referenceBundleOf(edge);
      if (bundle) {
        out.push({ source: edge.source, target: edge.target, points: bundle.points });
      }
    }
    return out;
  }, [focus, directions, referenceBundleOf]);
  const resolveEdgeAt = (
    clientX: number,
    clientY: number,
  ): { source: string; target: string } | null =>
    resolveEdgeAtClient(clientX, clientY, clientToWorld, candidates, toViewScale);
  pickEdgeRef.current = (clientX, clientY, shift) => {
    if (!onSelectEdge) return false;
    const hit = resolveEdgeAt(clientX, clientY);
    if (!hit) return false;
    onSelectEdge(hit.source, hit.target, shift);
    return true;
  };
  // hover preview: surface the edge a click would pick (and a pointer cursor)
  hoverEdgeRef.current = (clientX, clientY) => {
    const next = onSelectEdge ? resolveEdgeAt(clientX, clientY) : null;
    const cur = hoveredEdgeRef.current;
    if (cur?.source !== next?.source || cur?.target !== next?.target) {
      hoveredEdgeRef.current = next;
      setHoveredEdge(next);
    }
    // LSP hover tooltip: hit-test the cell under the cursor by geometry (the
    // same approach RingsMapSvg uses). The host ignores non-symbol ids.
    if (props.onSymbolHover) {
      const world = clientToWorld(clientX, clientY);
      let sym: string | null = null;
      if (world) {
        const hits = (cell: CellResult): boolean =>
          cell.polygon.length >= 3 && containsPoint(cell.polygon, world);
        for (const cell of props.innerCells ?? []) {
          if (hits(cell)) {
            sym = cell.id;
            break;
          }
        }
        if (!sym) {
          outer: for (const layout of state.leafLayouts.values()) {
            for (const cell of layout.cells) {
              if (hits(cell)) {
                sym = cell.id;
                break outer;
              }
            }
          }
        }
      }
      if (sym !== hoverSymRef.current) {
        hoverSymRef.current = sym;
        props.onSymbolHover(sym, sym ? { x: clientX, y: clientY } : null);
      }
    }
  };

  const edgeEndpoints = makeEdgeEndpointResolver({
    positionOf: (id) => positionOf.get(id),
    cfgAnchors,
    symbolNameOf,
  });

  const innerCells = props.innerCells ?? [];
  const parentFileOf = props.parentFileOf ?? ((id: string) => id);
  const showInner = zoom > 0.8 && innerCells.length > 0;
  const visibleInnerCells = showInner
    ? innerCells.filter(
        (c) =>
          c.polygon.length >= 3 &&
          (isSelected(c.id) ||
            (Math.sqrt(c.actualArea) * zoom >= MIN_CELL_PX &&
              cellInView(c.site, Math.sqrt(c.actualArea), committedView))),
      )
    : [];

  const fillOf = (cell: CellResult): string =>
    traceFillOf(cell.id) ??
    leafFillOf(cell.id, {
      cyclicIds,
      testFileIds: props.testFileIds,
      dependencyIds: directions.dependencyIds,
      dependentIds: directions.dependentIds,
      topAncestorOf,
    });

  const visibleFileCells = fileCells.filter(
    (c) =>
      c.polygon.length >= 3 &&
      (isSelected(c.id) ||
        props.changedOf?.(c.id) !== undefined ||
        (Math.sqrt(c.actualArea) * zoom >= MIN_CELL_PX &&
          cellInView(c.site, Math.sqrt(c.actualArea), committedView))),
  );
  const labelOf = (id: string): string =>
    props.labels?.get(id) ?? symbolNameOf(id) ?? id.split("/").pop() ?? id;
  const diffLabel = (id: string, name: string, screenPx: number, force = false): string => {
    const stat = props.diffStatOf?.(id);
    if (!stat || (!force && (zoom < 1.35 || screenPx < 72))) return name;
    const percent = formatDiffPercent(stat);
    return percent ? `${name} ${percent}` : name;
  };
  const selectedOutlineIds = (() => {
    const ids: string[] = [];
    if (selectedId) ids.push(selectedId);
    for (const id of multiSelected) if (id !== selectedId) ids.push(id);
    return ids;
  })();
  const selectedOutline = focusNodeOutlineVisual(zoom);

  // a hovered edge spotlights its off-screen endpoints' docked names, so you
  // can read where the edge under the cursor is heading
  const exitHighlightIds = hoveredEdge
    ? new Set([hoveredEdge.source, hoveredEdge.target])
    : undefined;

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
      <style>{"polygon, path { vector-effect: non-scaling-stroke; }"}</style>
      <g ref={contentRef} transform={tiltMatrix}>
        {/* top-level districts */}
        <g style={{ display: levelVisible(state.levels[0]!.kind) ? "" : "none" }}>
          {[...topCells.values()].map((cell) =>
            cell.polygon.length >= 3 ? (
              <polygon
                key={cell.id}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={districtFill(cell.id)}
                fill-opacity={moduleOpacity(cell.id)}
                stroke={isSelected(cell.id) ? SELECT_STROKE : districtStroke(cell.id)}
                stroke-opacity={
                  moduleOpacity(cell.id) * (isSelected(cell.id) ? 1 : structureOpacity)
                }
                stroke-width={isSelected(cell.id) ? 3 : 1.6}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(cell.id, event.shiftKey);
                }}
              />
            ) : null,
          )}
        </g>
        {/* intermediate boundary districts (shared with rings) */}
        <InnerLevelsLayer
          levels={innerLevels}
          topAncestorOf={topAncestorOf}
          isSelected={isSelected}
          onSelect={onSelect}
          dim={dim}
          zoom={zoom}
          labels={props.labels}
          visibleLevels={props.visibleLevels}
          tilt={tiltAffine}
          subdued={focus !== null}
        />
        {/* file cells */}
        <g style={{ display: leafVisible ? "" : "none" }}>
          {visibleFileCells.map((cell) => {
            // outline zoom-gated like rings: macro views read as filled
            // regions, borders fade in as cells grow on screen
            const border =
              isSelected(cell.id) || Math.sqrt(cell.actualArea) * zoom >= LEAF_BORDER_MIN_PX;
            const linked = !isSelected(cell.id) && !hasActiveLinks && linkedCell(cell.id);
            const dimmed =
              hasActiveLinks && !isSelected(cell.id) && !activeLinkTint.has(fileIdOf(cell.id));
            const diffStat = props.diffStatOf?.(cell.id);
            return (
              <polygon
                key={cell.id}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={fillOf(cell)}
                fill-opacity={fileOpacity(cell.id) * (dimmed ? 0.35 : 1)}
                stroke={
                  isSelected(cell.id)
                    ? SELECT_STROKE
                    : linked
                      ? LINKED_STROKE
                      : diffStat
                        ? DIFF_DENSITY_STROKE
                        : border
                          ? LEAF_STROKE
                          : "none"
                }
                stroke-opacity={
                  (linked
                    ? 0.95
                    : diffStat
                      ? 0.62 + 0.34 * Math.sqrt(diffStat.ratio)
                      : fileOpacity(cell.id)) * (dimmed ? 0.35 : 1)
                }
                stroke-width={
                  isSelected(cell.id) ? 2.5 : linked ? 1.4 : diffStrokeWidth(diffStat, 0.9)
                }
                onMouseEnter={satellitesOn ? () => setLinkHover(fileIdOf(cell.id)) : undefined}
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
              const tint = activeLinkTint.get(fileIdOf(cell.id));
              if (!tint) return null;
              return (
                <polygon
                  key={`lt:${cell.id}`}
                  points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
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
        {leafVisible ? (
          <WatermarkLabelsLayer
            cells={visibleFileCells}
            zoom={zoom}
            labelOf={labelOf}
            dim={dim}
            view={committedView}
            tilt={tiltAffine}
          />
        ) : null}
        {/* nested symbols inside file cells (same rules as rings) */}
        {showInner ? (
          <g stroke={SYMBOL_STROKE} stroke-width={0.4} stroke-opacity={0.8}>
            {visibleInnerCells.map((cell) => {
              const diffStat = props.diffStatOf?.(cell.id);
              return cell.id.endsWith("#rest") ? null : (
                <polygon
                  key={cell.id}
                  points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="transparent"
                  stroke={
                    isSelected(cell.id) ? SELECT_STROKE : diffStat ? DIFF_DENSITY_STROKE : undefined
                  }
                  stroke-width={isSelected(cell.id) ? 1.6 : diffStrokeWidth(diffStat, 0.4)}
                  stroke-opacity={diffStat ? 0.65 + 0.3 * Math.sqrt(diffStat.ratio) : undefined}
                  opacity={dim.symbol(cell.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(cell.id, event.shiftKey);
                  }}
                />
              );
            })}
          </g>
        ) : null}
        {leafVisible ? (
          <g style={{ pointerEvents: "none" }}>
            {visibleFileCells.map((cell) => {
              const stat = props.diffStatOf?.(cell.id);
              if (!stat || isSelected(cell.id)) return null;
              const pts = cell.polygon.map((p) => `${p.x},${p.y}`).join(" ");
              return (
                <polygon
                  key={`diff-file:${cell.id}`}
                  points={pts}
                  fill="none"
                  stroke={DIFF_DENSITY_STROKE}
                  stroke-opacity={diffOutlineOpacity(stat)}
                  stroke-width={diffForegroundStrokeWidth(stat, 0.9)}
                  stroke-linejoin="round"
                />
              );
            })}
            {showInner
              ? visibleInnerCells.map((cell) => {
                  const stat = props.diffStatOf?.(cell.id);
                  if (!stat || isSelected(cell.id) || cell.id.endsWith("#rest")) return null;
                  const pts = cell.polygon.map((p) => `${p.x},${p.y}`).join(" ");
                  return (
                    <polygon
                      key={`diff-symbol:${cell.id}`}
                      points={pts}
                      fill="none"
                      stroke={DIFF_DENSITY_STROKE}
                      stroke-opacity={diffOutlineOpacity(stat)}
                      stroke-width={diffForegroundStrokeWidth(stat, 0.4)}
                      stroke-linejoin="round"
                    />
                  );
                })
              : null}
          </g>
        ) : null}
        {showInner ? (
          <g text-anchor="middle" style={{ pointerEvents: "none", userSelect: "none" }}>
            {visibleInnerCells.map((cell) => {
              if (cell.id.endsWith("#rest")) return null;
              const fileSelected = isSelected(parentFileOf(cell.id));
              const dominant =
                Math.sqrt(cell.actualArea) * zoom >=
                Math.min(width, height) * SYMBOL_DOMINANT_FRACTION;
              const rawName = labelOf(cell.id);
              const kind = props.symbolKindOf?.(cell.id);
              const glyph = symbolGlyphOf(kind, rawName);
              // members stay collapsed until a deep zoom enlarges their cell
              const isMember = glyph === "method" || glyph === "property";
              const onScreen = Math.sqrt(cell.actualArea) * zoom;
              const changed = props.diffStatOf?.(cell.id) !== undefined;
              const changedReadable = changed && onScreen >= 28 * labelFactor;
              const name = diffLabel(
                cell.id,
                rawName,
                onScreen,
                isSelected(cell.id) || fileSelected || changedReadable,
              );
              const roomy =
                zoom >= SYMBOL_ZOOM &&
                onScreen >= (isMember ? MEMBER_TAG_MIN_PX : SYMBOL_ICON_MIN_PX) * labelFactor;
              const fontSize = labelFont(Math.sqrt(cell.actualArea) * 0.3, 13, zoom);
              // only auto-show a label that fits its cell on screen, so dense areas
              // don't fill with overlapping names (explicit selections always show)
              const labelPx = name.length * fontSize * zoom * 0.5;
              const fits = onScreen * 1.25 >= labelPx;
              const passes = isMember
                ? roomy || isSelected(cell.id) || changedReadable
                : isSelected(cell.id) ||
                  fileSelected ||
                  ((dominant || roomy || changedReadable) && fits);
              if (!passes) return null;
              return (
                <SymbolTag
                  key={cell.id}
                  cx={cell.site.x}
                  cy={cell.site.y - 4 / zoom}
                  name={name}
                  glyph={glyph}
                  static={isStaticKind(kind)}
                  fontSize={fontSize}
                  showIcon={fontSize * zoom * 1.1 >= 9}
                  color={
                    glyph
                      ? SYMBOL_KIND_COLORS[glyph]!
                      : props.exportedIds?.has(cell.id)
                        ? EXPORTED_LABEL
                        : INTERNAL_LABEL
                  }
                  opacity={dim.symbol(cell.id)}
                  tilt={tiltAffine}
                />
              );
            })}
          </g>
        ) : null}
        <CfgLayer entries={props.cfgEntries ?? []} zoom={zoom} view={committedView} />
        {/* bundled dependency edges */}
        {props.showEdges && !focus ? (
          <g fill="none">
            {bundled.map((edge) => {
              const active =
                isSelected(edge.source) ||
                isSelected(edge.target) ||
                isSelected(parentModuleOf(edge.source) ?? "") ||
                isSelected(parentModuleOf(edge.target) ?? "");
              // sub-pixel intra-module edges are pure overdraw at overview
              if (!active && edge.chord * zoom < MIN_EDGE_PX) return null;
              const v = ambientEdgeVisual(active, !!selectedId, {
                active: ACTIVE_EDGE,
                ambient: UPSTREAM_COLOR,
              });
              return (
                <path
                  key={`${edge.source} ${edge.target}`}
                  d={edge.d}
                  stroke={v.stroke}
                  stroke-opacity={v.opacity}
                  stroke-width={v.width}
                  style={{ pointerEvents: "none" }}
                />
              );
            })}
          </g>
        ) : null}
        {/* selection references, colored by direction; independent of the
          ambient-edge toggle. A faint solid mesh (matching rings) rather than
          the old bright dashed fan. */}
        {!focus
          ? (
              [
                [directions.outgoing, DOWNSTREAM_COLOR],
                [directions.incoming, UPSTREAM_COLOR],
              ] as const
            ).map(([edges, color]) => (
              <BundledEdges
                key={`sel-${color}`}
                edges={edges}
                bundleOf={referenceBundleOf}
                stroke={color}
                strokeOpacity={REFERENCE_EDGE_BASE.opacity}
                strokeWidth={REFERENCE_EDGE_BASE.width}
                keyPrefix="sel"
              />
            ))
          : null}
        {/* runtime-trace overlay: the executed call path, always on when ingested */}
        <BundledEdges
          edges={traceEdges}
          bundleOf={bundleOf}
          stroke="#ff7a1a"
          strokeOpacity={0.75}
          strokeWidth={1.6}
          keyPrefix="trace"
        />
        {/* extracted dependency paths, colored by direction */}
        {focus
          ? (
              [
                [focus.downstreamEdges, DOWNSTREAM_COLOR],
                [focus.upstreamEdges, UPSTREAM_COLOR],
              ] as const
            ).map(([edges, color]) => (
              <BundledEdges
                key={`focus-${color}`}
                edges={edges}
                bundleOf={referenceBundleOf}
                stroke={color}
                strokeOpacity={0.85}
                strokeWidth={1.8}
                keyPrefix="focus"
              />
            ))
          : null}
        {/* hover preview: a faint accent over the edge a click would pick */}
        {hoveredEdge && !isSelectedEdge(hoveredEdge.source, hoveredEdge.target)
          ? (() => {
              const bundle = referenceBundleOf({
                source: hoveredEdge.source,
                target: hoveredEdge.target,
              });
              // kept thin — only the hovered edge lifts, the mesh stays light
              return bundle ? (
                <g style={{ pointerEvents: "none" }}>
                  <RaisedEdgePath d={bundle.d} width={5} opacity={0.18} />
                  <RaisedEdgePath d={bundle.d} width={1.5} opacity={0.9} />
                </g>
              ) : null;
            })()
          : null}
        {selectedOutlineIds.length > 0 ? (
          <g style={{ pointerEvents: "none" }}>
            {selectedOutlineIds.map((id) => {
              let poly = topCells.get(id)?.polygon ?? null;
              if (!poly)
                for (const c of innerCells)
                  if (c.id === id) {
                    poly = c.polygon;
                    break;
                  }
              if (!poly)
                for (const c of fileCells)
                  if (c.id === id) {
                    poly = c.polygon;
                    break;
                  }
              if (!poly || poly.length < 3) return null;
              const pts = poly.map((p) => `${p.x},${p.y}`).join(" ");
              return (
                <g key={`selected-outline:${id}`}>
                  <polygon
                    points={pts}
                    fill="none"
                    stroke={SELECT_HALO_STROKE}
                    stroke-width={selectedOutline.haloWidth}
                    stroke-opacity={0.85}
                    stroke-linejoin="round"
                  />
                  <polygon
                    points={pts}
                    fill="none"
                    stroke={SELECT_STROKE}
                    stroke-width={selectedOutline.coreWidth}
                    stroke-opacity={1}
                    stroke-linejoin="round"
                  />
                </g>
              );
            })}
          </g>
        ) : null}
        {/* command-palette preview: outline the auto-focused (not yet selected)
          node so it's clear which one the camera flew to */}
        {props.previewId
          ? (() => {
              const id = props.previewId;
              const previewOutline = focusNodeOutlineVisual(zoom, true);
              let poly = topCells.get(id)?.polygon ?? null;
              if (!poly)
                for (const c of innerCells)
                  if (c.id === id) {
                    poly = c.polygon;
                    break;
                  }
              if (!poly)
                for (const c of fileCells)
                  if (c.id === id) {
                    poly = c.polygon;
                    break;
                  }
              if (!poly || poly.length < 3) return null;
              const pts = poly.map((p) => `${p.x},${p.y}`).join(" ");
              return (
                <g style={{ pointerEvents: "none" }}>
                  <polygon
                    points={pts}
                    fill="none"
                    stroke={SELECT_HALO_STROKE}
                    stroke-width={previewOutline.haloWidth}
                    stroke-opacity={0.7}
                    stroke-linejoin="round"
                  />
                  <polygon
                    points={pts}
                    fill="none"
                    stroke={SELECT_STROKE}
                    stroke-width={previewOutline.coreWidth}
                    stroke-opacity={0.95}
                    stroke-dasharray={previewOutline.dasharray}
                    stroke-linejoin="round"
                  />
                </g>
              );
            })()
          : null}
        {/* picked edge, raised above the districts: bold accented stroke with
          its endpoint districts outlined (pointer-through so cells stay
          clickable) */}
        {selectedEdges.map((selectedEdge) => {
          const key = `${selectedEdge.source}->${selectedEdge.target}`;
          const bundle = bundleOf({
            source: selectedEdge.source,
            target: selectedEdge.target,
          });
          if (!bundle) return null;
          return (
            <g key={key} style={{ pointerEvents: "none" }}>
              <RaisedEdgePath d={bundle.d} />
              {[selectedEdge.source, selectedEdge.target].map((id) => {
                const top = topAncestorOf(id);
                const cell = top ? topCells.get(top) : null;
                if (!cell || cell.polygon.length < 3) return null;
                return (
                  <polygon
                    key={id}
                    points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={SELECT_STROKE}
                    stroke-width={3}
                  />
                );
              })}
            </g>
          );
        })}
        {/* top-level labels */}
        <g
          text-anchor="middle"
          style={{
            pointerEvents: "none",
            userSelect: "none",
            display: levelVisible(state.levels[0]!.kind) ? "" : "none",
          }}
        >
          {[...topCells.values()].map((cell) => {
            if (cell.polygon.length < 3) return null;
            // screen-px cap: district names stay readable, never dominant
            const fontSize = labelFont(Math.sqrt(cell.actualArea) * 0.18, 28, zoom);
            return (
              <text
                key={cell.id}
                transform={uprightAt(tiltAffine, cell.site)}
                font-size={fontSize}
                font-weight="700"
                fill={districtLabelFill(cell.id)}
                fill-opacity={0.85 * moduleOpacity(cell.id)}
              >
                {labelOf(cell.id)}
              </text>
            );
          })}
        </g>
        {/* file labels appear once their cell is readable, and hand off to
          the background watermark past the shared threshold */}
        <g
          fill={FILE_LABEL_INK}
          text-anchor="middle"
          style={{
            pointerEvents: "none",
            userSelect: "none",
            display: leafVisible ? "" : "none",
          }}
        >
          {visibleFileCells.map((cell) => {
            if (isWatermarkSized(cell, zoom)) return null;
            const px = Math.sqrt(cell.actualArea) * zoom;
            const rawName = labelOf(cell.id);
            const changed = props.diffStatOf?.(cell.id) !== undefined;
            const changedReadable = changed && px >= 28 * labelFactor;
            // symbol leaves get their kind icon + matching ink; files stay plain
            const kind = props.leafKind === "symbol" ? props.symbolKindOf?.(cell.id) : undefined;
            // members stay collapsed until their cell is large on screen
            const isMember =
              kind === "method" ||
              kind === "property" ||
              kind === "static-method" ||
              kind === "static-property";
            if (
              px < (isMember ? MEMBER_TAG_MIN_PX : 28) * labelFactor &&
              !isSelected(cell.id) &&
              !changedReadable
            ) {
              return null;
            }
            // screen-px cap (like rings): the name stays modest while
            // zooming until the watermark copy takes over
            const fontSize = labelFont(Math.sqrt(cell.actualArea) * 0.14, 18, zoom);
            const glyph = symbolGlyphOf(kind, rawName);
            const name = diffLabel(cell.id, rawName, px, isSelected(cell.id) || changedReadable);
            return (
              <SymbolTag
                key={cell.id}
                cx={cell.site.x}
                cy={cell.site.y}
                name={name}
                glyph={glyph}
                static={isStaticKind(kind)}
                fontSize={fontSize}
                color={glyph ? SYMBOL_KIND_COLORS[glyph]! : FILE_LABEL_INK}
                opacity={fileOpacity(cell.id)}
                tilt={tiltAffine}
              />
            );
          })}
        </g>
        {(focus
          ? ([
              [focus.downstreamEdges, DOWNSTREAM_COLOR, "exit-focus-down"],
              [focus.upstreamEdges, UPSTREAM_COLOR, "exit-focus-up"],
            ] as const)
          : ([
              [directions.outgoing, DOWNSTREAM_COLOR, "exit-sel-down"],
              [directions.incoming, UPSTREAM_COLOR, "exit-sel-up"],
            ] as const)
        ).map(([edges, color, key]) => (
          <ExitPreviewsLayer
            key={key}
            edges={edges}
            color={color}
            view={committedView}
            endpointsOf={edgeEndpoints}
            labelOf={labelOf}
            onSelect={onSelect}
            onFocus={props.onFocusId}
            zoom={zoom}
            tilt={tiltAffine}
            highlightIds={exitHighlightIds}
          />
        ))}
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
                statusFillOf={
                  layer.id === "test" && props.testStatus
                    ? (id) => {
                        const s = props.testStatus!.get(id);
                        return s ? TEST_STATUS_FILL[s] : undefined;
                      }
                    : undefined
                }
                labelSuffixOf={
                  layer.id === "test" && props.testDuration
                    ? (id) => {
                        const d = props.testDuration!.get(id);
                        return d !== undefined ? `${Math.round(d)}ms` : undefined;
                      }
                    : undefined
                }
                onRunCell={layer.id === "test" ? props.onRunTest : undefined}
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
