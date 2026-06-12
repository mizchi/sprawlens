import { useMemo } from "preact/hooks";
import type { AtlasEdge } from "../contracts/graph.js";
import { bundlePath, hierarchyControlPoints } from "../kernel/bundling.js";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import type { TreemapState } from "./treemapController.js";
import {
  useMapViewport,
  type FocusRequest,
  type FocusView,
} from "./useMapViewport.ts";

type Props = {
  state: TreemapState;
  fileEdges: AtlasEdge[];
  showEdges: boolean;
  /** Hierarchy-path bundling strength: 1 = fully bundled, 0 = straight. */
  bundleStrength?: number;
  labels?: Map<string, string>;
  changedFiles?: Map<string, "added" | "modified">;
  cyclicIds?: Set<string>;
  /** Dependency-path extraction: members stay lit, everything else dims. */
  focus?: FocusView | null;
  /** Stratum visibility by level kind: the partition still uses hidden
   * levels (placement, confinement), they just don't draw. */
  visibleLevels?: ReadonlySet<string>;
  /** Kind of the leaf cells ("file" or "symbol"). */
  leafKind?: string;
  width: number;
  height: number;
  selectedId: string | null;
  selectedIds?: Set<string>;
  onSelect: (id: string | null, additive?: boolean) => void;
  focusRequest?: FocusRequest | null;
  /** Fired when a view settles (LOD commit); world center + zoom. */
  onViewSettle?: (center: Vec2, zoom: number) => void;
};

const MODIFIED_FILL = "hsl(8 85% 78%)";
const ADDED_FILL = "hsl(150 55% 80%)";
const CYCLE_FILL = "hsl(0 70% 86%)";
/** Direction palette: what I depend on vs what depends on me. */
const DOWNSTREAM_COLOR = "#ea580c";
const UPSTREAM_COLOR = "#0891b2";
const DIM = 0.1;
/** Cells smaller than this on screen are not worth a polygon. */
const MIN_CELL_PX = 2.5;
/** Edges shorter than this on screen are sub-pixel noise. */
const MIN_EDGE_PX = 6;

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
  const focus = props.focus ?? null;
  const bundleStrength = props.bundleStrength ?? 0.85;

  const levelVisible = (kind: string): boolean =>
    props.visibleLevels?.has(kind) ?? true;
  const leafVisible = levelVisible(props.leafKind ?? "file");
  const { svgProps, zoom } = useMapViewport({
    width,
    height,
    focusRequest: props.focusRequest,
    onViewSettle: props.onViewSettle,
  });

  const topCells = state.levels[0]!.cells;
  const innerLevels = state.levels.slice(1);
  const fileCells = useMemo(
    () => [...state.leafLayouts.values()].flatMap((l) => l.cells),
    [state],
  );
  const positionOf = useMemo(() => {
    const map = new Map<string, Vec2>();
    // every boundary level contributes bundling control points
    for (const level of state.levels) {
      for (const [id, cell] of level.cells) map.set(id, cell.site);
    }
    for (const cell of fileCells) map.set(cell.id, cell.site);
    return map;
  }, [state, fileCells]);
  const parentModuleOf = (id: string): string | null =>
    state.parentOf.get(id) ?? null;
  /** Top-level (district) ancestor of any group or leaf id. */
  const topAncestorOf = (id: string): string | null => {
    let current: string | null = id;
    while (current != null && !topCells.has(current)) {
      current = state.parentOf.get(current) ?? null;
    }
    return current;
  };

  const bundleOf = (edge: AtlasEdge) => {
    const path = hierarchyControlPoints(
      edge.source,
      edge.target,
      state.parentOf,
      positionOf,
    );
    if (!path) return null;
    const first = path[0]!;
    const last = path[path.length - 1]!;
    return {
      source: edge.source,
      target: edge.target,
      d: smoothPathD(bundlePath(path, bundleStrength)),
      chord: Math.hypot(last.x - first.x, last.y - first.y),
    };
  };

  const bundled = useMemo(() => {
    if (!props.showEdges || focus) return [];
    return props.fileEdges.flatMap((edge) => {
      const b = bundleOf(edge);
      return b ? [b] : [];
    });
  }, [props.fileEdges, props.showEdges, focus, state, positionOf, bundleStrength]);

  // extraction mode: only the focused paths render, in direction colors
  const focusBundles = useMemo(() => {
    if (!focus) return [];
    return (
      [
        [focus.downstreamEdges, DOWNSTREAM_COLOR],
        [focus.upstreamEdges, UPSTREAM_COLOR],
      ] as const
    ).flatMap(([edges, color]) =>
      edges.flatMap((edge) => {
        const b = bundleOf(edge);
        return b ? [{ ...b, color }] : [];
      }),
    );
  }, [focus, state, positionOf, bundleStrength]);

  const moduleOpacity = (id: string): number =>
    focus && !focus.moduleIds.has(id) ? DIM : 1;
  const fileOpacity = (id: string): number =>
    focus && !focus.fileIds.has(id) ? DIM : 1;
  /** Intermediate districts dim per group when the focus runs at their
   * level, otherwise they follow their module. */
  const groupOpacity = (id: string, top: string): number => {
    if (!focus) return 1;
    if (focus.groupIds) return focus.groupIds.has(id) ? 1 : DIM;
    return moduleOpacity(top);
  };

  const fillOf = (cell: CellResult): string => {
    const changed = props.changedFiles?.get(cell.id);
    if (changed === "added") return ADDED_FILL;
    if (changed === "modified") return MODIFIED_FILL;
    if (cyclicIds.has(cell.id)) return CYCLE_FILL;
    const hue = moduleHue(topAncestorOf(cell.id) ?? "");
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
      <style>{"polygon, path { vector-effect: non-scaling-stroke; }"}</style>
      {/* top-level districts */}
      <g style={{ display: levelVisible(state.levels[0]!.kind) ? "" : "none" }}>
        {[...topCells.values()].map((cell) =>
          cell.polygon.length >= 3 ? (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={`hsl(${moduleHue(cell.id)} 30% 97%)`}
              fill-opacity={moduleOpacity(cell.id)}
              stroke={
                isSelected(cell.id)
                  ? "#1d4ed8"
                  : `hsl(${moduleHue(cell.id)} 45% 55%)`
              }
              stroke-opacity={moduleOpacity(cell.id)}
              stroke-width={isSelected(cell.id) ? 3 : 1.6}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id, event.shiftKey);
              }}
            />
          ) : null,
        )}
      </g>
      {/* intermediate boundary levels (directory districts etc.) */}
      {innerLevels.map((level, i) => (
        <g
          key={`${level.kind}-${i}`}
          fill="none"
          style={{ display: levelVisible(level.kind) ? "" : "none" }}
        >
          {[...level.cells.values()].map((cell) => {
            if (cell.polygon.length < 3) return null;
            const top = topAncestorOf(cell.id) ?? "";
            return (
              <polygon
                key={cell.id}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                stroke={
                  isSelected(cell.id)
                    ? "#1d4ed8"
                    : `hsl(${moduleHue(top)} 35% 62%)`
                }
                stroke-opacity={groupOpacity(cell.id, top)}
                stroke-width={isSelected(cell.id) ? 2.5 : 1}
                stroke-dasharray={isSelected(cell.id) ? undefined : "5 3"}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(cell.id, event.shiftKey);
                }}
              />
            );
          })}
        </g>
      ))}
      {/* file cells */}
      <g style={{ display: leafVisible ? "" : "none" }}>
        {visibleFileCells.map((cell) => (
          <polygon
            key={cell.id}
            points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={fillOf(cell)}
            fill-opacity={fileOpacity(cell.id)}
            stroke={isSelected(cell.id) ? "#1d4ed8" : "#94a3b8"}
            stroke-opacity={fileOpacity(cell.id)}
            stroke-width={isSelected(cell.id) ? 2.5 : 0.6}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(cell.id, event.shiftKey);
            }}
          />
        ))}
      </g>
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
            return (
              <path
                key={`${edge.source} ${edge.target}`}
                d={edge.d}
                stroke={active ? "#c2410c" : "#0891b2"}
                stroke-opacity={active ? 0.9 : selectedId ? 0.08 : 0.22}
                stroke-width={active ? 1.8 : 1}
                style={{ pointerEvents: "none" }}
              />
            );
          })}
        </g>
      ) : null}
      {/* extracted dependency paths, colored by direction */}
      {focus ? (
        <g fill="none">
          {focusBundles.map((edge) => (
            <path
              key={`focus-${edge.source} ${edge.target}`}
              d={edge.d}
              stroke={edge.color}
              stroke-opacity={0.85}
              stroke-width={1.8}
              style={{ pointerEvents: "none" }}
            />
          ))}
        </g>
      ) : null}
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
              fill-opacity={0.85 * moduleOpacity(cell.id)}
            >
              {labelOf(cell.id)}
            </text>
          );
        })}
      </g>
      {/* intermediate labels appear once their district is readable */}
      <g
        text-anchor="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {innerLevels.flatMap((level) =>
          [...level.cells.values()].map((cell) => {
            if (!levelVisible(level.kind)) return null;
            if (cell.polygon.length < 3) return null;
            const px = Math.sqrt(cell.actualArea) * zoom;
            if (px < 80 && !isSelected(cell.id)) return null;
            const top = topAncestorOf(cell.id) ?? "";
            const fontSize = Math.min(
              Math.sqrt(cell.actualArea) * 0.12,
              16 / zoom + 4,
            );
            return (
              <text
                key={cell.id}
                x={cell.site.x}
                y={cell.site.y}
                font-size={fontSize}
                font-weight="600"
                fill={`hsl(${moduleHue(top)} 40% 42%)`}
                fill-opacity={0.7 * groupOpacity(cell.id, top)}
              >
                {props.labels?.get(cell.id) ?? cell.id.split("/").pop()!}
              </text>
            );
          }),
        )}
      </g>
      {/* file labels appear once their cell is readable */}
      <g
        fill="#334155"
        text-anchor="middle"
        style={{
          pointerEvents: "none",
          userSelect: "none",
          display: leafVisible ? "" : "none",
        }}
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
              fill-opacity={fileOpacity(cell.id)}
            >
              {labelOf(cell.id)}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
