import type { AtlasEdge } from "../contracts/graph.js";
import { bundlePath, hierarchyControlPoints } from "../kernel/bundling.js";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import { symbolNameOf } from "./cfgClient.ts";
import type { CfgAnchor } from "./CfgLayer.tsx";
import type { SubdivisionLevel } from "./subdivision.js";
import type { FocusView } from "./useMapViewport.ts";

/**
 * Everything below the top level renders the same way in every map: the
 * top layout (ring circles or treemap districts) is just the shape of the
 * top network, while cell fills, focus dimming, nested districts, and
 * name treatment are shared here. One implementation — rings and treemap
 * drifting apart behaviorally is what this module exists to prevent.
 */

/* ---------------------------------------------------------------- palette */

export const DIM = 0.1;
/** Diff layer: changed files read from fill, not outline. */
export const MODIFIED_FILL = "hsl(8 85% 78%)";
export const ADDED_FILL = "hsl(150 55% 80%)";
/** Cells of nodes caught in a dependency cycle: the tangles to break. */
export const CYCLE_FILL = "hsl(0 70% 86%)";
/** Muted fill for test-layer cells: visible for ratio reading, not loud. */
export const TEST_FILL = "hsl(210 10% 81%)";
/** Direction palette: what I depend on vs what depends on me. */
export const DOWNSTREAM_COLOR = "#ea580c";
export const UPSTREAM_COLOR = "#0891b2";
export const DOWNSTREAM_FILL = "hsl(21 90% 86%)";
export const UPSTREAM_FILL = "hsl(193 70% 86%)";
/** Selection outline everywhere. */
export const SELECT_STROKE = "#1d4ed8";
/** Past this natural screen size a cell's name becomes a translucent
 * watermark behind the detail (symbols, CFG) instead of a foreground
 * label fighting them for attention. */
export const WATERMARK_PX = 200;

/** Stable pastel per top-level group so the borders read as districts. */
export function moduleHue(moduleId: string): number {
  let h = 0;
  for (let i = 0; i < moduleId.length; i++) {
    h = (h * 31 + moduleId.charCodeAt(i)) % 360;
  }
  return h;
}

/* ------------------------------------------------------------- hierarchy */

/** Walk to the top-level ancestor (district / circle) of any id. */
export function makeTopAncestorOf(
  parentOf: ReadonlyMap<string, string | null>,
  isTop: (id: string) => boolean,
): (id: string) => string | null {
  return (id) => {
    let current: string | null = id;
    while (current != null && !isTop(current)) {
      current = parentOf.get(current) ?? null;
    }
    return current;
  };
}

/* ----------------------------------------------------------- focus dim */

export type FocusDim = {
  module: (id: string) => number;
  leaf: (id: string) => number;
  /** Intermediate districts dim per group when the focus runs at their
   * level, otherwise they follow their top-level ancestor. */
  group: (id: string, top: string) => number;
};

export function focusDimOf(focus: FocusView | null): FocusDim {
  if (!focus) {
    return { module: () => 1, leaf: () => 1, group: () => 1 };
  }
  const module = (id: string) => (focus.moduleIds.has(id) ? 1 : DIM);
  return {
    module,
    leaf: (id) => (focus.fileIds.has(id) ? 1 : DIM),
    group: (id, top) =>
      focus.groupIds ? (focus.groupIds.has(id) ? 1 : DIM) : module(top),
  };
}

/* ------------------------------------------------------------ leaf fill */

export type LeafFillContext = {
  changedFiles?: ReadonlyMap<string, "added" | "modified">;
  cyclicIds?: ReadonlySet<string>;
  testFileIds?: ReadonlySet<string>;
  /** Direction tints of the current selection's reference targets. */
  dependencyIds?: ReadonlySet<string>;
  dependentIds?: ReadonlySet<string>;
  topAncestorOf: (id: string) => string | null;
};

/** One fill priority for every map: direction tints > diff > cycles >
 * test layer > the top-level group's pastel tint. */
export function leafFillOf(id: string, ctx: LeafFillContext): string {
  if (ctx.dependencyIds?.has(id)) return DOWNSTREAM_FILL;
  if (ctx.dependentIds?.has(id)) return UPSTREAM_FILL;
  const changed = ctx.changedFiles?.get(id);
  if (changed === "added") return ADDED_FILL;
  if (changed === "modified") return MODIFIED_FILL;
  if (ctx.cyclicIds?.has(id)) return CYCLE_FILL;
  if (ctx.testFileIds?.has(id)) return TEST_FILL;
  return `hsl(${moduleHue(ctx.topAncestorOf(id) ?? "")} 25% 94%)`;
}

/* -------------------------------------------------- intermediate levels */

export function InnerLevelsLayer(props: {
  levels: readonly SubdivisionLevel[];
  topAncestorOf: (id: string) => string | null;
  isSelected: (id: string) => boolean;
  onSelect: (id: string, additive?: boolean) => void;
  dim: FocusDim;
  zoom: number;
  labels?: Map<string, string>;
  visibleLevels?: ReadonlySet<string>;
}) {
  const { levels, topAncestorOf, isSelected, onSelect, dim, zoom } = props;
  const visible = (kind: string) => props.visibleLevels?.has(kind) ?? true;
  return (
    <>
      {levels.map((level, i) => (
        <g
          key={`${level.kind}-${i}`}
          fill="none"
          style={{ display: visible(level.kind) ? "" : "none" }}
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
                    ? SELECT_STROKE
                    : `hsl(${moduleHue(top)} 35% 62%)`
                }
                stroke-opacity={dim.group(cell.id, top)}
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
      {/* district labels appear once their region is readable */}
      <g
        text-anchor="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {levels.flatMap((level) =>
          [...level.cells.values()].map((cell) => {
            if (!visible(level.kind)) return null;
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
                fill-opacity={0.7 * dim.group(cell.id, top)}
              >
                {props.labels?.get(cell.id) ?? cell.id.split("/").pop()!}
              </text>
            );
          }),
        )}
      </g>
    </>
  );
}

/* ------------------------------------------------------------ watermark */

/** Names of cells whose natural label size crossed WATERMARK_PX: drawn
 * centered, translucent, BENEATH the detail layers. Pair with a
 * foreground label layer that yields past the same threshold. */
export function WatermarkLabelsLayer(props: {
  cells: readonly CellResult[];
  zoom: number;
  labelOf: (id: string) => string;
  dim: FocusDim;
}) {
  const { cells, zoom, labelOf, dim } = props;
  return (
    <g
      text-anchor="middle"
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {cells.map((cell) => {
        const fontSize = Math.sqrt(cell.actualArea) * 0.18;
        if (fontSize * zoom < WATERMARK_PX) return null;
        return (
          <text
            key={cell.id}
            x={cell.site.x}
            y={cell.site.y + fontSize * 0.35}
            font-size={fontSize}
            font-weight="600"
            fill="#334155"
            opacity={0.12 * dim.leaf(cell.id)}
          >
            {labelOf(cell.id)}
          </text>
        );
      })}
    </g>
  );
}

/** Natural label size gate shared by watermark and foreground layers. */
export function isWatermarkSized(cell: CellResult, zoom: number): boolean {
  return Math.sqrt(cell.actualArea) * 0.18 * zoom >= WATERMARK_PX;
}

/* ---------------------------------------------------- selection directions */

export type SelectionDirections = {
  /** Reference edges leaving the selection (what it depends on). */
  outgoing: AtlasEdge[];
  /** Reference edges entering the selection (what depends on it). */
  incoming: AtlasEdge[];
  /** Endpoint ids tinted in the matching direction color. */
  dependencyIds: Set<string>;
  dependentIds: Set<string>;
};

/**
 * Direction split of the reference edges around the current selection —
 * what the selection depends on (downstream) vs what depends on it
 * (upstream). An endpoint belongs to the selection directly or via its
 * parent file (raw symbol references carry symbol ids; a selected file
 * owns them).
 */
export function selectionDirections(options: {
  edges: readonly AtlasEdge[];
  isSelected: (id: string) => boolean;
  /** Symbol id → owning file id; defaults to identity. */
  parentFileOf?: (id: string) => string;
}): SelectionDirections {
  const { edges, isSelected } = options;
  const parentFileOf = options.parentFileOf ?? ((id: string) => id);
  const touches = (id: string) => isSelected(id) || isSelected(parentFileOf(id));
  const outgoing = edges.filter(
    (e) => touches(e.source) && !touches(e.target),
  );
  const incoming = edges.filter(
    (e) => touches(e.target) && !touches(e.source),
  );
  const dependencyIds = new Set<string>();
  for (const edge of outgoing) {
    if (isSelected(edge.target)) continue;
    dependencyIds.add(edge.target);
    // symbol endpoints tint their parent file's cell as well
    dependencyIds.add(parentFileOf(edge.target));
  }
  const dependentIds = new Set<string>();
  for (const edge of incoming) {
    if (isSelected(edge.source)) continue;
    dependentIds.add(edge.source);
    dependentIds.add(parentFileOf(edge.source));
  }
  return { outgoing, incoming, dependencyIds, dependentIds };
}

/* ----------------------------------------------------------- edge bundles */

/** Catmull-Rom through the control points as a cubic-Bézier SVG path. */
export function smoothPathD(points: readonly Vec2[]): string {
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

export type EdgeBundle = {
  source: string;
  target: string;
  d: string;
  /** Straight-line endpoint distance, for screen-size culling. */
  chord: number;
};

/**
 * Hierarchical edge bundling shared by every map: control points run
 * through the parent chain to the LCA, β-straightened. Endpoints re-anchor
 * onto displayed CFGs (incoming at the entry, outgoing at the calling
 * step). Falls back to a straight chord when an endpoint has no hierarchy
 * (ports, raw symbols) but both positions are known.
 */
export function makeEdgeBundler(options: {
  parentOf: ReadonlyMap<string, string | null>;
  positionOf: ReadonlyMap<string, Vec2>;
  strength?: number;
  cfgAnchors?: ReadonlyMap<string, CfgAnchor>;
}): (edge: AtlasEdge) => EdgeBundle | null {
  const strength = options.strength ?? 0.85;
  return (edge) => {
    let path = hierarchyControlPoints(
      edge.source,
      edge.target,
      options.parentOf,
      options.positionOf,
    );
    if (!path) {
      const a = options.positionOf.get(edge.source);
      const b = options.positionOf.get(edge.target);
      if (!a || !b) return null;
      path = [{ ...a }, { ...b }];
    }
    const sourceCfg = options.cfgAnchors?.get(edge.source);
    if (sourceCfg) {
      const name = symbolNameOf(edge.target);
      const anchor = name ? sourceCfg.calls.get(name) : undefined;
      if (anchor) path[0] = anchor;
    }
    const targetCfg = options.cfgAnchors?.get(edge.target);
    if (targetCfg) path[path.length - 1] = targetCfg.entry;
    const first = path[0]!;
    const last = path[path.length - 1]!;
    return {
      source: edge.source,
      target: edge.target,
      d: smoothPathD(bundlePath(path, strength)),
      chord: Math.hypot(last.x - first.x, last.y - first.y),
    };
  };
}
