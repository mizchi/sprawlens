import { useMemo, useRef } from "preact/hooks";
import type { AtlasEdge } from "../contracts/graph.js";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import type { RingsState } from "./ringsController.ts";

import { CfgLayer, cfgAnchorsOf, type CfgEntry } from "./CfgLayer.tsx";
import {
  DIM,
  DOWNSTREAM_COLOR,
  DOWNSTREAM_FILL,
  focusDimOf,
  InnerLevelsLayer,
  isWatermarkSized,
  leafFillOf,
  makeEdgeBundler,
  makeTopAncestorOf,
  selectionDirections,
  SELECT_STROKE,
  UPSTREAM_COLOR,
  UPSTREAM_FILL,
  WatermarkLabelsLayer,
} from "./mapShared.tsx";
import { symbolNameOf } from "./cfgClient.ts";
import {
  useMapViewport,
  type FocusRequest,
  type FocusView,
} from "./useMapViewport.ts";

export type { FocusRequest, FocusView } from "./useMapViewport.ts";

/** Public API marker: the site dot, not the cell area, carries the signal. */
const EXPORTED_DOT = "#059669";

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
  /** Layer ids switched off; "source" hides the file/symbol map itself. */
  hiddenLayers: Set<string>;
  /** Symbol id → parent file id (precomputed; string parsing here was hot). */
  parentFileOf: (id: string) => string;
  /** History diff: files changed by the displayed commit get accent strokes. */
  changedFiles: Map<string, "added" | "modified">;
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
  selectedId: string | null;
  /** Full multi-selection (shift+click); selectedId is its primary. */
  selectedIds?: Set<string>;
  onSelect: (id: string | null, additive?: boolean) => void;
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

/** Zoom level at which individual symbols become interactive nodes. */
const SYMBOL_ZOOM = 2.2;
/**
 * A symbol's name appears only once its cell dominates the screen — this
 * fraction of the viewport's short side (tune to taste). Linked public
 * symbols and symbols of the selected file are exempt.
 */
const SYMBOL_DOMINANT_FRACTION = 0.35;
/** Cells smaller than this on screen render as nothing — the module
 * circle's fill carries the texture; zooming in reveals them. */
const MIN_CELL_PX = 2.5;
/** Edges shorter than this on screen are sub-pixel noise. */
const MIN_EDGE_PX = 6;

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
    changedFiles,
    portNodes,
    width,
    height,
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
  const { svgProps, committedView, zoom } = useMapViewport({
    width,
    height,
    focusRequest,
    onViewSettle,
  });

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
    () => makeEdgeBundler({ parentOf: bundleParentOf, positionOf, cfgAnchors }),
    [bundleParentOf, positionOf, cfgAnchors],
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
    isSelected(id) || changedFiles.has(id) || cyclicIds.has(id);
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
  type ExitPreview = {
    id: string;
    x: number;
    y: number;
    side: "left" | "right" | "top" | "bottom";
  };
  const exitPreviews = (edges: AtlasEdge[]): ExitPreview[] => {
    const v = committedView;
    const x0 = v.x;
    const x1 = v.x + v.w;
    const y0 = v.y;
    const y1 = v.y + v.h;
    const inside = (p: Vec2) =>
      p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    const seen = new Set<string>();
    const previews: ExitPreview[] = [];
    for (const edge of edges) {
      const ends = edgeEndpoints(edge);
      if (!ends) continue;
      const [a, b] = ends;
      const aIn = inside(a);
      if (aIn === inside(b)) continue;
      const near = aIn ? a : b;
      const far = aIn ? b : a;
      const farId = aIn ? edge.target : edge.source;
      if (seen.has(farId)) continue;
      seen.add(farId);
      const dx = far.x - near.x;
      const dy = far.y - near.y;
      let t = 1;
      let side: ExitPreview["side"] = "right";
      if (dx > 0 && far.x > x1) {
        const tt = (x1 - near.x) / dx;
        if (tt < t) {
          t = tt;
          side = "right";
        }
      }
      if (dx < 0 && far.x < x0) {
        const tt = (x0 - near.x) / dx;
        if (tt < t) {
          t = tt;
          side = "left";
        }
      }
      if (dy > 0 && far.y > y1) {
        const tt = (y1 - near.y) / dy;
        if (tt < t) {
          t = tt;
          side = "bottom";
        }
      }
      if (dy < 0 && far.y < y0) {
        const tt = (y0 - near.y) / dy;
        if (tt < t) {
          t = tt;
          side = "top";
        }
      }
      previews.push({
        id: farId,
        x: near.x + dx * t,
        y: near.y + dy * t,
        side,
      });
    }
    return previews;
  };
  const renderExitPreviews = (
    edges: AtlasEdge[],
    color: string,
    keyPrefix: string,
  ) => {
    const previews = exitPreviews(edges);
    if (previews.length === 0) return null;
    const fontSize = 10.5 / zoom;
    return (
      <g key={keyPrefix} style={{ userSelect: "none" }}>
        {previews.map((preview) => (
          <text
            key={preview.id}
            x={
              preview.side === "left"
                ? preview.x + fontSize * 0.5
                : preview.side === "right"
                  ? preview.x - fontSize * 0.5
                  : preview.x
            }
            y={
              preview.side === "top"
                ? preview.y + fontSize * 1.3
                : preview.side === "bottom"
                  ? preview.y - fontSize * 0.5
                  : preview.y + fontSize * 0.35
            }
            font-size={fontSize}
            font-weight="600"
            text-anchor={
              preview.side === "left"
                ? "start"
                : preview.side === "right"
                  ? "end"
                  : "middle"
            }
            fill={color}
            stroke="#f8fafc"
            stroke-width={3 / zoom}
            paint-order="stroke"
            style={{ cursor: "pointer" }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(preview.id, event.shiftKey);
            }}
          >
            {labels.get(preview.id) ?? fallbackLabel(preview.id)}
          </text>
        ))}
      </g>
    );
  };
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
  const symbolOpacity = (id: string) =>
    focus && !focus.symbolIds.has(id) ? DIM : 1;

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
        cursor: "grab",
      }}
      onClick={() => onSelect(null)}
    >
      {/* vector-effect does not inherit from <g>; apply to every shape so
          stroke widths (including selection highlights) stay in screen px */}
      <style>
        {"polygon, line, circle, path { vector-effect: non-scaling-stroke; }"}
      </style>
      {/* aggregated module dependencies: the macro structure, always on */}
      {!focus ? (
        <g stroke="#475569" fill="none">
          {rings.topEdges.map((edge) => {
            const a = rings.circles.get(edge.source);
            const b = rings.circles.get(edge.target);
            if (!a || !b) return null;
            return (
              <line
                key={`${edge.source}->${edge.target}`}
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                stroke-width={1 + Math.log2(1 + (edge.weight ?? 1))}
                stroke-opacity={0.35}
              />
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
                    ? "hsl(0 65% 92%)"
                    : "#eef2f7"
            }
            stroke={isSelected(id) ? "#1d4ed8" : "#334155"}
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
      />
      <g style={{ display: sourceVisible ? "" : "none" }}>
        {visibleFileCells.map((cell) =>
          true ? (
            <polygon
              key={cell.id}
              points={pointsOf(cell)}
              fill={leafFillOf(cell.id, {
                changedFiles,
                cyclicIds,
                testFileIds,
                dependencyIds,
                dependentIds,
                topAncestorOf,
              })}
              stroke={isSelected(cell.id) ? SELECT_STROKE : "#94a3b8"}
              stroke-width={isSelected(cell.id) ? 2 : 0.8}
              opacity={fileOpacity(cell.id)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id, event.shiftKey);
              }}
            />
          ) : null,
        )}
      </g>
      {sourceVisible ? (
        <WatermarkLabelsLayer
          cells={visibleFileCells}
          zoom={zoom}
          labelOf={(id) => labels.get(id) ?? fallbackLabel(id)}
          dim={dim}
        />
      ) : null}
      {showInner ? (
        <g
          stroke="#64748b"
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
                stroke={isSelected(cell.id) ? "#1d4ed8" : undefined}
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
            const bundle = bundleOf(edge);
            if (!bundle) return null;
            const active =
              isSelected(edge.source) ||
              isSelected(edge.target) ||
              isSelected(rings.parentOf.get(edge.source) ?? "") ||
              isSelected(rings.parentOf.get(edge.target) ?? "");
            if (!active && bundle.chord * zoom < MIN_EDGE_PX) return null;
            return (
              <path
                key={`${edge.source}-${edge.target}`}
                d={bundle.d}
                stroke={active ? "#c2410c" : UPSTREAM_COLOR}
                stroke-opacity={active ? 0.9 : selectedId ? 0.08 : 0.22}
                stroke-width={active ? 1.8 : 1}
                style={{ pointerEvents: "none" }}
              />
            );
          })}
        </g>
      ) : null}
      {showEdges && !focus && symbolMode ? (
        <g stroke="#7c3aed" stroke-opacity={0.45} fill="none">
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
      {/* names of reference targets that left the screen, docked where
          their edge crosses the viewport border */}
      {focus
        ? [
            renderExitPreviews(
              focus.downstreamEdges,
              DOWNSTREAM_COLOR,
              "exit-focus-down",
            ),
            renderExitPreviews(
              focus.upstreamEdges,
              UPSTREAM_COLOR,
              "exit-focus-up",
            ),
          ]
        : [
            renderExitPreviews(
              [...selectedOutgoing, ...lspOutgoing],
              DOWNSTREAM_COLOR,
              "exit-sel-down",
            ),
            renderExitPreviews(
              [...selectedIncoming, ...lspIncoming],
              UPSTREAM_COLOR,
              "exit-sel-up",
            ),
          ]}
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
                  fill="#ffffff"
                  stroke={isSelected(port.id) ? "#1d4ed8" : EXPORTED_DOT}
                  stroke-width={isSelected(port.id) ? 2.4 : 1.8}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(port.id, event.shiftKey);
                  }}
                />
                <text
                  x={port.x}
                  y={port.y - screenRadius(7)}
                  font-size={11 / zoom}
                  text-anchor="middle"
                  font-weight="600"
                  fill="#047857"
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
                x={circle.cx}
                y={
                  circle.cy -
                  circle.r -
                  fontSize * 0.4 -
                  (segments.length - 1) * lineHeight
                }
                font-size={fontSize}
                font-weight="600"
                fill="#0f172a"
                opacity={moduleOpacity(id)}
              >
                {segments.map((segment, i) => (
                  <tspan
                    key={segment}
                    x={circle.cx}
                    dy={i === 0 ? 0 : lineHeight}
                  >
                    {i < segments.length - 1 ? `${segment}/` : segment}
                  </tspan>
                ))}
              </text>
            );
          }
          return (
            <text
              key={id}
              x={circle.cx}
              y={circle.cy - circle.r - fontSize * 0.4}
              font-size={fontSize}
              font-weight="600"
              fill="#0f172a"
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
                  x={cell.site.x}
                  y={cell.site.y + fontSize * 0.35}
                  font-size={fontSize}
                  fill={testFileIds.has(cell.id) ? "#7a8699" : "#334155"}
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
              if (
                !linked &&
                !fileSelected &&
                !dominant &&
                cell.id !== selectedId
              )
                return null;
              const fontSize = screenFont(
                Math.sqrt(cell.actualArea) * 0.3,
                exported ? 7 : 13,
                12,
                isSelected(cell.id) || fileSelected || dominant || linked,
                200,
              );
              if (fontSize === null) return null;
              return (
                <text
                  key={cell.id}
                  x={cell.site.x}
                  y={cell.site.y - screenRadius(4)}
                  font-size={fontSize}
                  fill={exported ? "#047857" : "#5b21b6"}
                  opacity={symbolOpacity(cell.id)}
                >
                  {labels.get(cell.id) ?? fallbackLabel(cell.id)}
                </text>
              );
            })
          : null}
      </g>
    </svg>
  );
}
