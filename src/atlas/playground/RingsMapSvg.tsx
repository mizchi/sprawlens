import { useEffect, useRef, useState } from "preact/hooks";
import type { AtlasEdge } from "../contracts/graph.js";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import type { RingsState } from "./ringsController.ts";

export type FocusRequest = { x: number; y: number; zoom: number; token: number };

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

export type TestOverlayItem = {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  targetId: string | null;
};

/** Direction palette: what I depend on vs what depends on me. */
const DOWNSTREAM_COLOR = "#ea580c";
const UPSTREAM_COLOR = "#0891b2";

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
  testOverlay: TestOverlayItem[];
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focusRequest: FocusRequest | null;
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
const DIM = 0.1;
const EXPORTED_FILL = "rgba(16, 185, 129, 0.22)";

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
    testOverlay,
    width,
    height,
    selectedId,
    onSelect,
    focusRequest,
  } = props;
  // Interactive zoom/pan writes the viewBox straight to the DOM (cheap),
  // while the LOD-affecting re-render (label sizing, culling, mode switches)
  // is committed at most every COMMIT_MS. Re-rendering ~1.4k SVG nodes per
  // wheel event is what froze the tab before.
  const viewRef = useRef<ViewBox>({ x: 0, y: 0, w: width, h: height });
  const [committedView, setCommittedView] = useState<ViewBox>(viewRef.current);
  const commitTimer = useRef(0);
  const dragRef = useRef<{ pointerId: number; last: Vec2 } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const COMMIT_MS = 120;

  const applyView = () => {
    const v = viewRef.current;
    svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    if (commitTimer.current === 0) {
      commitTimer.current = window.setTimeout(() => {
        commitTimer.current = 0;
        setCommittedView({ ...viewRef.current });
      }, COMMIT_MS);
    }
  };
  useEffect(() => () => clearTimeout(commitTimer.current), []);

  useEffect(() => {
    if (!focusRequest) return;
    const w = width / focusRequest.zoom;
    const h = height / focusRequest.zoom;
    viewRef.current = {
      x: focusRequest.x - w / 2,
      y: focusRequest.y - h / 2,
      w,
      h,
    };
    setCommittedView({ ...viewRef.current });
  }, [focusRequest?.token]);

  const toViewScale = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? viewRef.current.w / rect.width : 1;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
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

  const fileCells = [...rings.moduleLayouts.values()].flatMap((l) => l.cells);
  const fileSiteById = new Map(fileCells.map((c) => [c.id, c.site]));
  const symbolSiteById = new Map(innerCells.map((c) => [c.id, c.site]));
  const testSiteById = new Map(
    testOverlay.map((t) => [t.id, { x: t.x, y: t.y }]),
  );
  const resolveSite = (id: string): Vec2 | undefined => {
    const site =
      symbolSiteById.get(id) ?? fileSiteById.get(id) ?? testSiteById.get(id);
    if (site) return site;
    const circle = rings.circles.get(id);
    return circle ? { x: circle.cx, y: circle.cy } : undefined;
  };
  const moduleList = [...rings.circles.entries()];

  const zoom = width / committedView.w;
  const showInner = zoom > 0.8;
  const symbolMode = zoom >= SYMBOL_ZOOM;
  // viewport culling: when zoomed in, most cells sit outside the view —
  // skip their DOM entirely (slack = own size so partially-visible survive)
  const cullActive = zoom > 1.5;
  const inView = (p: Vec2, slack: number) =>
    !cullActive ||
    (p.x >= committedView.x - slack &&
      p.x <= committedView.x + committedView.w + slack &&
      p.y >= committedView.y - slack &&
      p.y <= committedView.y + committedView.h + slack);
  const cellVisible = (cell: CellResult) =>
    inView(cell.site, Math.sqrt(cell.actualArea) * 1.5);
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
    return Math.min(Math.max(screen, min), max) / zoom;
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
      onClick={() => onSelect(null)}
      onWheel={onWheel}
      onPointerDown={(e) => {
        dragRef.current = {
          pointerId: e.pointerId,
          last: { x: e.clientX, y: e.clientY },
        };
        (e.target as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const scale = toViewScale();
        const v = viewRef.current;
        viewRef.current = {
          ...v,
          x: v.x - (e.clientX - drag.last.x) * scale,
          y: v.y - (e.clientY - drag.last.y) * scale,
        };
        drag.last = { x: e.clientX, y: e.clientY };
        applyView();
      }}
      onPointerUp={(e) => {
        if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
      }}
    >
      {/* vector-effect does not inherit from <g>; apply to every shape so
          stroke widths (including selection highlights) stay in screen px */}
      <style>{"polygon, line, circle { vector-effect: non-scaling-stroke; }"}</style>
      {/* aggregated module dependencies, under everything */}
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
            fill="#eef2f7"
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
      <g>
        {fileCells.map((cell) =>
          cell.polygon.length >= 3 && cellVisible(cell) ? (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={cellFill(cell.targetArea, cell.actualArea)}
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
          {innerCells.map((cell) =>
            cell.polygon.length >= 3 && cellVisible(cell) ? (
              <polygon
                key={cell.id}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={
                  exportedIds.has(cell.id) ? EXPORTED_FILL : "transparent"
                }
                stroke={cell.id === selectedId ? "#1d4ed8" : undefined}
                stroke-width={cell.id === selectedId ? 1.6 : undefined}
                opacity={symbolOpacity(cell.id)}
                onClick={
                  symbolMode
                    ? (event) => {
                        event.stopPropagation();
                        onSelect(cell.id);
                      }
                    : undefined
                }
              />
            ) : null,
          )}
        </g>
      ) : null}
      {showEdges && !focus && !symbolMode ? (
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
      <g fill="#1e293b">
        {fileCells.map((cell) =>
          cell.polygon.length >= 3 && cellVisible(cell) ? (
            <circle
              key={cell.id}
              cx={cell.site.x}
              cy={cell.site.y}
              r={screenRadius(cell.id === selectedId ? 4 : 2.2)}
              fill={cell.id === selectedId ? "#1d4ed8" : "#1e293b"}
              opacity={fileOpacity(cell.id)}
            />
          ) : null,
        )}
      </g>
      {symbolMode || selectedIsSymbol ? (
        <g fill="#6d28d9">
          {innerCells.map((cell) =>
            cell.polygon.length >= 3 &&
            (symbolMode || cell.id === selectedId) &&
            (cellVisible(cell) || cell.id === selectedId) ? (
              <circle
                key={cell.id}
                cx={cell.site.x}
                cy={cell.site.y}
                r={screenRadius(cell.id === selectedId ? 3.2 : 1.8)}
                fill={
                  cell.id === selectedId
                    ? "#1d4ed8"
                    : exportedIds.has(cell.id)
                      ? "#059669"
                      : "#6d28d9"
                }
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
      {/* test layer: translucent circles stacked on the covered source cell */}
      {testOverlay.length > 0 ? (
        <g>
          {testOverlay.map((t) => {
            if (!inView({ x: t.x, y: t.y }, t.r * 2)) return null;
            const opacity = focus
              ? focus.fileIds.has(t.id) ||
                (t.targetId !== null && focus.fileIds.has(t.targetId))
                ? 1
                : DIM
              : 1;
            const fontSize = screenFont(t.r * 0.4, 8, 12, t.id === selectedId);
            return (
              <g key={t.id} opacity={opacity}>
                <circle
                  cx={t.x}
                  cy={t.y}
                  r={t.r}
                  fill="rgba(100, 116, 139, 0.18)"
                  stroke={t.id === selectedId ? "#1d4ed8" : "#64748b"}
                  stroke-width={t.id === selectedId ? 1.8 : 0.8}
                  stroke-dasharray="4 3"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(t.id);
                  }}
                />
                {fontSize !== null ? (
                  <text
                    x={t.x}
                    y={t.y + t.r + fontSize * 1.1}
                    font-size={fontSize}
                    text-anchor="middle"
                    fill="#64748b"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {t.label}
                  </text>
                ) : null}
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
          ? fileCells.map((cell) => {
              if (cell.polygon.length < 3 || !cellVisible(cell)) return null;
              const fontSize = screenFont(
                Math.sqrt(cell.actualArea) * 0.18,
                9,
                15,
                cell.id === selectedId,
                250,
              );
              if (fontSize === null) return null;
              return (
                <text
                  key={cell.id}
                  x={cell.site.x}
                  y={cell.site.y - screenRadius(5)}
                  font-size={fontSize}
                  fill="#334155"
                  opacity={fileOpacity(cell.id)}
                >
                  {labels.get(cell.id) ?? fallbackLabel(cell.id)}
                </text>
              );
            })
          : null}
        {symbolMode
          ? innerCells.map((cell) => {
              if (cell.polygon.length < 3 || !cellVisible(cell)) return null;
              // module-scope filler cells stay unlabeled to reduce noise
              if (cell.id.endsWith("#rest") && cell.id !== selectedId)
                return null;
              // public API first: exported symbols label earlier (lower
              // threshold), private ones only once zoomed further in
              const exported = exportedIds.has(cell.id);
              const fontSize = screenFont(
                Math.sqrt(cell.actualArea) * 0.3,
                exported ? 7 : 13,
                12,
                cell.id === selectedId,
                200,
              );
              if (fontSize === null) return null;
              return (
                <text
                  key={cell.id}
                  x={cell.site.x}
                  y={cell.site.y - screenRadius(4)}
                  font-size={fontSize}
                  fill={exportedIds.has(cell.id) ? "#047857" : "#5b21b6"}
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
