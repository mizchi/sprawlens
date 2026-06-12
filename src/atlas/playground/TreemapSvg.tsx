import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AtlasEdge } from "../contracts/graph.js";
import { bundlePath, hierarchyControlPoints } from "../kernel/bundling.js";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import type { TreemapState } from "./treemapController.js";

type Props = {
  state: TreemapState;
  fileEdges: AtlasEdge[];
  showEdges: boolean;
  /** Hierarchy-path bundling strength: 1 = fully bundled, 0 = straight. */
  bundleStrength?: number;
  labels?: Map<string, string>;
  changedFiles?: Map<string, "added" | "modified">;
  cyclicIds?: Set<string>;
  width: number;
  height: number;
  selectedId: string | null;
  selectedIds?: Set<string>;
  onSelect: (id: string | null, additive?: boolean) => void;
};

type ViewBox = { x: number; y: number; w: number; h: number };

const MODIFIED_FILL = "hsl(8 85% 78%)";
const ADDED_FILL = "hsl(150 55% 80%)";
const CYCLE_FILL = "hsl(0 70% 86%)";
/** Cells smaller than this on screen are not worth a polygon. */
const MIN_CELL_PX = 2.5;
const COMMIT_MS = 120;

/** Stable pastel per module so the borders read as districts. */
function moduleHue(moduleId: string): number {
  let h = 0;
  for (let i = 0; i < moduleId.length; i++) {
    h = (h * 31 + moduleId.charCodeAt(i)) % 360;
  }
  return h;
}

/** Catmull-Rom through the control points as a cubic-Bézier SVG path. */
function smoothPathD(points: readonly Vec2[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M${points[0]!.x},${points[0]!.y}L${points[1]!.x},${points[1]!.y}`;
  }
  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(i + 2, points.length - 1)]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function TreemapSvg(props: Props) {
  const { state, width, height, selectedId, onSelect } = props;
  const multiSelected = props.selectedIds ?? new Set<string>();
  const isSelected = (id: string): boolean =>
    id === selectedId || multiSelected.has(id);
  const cyclicIds = props.cyclicIds ?? new Set<string>();
  const bundleStrength = props.bundleStrength ?? 0.85;

  // zoom/pan: gestures write the viewBox straight to the DOM; the
  // LOD-affecting re-render commits after the gesture settles (same
  // pattern as RingsMapSvg).
  const viewRef = useRef<ViewBox>({ x: 0, y: 0, w: width, h: height });
  const [committedView, setCommittedView] = useState<ViewBox>(viewRef.current);
  const commitTimer = useRef(0);
  const dragRef = useRef<{ pointerId: number; last: Vec2; moved: number } | null>(
    null,
  );
  const suppressClickRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const applyView = () => {
    const v = viewRef.current;
    svgRef.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = 0;
      setCommittedView({ ...viewRef.current });
    }, COMMIT_MS);
  };
  useEffect(() => () => clearTimeout(commitTimer.current), []);
  const zoom = width / committedView.w;

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

  const fileCells = useMemo(
    () => [...state.fileLayouts.values()].flatMap((l) => l.cells),
    [state],
  );
  const positionOf = useMemo(() => {
    const map = new Map<string, Vec2>();
    for (const [id, cell] of state.moduleCells) map.set(id, cell.site);
    for (const cell of fileCells) map.set(cell.id, cell.site);
    return map;
  }, [state, fileCells]);
  const parentModuleOf = (id: string): string | null =>
    state.parentOf.get(id) ?? null;

  const bundled = useMemo(() => {
    if (!props.showEdges) return [];
    return props.fileEdges.flatMap((edge) => {
      const path = hierarchyControlPoints(
        edge.source,
        edge.target,
        state.parentOf,
        positionOf,
      );
      if (!path) return [];
      const first = path[0]!;
      const last = path[path.length - 1]!;
      return [
        {
          source: edge.source,
          target: edge.target,
          d: smoothPathD(bundlePath(path, bundleStrength)),
          chord: Math.hypot(last.x - first.x, last.y - first.y),
        },
      ];
    });
  }, [props.fileEdges, props.showEdges, state, positionOf, bundleStrength]);

  const fillOf = (cell: CellResult): string => {
    const changed = props.changedFiles?.get(cell.id);
    if (changed === "added") return ADDED_FILL;
    if (changed === "modified") return MODIFIED_FILL;
    if (cyclicIds.has(cell.id)) return CYCLE_FILL;
    const hue = moduleHue(parentModuleOf(cell.id) ?? "");
    return `hsl(${hue} 25% 94%)`;
  };

  const visibleFileCells = fileCells.filter(
    (c) =>
      c.polygon.length >= 3 &&
      (Math.sqrt(c.actualArea) * zoom >= MIN_CELL_PX ||
        isSelected(c.id) ||
        props.changedFiles?.has(c.id)),
  );
  const labelOf = (id: string): string => props.labels?.get(id) ?? id;

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewRef.current.x} ${viewRef.current.y} ${viewRef.current.w} ${viewRef.current.h}`}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        touchAction: "none",
        cursor: dragRef.current ? "grabbing" : "default",
      }}
      onWheel={onWheel}
      onPointerDown={(e) => {
        const svg = svgRef.current;
        if (!svg) return;
        svg.setPointerCapture(e.pointerId);
        dragRef.current = {
          pointerId: e.pointerId,
          last: { x: e.clientX, y: e.clientY },
          moved: 0,
        };
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const v = viewRef.current;
        const dx = ((e.clientX - drag.last.x) / rect.width) * v.w;
        const dy = ((e.clientY - drag.last.y) / rect.height) * v.h;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.last = { x: e.clientX, y: e.clientY };
        viewRef.current = { ...v, x: v.x - dx, y: v.y - dy };
        applyView();
      }}
      onPointerUp={(e) => {
        const drag = dragRef.current;
        if (drag && drag.pointerId === e.pointerId) {
          suppressClickRef.current = drag.moved > 4;
          dragRef.current = null;
        }
      }}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onSelect(null);
      }}
    >
      {/* module districts */}
      <g>
        {[...state.moduleCells.values()].map((cell) =>
          cell.polygon.length >= 3 ? (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={`hsl(${moduleHue(cell.id)} 30% 97%)`}
              stroke={
                isSelected(cell.id)
                  ? "#1d4ed8"
                  : `hsl(${moduleHue(cell.id)} 45% 55%)`
              }
              stroke-width={(isSelected(cell.id) ? 3 : 1.6) / zoom}
              onClick={(event) => {
                event.stopPropagation();
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                onSelect(cell.id, event.shiftKey);
              }}
            />
          ) : null,
        )}
      </g>
      {/* file cells */}
      <g>
        {visibleFileCells.map((cell) => (
          <polygon
            key={cell.id}
            points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={fillOf(cell)}
            stroke={isSelected(cell.id) ? "#1d4ed8" : "#94a3b8"}
            stroke-width={(isSelected(cell.id) ? 2.5 : 0.6) / zoom}
            onClick={(event) => {
              event.stopPropagation();
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onSelect(cell.id, event.shiftKey);
            }}
          />
        ))}
      </g>
      {/* bundled dependency edges */}
      {props.showEdges ? (
        <g fill="none">
          {bundled.map((edge) => {
            const active =
              isSelected(edge.source) ||
              isSelected(edge.target) ||
              isSelected(parentModuleOf(edge.source) ?? "") ||
              isSelected(parentModuleOf(edge.target) ?? "");
            // sub-pixel intra-module edges are pure overdraw at overview
            if (!active && edge.chord * zoom < 6) return null;
            return (
              <path
                key={`${edge.source} ${edge.target}`}
                d={edge.d}
                stroke={active ? "#c2410c" : "#0891b2"}
                stroke-opacity={active ? 0.9 : selectedId ? 0.08 : 0.22}
                stroke-width={(active ? 1.8 : 1) / zoom}
                style={{ pointerEvents: "none" }}
              />
            );
          })}
        </g>
      ) : null}
      {/* module labels */}
      <g
        text-anchor="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {[...state.moduleCells.values()].map((cell) => {
          if (cell.polygon.length < 3) return null;
          const fontSize = Math.min(
            Math.sqrt(cell.actualArea) * 0.18,
            22 / zoom + 6,
          );
          return (
            <text
              key={cell.id}
              x={cell.site.x}
              y={cell.site.y}
              font-size={fontSize}
              font-weight="700"
              fill={`hsl(${moduleHue(cell.id)} 50% 32%)`}
              fill-opacity={0.85}
            >
              {labelOf(cell.id)}
            </text>
          );
        })}
      </g>
      {/* file labels appear once their cell is readable */}
      <g
        fill="#334155"
        text-anchor="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {visibleFileCells.map((cell) => {
          const px = Math.sqrt(cell.actualArea) * zoom;
          if (px < 46 && !isSelected(cell.id)) return null;
          const fontSize = Math.max(Math.sqrt(cell.actualArea) * 0.14, 9 / zoom);
          return (
            <text
              key={cell.id}
              x={cell.site.x}
              y={cell.site.y}
              font-size={fontSize}
              font-weight={isSelected(cell.id) ? "700" : "400"}
            >
              {labelOf(cell.id)}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
