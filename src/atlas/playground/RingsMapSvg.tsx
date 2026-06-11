import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AtlasEdge } from "../contracts/graph.js";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import type { RingsState } from "./ringsController.ts";

/** Camera-flight target: the view rect that frames the jump target's bbox. */
export type FocusRequest = {
  cx: number;
  cy: number;
  viewW: number;
  token: number;
};

/** Dependency-path extraction state, precomputed by the App per level. */
export type FocusView = {
  level: "module" | "file" | "symbol";
  moduleIds: Set<string>;
  fileIds: Set<string>;
  symbolIds: Set<string>;
  /** Paths the focused node depends on. */
  downstreamEdges: AtlasEdge[];
  /** Paths that depend on the focused node. */
  upstreamEdges: AtlasEdge[];
};

/** Direction palette: what I depend on vs what depends on me. */
const DOWNSTREAM_COLOR = "#ea580c";
const UPSTREAM_COLOR = "#0891b2";
/** Muted fill for test-layer cells: visible for ratio reading, not loud. */
const TEST_FILL = "hsl(210 10% 81%)";
/** Public API marker: the site dot, not the cell area, carries the signal. */
const EXPORTED_DOT = "#059669";
/** Cells of nodes caught in a dependency cycle: the tangles to break. */
const CYCLE_FILL = "hsl(0 70% 86%)";
/** Diff layer: changed files read from fill, not outline. */
const MODIFIED_FILL = "hsl(8 85% 78%)";
const ADDED_FILL = "hsl(150 55% 80%)";

type Props = {
  rings: RingsState;
  innerCells: CellResult[];
  fileEdges: AtlasEdge[];
  /** Symbol references; endpoints may be symbol ids or file ids. */
  symbolEdges: AtlasEdge[];
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
  /** Nodes inside dependency cycles: their cells get a red-tinted fill. */
  cyclicIds?: Set<string>;
  /** Modules inside module-level cycles: red-tinted circles. */
  cyclicModuleIds?: Set<string>;
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focusRequest: FocusRequest | null;
  /** Fired when a view settles (LOD commit); world center + zoom. */
  onViewSettle?: (center: Vec2, zoom: number) => void;
};

function cellFill(targetArea: number, actualArea: number): string {
  const error = Math.abs(actualArea - targetArea) / targetArea;
  const t = Math.min(error / 0.3, 1);
  const hue = 215 - t * 215;
  return `hsl(${hue} ${30 + t * 60}% ${88 - t * 30}%)`;
}

/** Last path-ish segment as a fallback label for unlabeled ids. */
function fallbackLabel(id: string): string {
  const hash = id.indexOf("#");
  if (hash >= 0) return id.slice(hash + 1);
  return id.split("/").pop() ?? id;
}

type ViewBox = { x: number; y: number; w: number; h: number };

/** Zoom level at which individual symbols become interactive nodes. */
const SYMBOL_ZOOM = 2.2;
/**
 * A symbol's name appears only once its cell dominates the screen — this
 * fraction of the viewport's short side (tune to taste). Linked public
 * symbols and symbols of the selected file are exempt.
 */
const SYMBOL_DOMINANT_FRACTION = 0.35;
const DIM = 0.1;

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
  const cyclicIds = props.cyclicIds ?? new Set<string>();
  const cyclicModuleIds = props.cyclicModuleIds ?? new Set<string>();
  // Interactive zoom/pan writes the viewBox straight to the DOM (cheap),
  // while the LOD-affecting re-render (label sizing, culling, mode switches)
  // is committed at most every COMMIT_MS. Re-rendering ~1.4k SVG nodes per
  // wheel event is what froze the tab before.
  const viewRef = useRef<ViewBox>({ x: 0, y: 0, w: width, h: height });
  const [committedView, setCommittedView] = useState<ViewBox>(viewRef.current);
  const commitTimer = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    last: Vec2;
    moved: number;
  } | null>(null);
  /** A drag that actually panned must not select on release. */
  const suppressClickRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const COMMIT_MS = 120;

  const commitView = () => {
    const v = { ...viewRef.current };
    setCommittedView(v);
    onViewSettle?.({ x: v.x + v.w / 2, y: v.y + v.h / 2 }, width / v.w);
  };
  const applyView = () => {
    const v = viewRef.current;
    svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    // trailing debounce: committing (and thus re-running LOD + inserting
    // hundreds of nodes) mid-gesture made zooming back out janky — the
    // gesture stays on the cheap scaled-raster path until it settles
    clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = 0;
      commitView();
    }, COMMIT_MS);
  };
  useEffect(() => () => clearTimeout(commitTimer.current), []);

  // camera flight: ease the view toward the requested rect instead of
  // teleporting. Zoom interpolates in log space (perceptually linear);
  // any user input cancels the flight.
  const flightRef = useRef(0);
  const cancelFlight = () => {
    cancelAnimationFrame(flightRef.current);
    flightRef.current = 0;
  };
  useEffect(() => {
    if (!focusRequest) return;
    cancelFlight();
    const from = { ...viewRef.current };
    const fromCx = from.x + from.w / 2;
    const fromCy = from.y + from.h / 2;
    const toW = Math.min(Math.max(focusRequest.viewW, width / 40), width * 3);
    const toH = toW * (height / width);
    // rAF never fires in hidden tabs — land instantly there
    if (document.visibilityState === "hidden") {
      viewRef.current = {
        x: focusRequest.cx - toW / 2,
        y: focusRequest.cy - toH / 2,
        w: toW,
        h: toH,
      };
      const v = viewRef.current;
      svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
      commitView();
      return;
    }
    const start = performance.now();
    const DURATION_MS = 450;
    const step = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      const e = 1 - (1 - t) ** 3; // easeOutCubic
      const w = from.w * (toW / from.w) ** e;
      const h = from.h * (toH / from.h) ** e;
      const cx = fromCx + (focusRequest.cx - fromCx) * e;
      const cy = fromCy + (focusRequest.cy - fromCy) * e;
      viewRef.current = { x: cx - w / 2, y: cy - h / 2, w, h };
      const v = viewRef.current;
      svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
      if (t < 1) {
        flightRef.current = requestAnimationFrame(step);
      } else {
        flightRef.current = 0;
        commitView();
      }
    };
    flightRef.current = requestAnimationFrame(step);
    return cancelFlight;
  }, [focusRequest?.token]);

  const toViewScale = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? viewRef.current.w / rect.width : 1;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    cancelFlight();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = Math.exp(event.deltaY * 0.0018);
    const v = viewRef.current;
    const newW = Math.min(Math.max(v.w * factor, width / 40), width * 3);
    const scale = newW / v.w;
    const px = v.x + ((event.clientX - rect.left) / rect.width) * v.w;
    const py = v.y + ((event.clientY - rect.top) / rect.height) * v.h;
    viewRef.current = {
      x: px - (px - v.x) * scale,
      y: py - (py - v.y) * scale,
      w: newW,
      h: v.h * scale,
    };
    applyView();
  };

  // rings keeps its identity once converged, innerCells once settled — these
  // memos stop per-commit Map/array rebuilds (a major GC-pressure source)
  const fileCells = useMemo(
    () =>
      showFiles ? [...rings.moduleLayouts.values()].flatMap((l) => l.cells) : [],
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
  /** Symbols somebody actually references (the linked public surface). */
  const referencedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const edge of symbolEdges) ids.add(edge.target);
    return ids;
  }, [symbolEdges]);
  const resolveSite = (id: string): Vec2 | undefined => {
    const site =
      symbolSiteById.get(id) ?? fileSiteById.get(id) ?? portSiteById.get(id);
    if (site) return site;
    const circle = rings.circles.get(id);
    return circle ? { x: circle.cx, y: circle.cy } : undefined;
  };
  const moduleList = useMemo(() => [...rings.circles.entries()], [rings]);

  const zoom = width / committedView.w;
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
    // the selection's file always shows its internals
    if (selectedId !== null) allowed.add(parentFileOf(selectedId));
    return allowed;
  })();
  const innerVisible = (cell: CellResult) =>
    cell.id === selectedId ||
    (Math.sqrt(cell.actualArea) * zoom >= MIN_SYMBOL_PX &&
      allowedFiles.has(parentFileOf(cell.id)) &&
      cellVisible(cell));

  // filter once; the render lists below share these instead of re-testing
  // visibility per layer (3x the cells each render adds up at 4k+ symbols)
  const visibleFileCells = fileCells.filter(
    (c) => c.polygon.length >= 3 && cellVisible(c),
  );
  const visibleInnerCells = innerCells.filter(
    (c) => c.polygon.length >= 3 && innerVisible(c),
  );
  const selectedIsSymbol =
    selectedId !== null && symbolSiteById.has(selectedId);
  // reference edges touching the selection stay visible at any zoom,
  // colored by direction (outgoing = dependencies, incoming = dependents)
  const selectedOutgoing =
    selectedId === null
      ? []
      : symbolEdges.filter((e) => e.source === selectedId);
  const selectedIncoming =
    selectedId === null
      ? []
      : symbolEdges.filter((e) => e.target === selectedId);

  const moduleOpacity = (id: string) =>
    focus && !focus.moduleIds.has(id) ? DIM : 1;
  const fileOpacity = (id: string) =>
    focus && !focus.fileIds.has(id) ? DIM : 1;
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
      ref={svgRef}
      viewBox={`${viewRef.current.x} ${viewRef.current.y} ${viewRef.current.w} ${viewRef.current.h}`}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        touchAction: "none",
        cursor: "grab",
      }}
      onClickCapture={(e) => {
        // the click fired by releasing a pan must not (de)select anything
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onClick={() => onSelect(null)}
      onWheel={onWheel}
      onPointerDown={(e) => {
        cancelFlight();
        dragRef.current = {
          pointerId: e.pointerId,
          last: { x: e.clientX, y: e.clientY },
          moved: 0,
        };
        (e.target as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const dx = e.clientX - drag.last.x;
        const dy = e.clientY - drag.last.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        const scale = toViewScale();
        const v = viewRef.current;
        viewRef.current = {
          ...v,
          x: v.x - dx * scale,
          y: v.y - dy * scale,
        };
        drag.last = { x: e.clientX, y: e.clientY };
        applyView();
      }}
      onPointerUp={(e) => {
        const drag = dragRef.current;
        if (drag?.pointerId === e.pointerId) {
          // ~5px of accumulated motion = a pan, not a click
          if (drag.moved > 5) suppressClickRef.current = true;
          dragRef.current = null;
        }
      }}
    >
      {/* vector-effect does not inherit from <g>; apply to every shape so
          stroke widths (including selection highlights) stay in screen px */}
      <style>{"polygon, line, circle { vector-effect: non-scaling-stroke; }"}</style>
      {/* aggregated module dependencies: the macro structure, always on */}
      {!focus ? (
        <g stroke="#475569" fill="none">
          {rings.moduleEdges.map((edge) => {
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
      <g>
        {moduleList.map(([id, circle]) => (
          <circle
            key={id}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fill={cyclicModuleIds.has(id) ? "hsl(0 65% 92%)" : "#eef2f7"}
            stroke={id === selectedId ? "#1d4ed8" : "#334155"}
            stroke-width={id === selectedId ? 2.4 : 1.2}
            opacity={moduleOpacity(id)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(id);
            }}
          />
        ))}
      </g>
      <g style={{ display: sourceVisible ? "" : "none" }}>
        {visibleFileCells.map((cell) =>
          true ? (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={
                changedFiles.get(cell.id) === "added"
                  ? ADDED_FILL
                  : changedFiles.get(cell.id) === "modified"
                    ? MODIFIED_FILL
                    : cyclicIds.has(cell.id)
                      ? CYCLE_FILL
                      : testFileIds.has(cell.id)
                        ? TEST_FILL
                        : cellFill(cell.targetArea, cell.actualArea)
              }
              stroke={cell.id === selectedId ? "#1d4ed8" : "#475569"}
              stroke-width={cell.id === selectedId ? 2 : 0.8}
              opacity={fileOpacity(cell.id)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id);
              }}
            />
          ) : null,
        )}
      </g>
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
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="transparent"
                stroke={cell.id === selectedId ? "#1d4ed8" : undefined}
                stroke-width={cell.id === selectedId ? 1.6 : undefined}
                opacity={symbolOpacity(cell.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(cell.id);
                }}
              />
            ) : null,
          )}
        </g>
      ) : null}
      {showEdges && sourceVisible && !focus && !symbolMode ? (
        <g stroke="#f97316" stroke-opacity={0.4} fill="none">
          {fileEdges.map((edge) => {
            const a = fileSiteById.get(edge.source);
            const b = fileSiteById.get(edge.target);
            if (!a || !b) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke-width={
                  edge.source === selectedId || edge.target === selectedId
                    ? 1.6
                    : 0.5
                }
              />
            );
          })}
        </g>
      ) : null}
      {showEdges && !focus && symbolMode ? (
        <g stroke="#7c3aed" stroke-opacity={0.45} fill="none">
          {symbolEdges.map((edge) => {
            const a = resolveSite(edge.source);
            const b = resolveSite(edge.target);
            if (!a || !b) return null;
            const slack = committedView.w * 0.1;
            if (!inView(a, slack) && !inView(b, slack)) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke-width={0.6}
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
                const a = resolveSite(edge.source);
                const b = resolveSite(edge.target);
                if (!a || !b) return null;
                return (
                  <line
                    key={`focus-${edge.source}-${edge.target}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke-width={
                      focus.level === "module"
                        ? 1.5 + Math.log2(1 + (edge.weight ?? 1))
                        : 1.2
                    }
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
              const a = resolveSite(edge.source);
              const b = resolveSite(edge.target);
              if (!a || !b) return null;
              return (
                <line
                  key={`sel-${edge.source}-${edge.target}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke-width={1.6}
                />
              );
            })}
          </g>
        ) : null,
      )}
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
                  r={screenRadius(port.id === selectedId ? 5 : 3.6)}
                  fill="#ffffff"
                  stroke={port.id === selectedId ? "#1d4ed8" : EXPORTED_DOT}
                  stroke-width={port.id === selectedId ? 2.4 : 1.8}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(port.id);
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
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {moduleList.map(([id, circle]) => {
          // modules are the macro anchors: always labeled, 10–18px on screen
          const fontSize = screenFont(circle.r * 0.18, 10, 18, true);
          if (fontSize === null) return null;
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
              {id}
            </text>
          );
        })}
        {showInner
          ? visibleFileCells.map((cell) => {
              const fontSize = screenFont(
                Math.sqrt(cell.actualArea) * 0.18,
                9,
                15,
                cell.id === selectedId,
                // detailed cells keep their header even when the viewport
                // sits inside them; the name doubles as a block title
                allowedFiles.has(cell.id) ? Infinity : 250,
              );
              if (fontSize === null) return null;
              // the name stays centered until the file is selected
              // (explicitly or via zoom focus); only then it becomes a
              // block-top header clearing room for the symbol labels
              const detailed = cell.id === selectedId;
              let y = cell.site.y + fontSize * 0.35;
              if (detailed) {
                let minY = Infinity;
                for (const p of cell.polygon) minY = Math.min(minY, p.y);
                y = minY + fontSize * 1.2;
              }
              return (
                <text
                  key={cell.id}
                  x={cell.site.x}
                  y={y}
                  font-size={fontSize}
                  font-weight={detailed ? "600" : "400"}
                  fill={testFileIds.has(cell.id) ? "#7a8699" : "#334155"}
                  opacity={fileOpacity(cell.id) * (detailed ? 0.85 : 1)}
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
              // (b) its file is selected, (c) it's the selection itself —
              // except linked public symbols, which always label
              const linkedPublic = exported && referencedIds.has(cell.id);
              const fileSelected =
                selectedId !== null &&
                parentFileOf(cell.id) === selectedId;
              const dominant =
                Math.sqrt(cell.actualArea) * zoom >=
                Math.min(width, height) * SYMBOL_DOMINANT_FRACTION;
              if (
                !linkedPublic &&
                !fileSelected &&
                !dominant &&
                cell.id !== selectedId
              )
                return null;
              const fontSize = screenFont(
                Math.sqrt(cell.actualArea) * 0.3,
                exported ? 7 : 13,
                12,
                cell.id === selectedId || fileSelected || dominant,
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
