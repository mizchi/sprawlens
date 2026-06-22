import type { VNode } from "preact";
import { useState } from "preact/hooks";
import type { AtlasEdge } from "@sprawlens/schema";
import { bundlePath, hierarchyControlPoints } from "@sprawlens/layout";
import type { CellResult } from "@sprawlens/layout";
import type { Vec2 } from "@sprawlens/layout";
import {
  apply,
  toMatrixString,
  uprightAt,
  type Affine,
} from "@sprawlens/layout";
import type { PlacedNode } from "./planeLayers.js";
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

/* ---------------------------------------------------------------- palette
 * Theme tokens are `let` exports: ESM live bindings let setMapTheme swap
 * the whole palette in place while every import site keeps its name. */

export const DIM = 0.1;
/** Diff layer: changed files read from fill, not outline. */
let MODIFIED_FILL = "hsl(8 85% 78%)";
let ADDED_FILL = "hsl(150 55% 80%)";
/** Cells of nodes caught in a dependency cycle: the tangles to break. */
let CYCLE_FILL = "hsl(0 70% 86%)";
/** Muted fill for test-layer cells: visible for ratio reading, not loud. */
let TEST_FILL = "hsl(210 10% 81%)";
/** Direction palette: what I depend on vs what depends on me. */
export let DOWNSTREAM_COLOR = "#ea580c";
export let UPSTREAM_COLOR = "#0891b2";
export let DOWNSTREAM_FILL = "hsl(21 90% 86%)";
export let UPSTREAM_FILL = "hsl(193 70% 86%)";
/** Selection outline everywhere. */
export let SELECT_STROKE = "#1d4ed8";
/** Outline for nodes referenced by a (cross-layer) edge — warm, so it reads
 * apart from the blue selection. */
export let LINKED_STROKE = "#d97706";
/** SVG strata inks and chrome, theme-switched. */
export let LEAF_STROKE = "#94a3b8";
export let SYMBOL_STROKE = "#64748b";
export let SYMBOL_EDGE = "#7c3aed";
export let MACRO_EDGE = "#475569";
export let ACTIVE_EDGE = "#c2410c";
export let CIRCLE_FILL = "#eef2f7";
export let CIRCLE_STROKE = "#334155";
export let CIRCLE_CYCLE_FILL = "hsl(0 65% 92%)";
export let MODULE_LABEL_INK = "#0f172a";
export let FILE_LABEL_INK = "#334155";
export let TEST_LABEL_INK = "#10b981";
/** Deps plane tint (external packages); distinct from the test grey. */
export let DEPS_INK = "#22d3ee";
/** Test reporter cell fill by status (pass green / fail red / skip grey). */
export const TEST_STATUS_FILL: Record<string, string> = {
  pass: "#16a34a",
  fail: "#dc2626",
  skip: "#94a3b8",
  todo: "#d97706",
};
let WATERMARK_INK = "#334155";
export let PORT_FILL = "#ffffff";
/** Per-kind ink for the symbol classification icons, so each kind reads at a
 * glance (à la an editor's outline). Theme-switched below. Keyed by the
 * SymbolGlyph strings from symbolIcons.ts. */
export let SYMBOL_KIND_COLORS: Record<string, string> = {
  function: "#334155", // neutral: the common case recedes, kinds pop
  component: "#0d9488",
  class: "#d97706",
  variable: "#2563eb",
  type: "#db2777",
  interface: "#0891b2",
  enum: "#4d7c0f",
  method: "#16a34a", // class members get their own hue, distinct from fns
  property: "#ea580c",
};
/** Per-kind ink for the terraform service-layer communication edges, so the
 * upper service plane reads with the same palette discipline as the code map.
 * Keyed by ServiceEdge["kind"]. Theme-switched below. */
export let SERVICE_EDGE_COLORS: Record<string, string> = {
  depends: "#64748b",
  invoke: "#ea580c",
  queue: "#0891b2",
  event: "#7c3aed",
  http: "#16a34a",
};
/** Accent for the service layer's external stores (S3, DynamoDB, …) — their
 * node outline and the "uses" edges into them. Theme-switched below. */
export let SERVICE_STORE_COLOR = "#d97706";
/** Strong outline for class-boundary districts (request: easy to spot). */
let CLASS_BOUNDARY = "#d97706";
export let EXPORTED_DOT = "#059669";
/** Panel / page chrome, consumed by the App shell. */
export let PAGE_BG = "#e2e8f0";
export let MAP_BG = "#f8fafc";
export let PANEL_BG = "rgba(248, 250, 252, 0.92)";
export let PANEL_BORDER = "#cbd5e1";
export let INK = "#0f172a";
export let MUTED_INK = "#64748b";
/** District hue lightness profile (top fill/stroke, inner stroke, labels,
 * leaf tint), switched together with the rest of the theme. */
let hueProfile = {
  topFill: "30% 97%",
  topStroke: "45% 55%",
  topLabel: "50% 32%",
  innerStroke: "35% 62%",
  innerLabel: "40% 42%",
  leafTint: "25% 94%",
};
export const districtFill = (id: string) =>
  `hsl(${moduleHue(id)} ${hueProfile.topFill})`;
export const districtStroke = (id: string) =>
  `hsl(${moduleHue(id)} ${hueProfile.topStroke})`;
export const districtLabelFill = (id: string) =>
  `hsl(${moduleHue(id)} ${hueProfile.topLabel})`;
const innerDistrictStroke = (id: string) =>
  `hsl(${moduleHue(id)} ${hueProfile.innerStroke})`;
const innerDistrictLabelFill = (id: string) =>
  `hsl(${moduleHue(id)} ${hueProfile.innerLabel})`;
const leafTint = (id: string) =>
  `hsl(${moduleHue(id)} ${hueProfile.leafTint})`;

export function setMapTheme(dark: boolean): void {
  if (dark) {
    MODIFIED_FILL = "hsl(8 65% 32%)";
    ADDED_FILL = "hsl(150 45% 25%)";
    CYCLE_FILL = "hsl(0 50% 27%)";
    TEST_FILL = "hsl(210 10% 26%)";
    DOWNSTREAM_COLOR = "#fb923c";
    UPSTREAM_COLOR = "#22d3ee";
    DOWNSTREAM_FILL = "hsl(21 65% 28%)";
    UPSTREAM_FILL = "hsl(193 55% 26%)";
    SELECT_STROKE = "#60a5fa";
    LINKED_STROKE = "#fbbf24";
    LEAF_STROKE = "#475569";
    SYMBOL_STROKE = "#64748b";
    SYMBOL_EDGE = "#a78bfa";
    MACRO_EDGE = "#94a3b8";
    ACTIVE_EDGE = "#f97316";
    CIRCLE_FILL = "#1e293b";
    CIRCLE_STROKE = "#94a3b8";
    CIRCLE_CYCLE_FILL = "hsl(0 45% 20%)";
    MODULE_LABEL_INK = "#f1f5f9";
    FILE_LABEL_INK = "#cbd5e1";
    TEST_LABEL_INK = "#34d399";
    DEPS_INK = "#22d3ee";
    WATERMARK_INK = "#cbd5e1";
    PORT_FILL = "#0f172a";
    SYMBOL_KIND_COLORS = {
      function: "#e2e8f0", // near-white: readable default on the dark map
      component: "#2dd4bf",
      class: "#fbbf24",
      variable: "#93c5fd",
      type: "#f9a8d4",
      interface: "#67e8f9",
      enum: "#bef264",
      method: "#86efac", // members: green, clearly not a plain function
      property: "#fdba74",
    };
    SERVICE_EDGE_COLORS = {
      depends: "#94a3b8",
      invoke: "#fb923c",
      queue: "#22d3ee",
      event: "#a78bfa",
      http: "#4ade80",
    };
    SERVICE_STORE_COLOR = "#fbbf24";
    CLASS_BOUNDARY = "#fbbf24";
    EXPORTED_DOT = "#34d399";
    EXPORTED_LABEL = "#34d399";
    INTERNAL_LABEL = "#c4b5fd";
    PAGE_BG = "#0b1120";
    MAP_BG = "#111827";
    PANEL_BG = "rgba(15, 23, 42, 0.92)";
    PANEL_BORDER = "#334155";
    INK = "#e2e8f0";
    MUTED_INK = "#94a3b8";
    hueProfile = {
      topFill: "35% 10%",
      topStroke: "50% 45%",
      topLabel: "55% 70%",
      innerStroke: "40% 50%",
      innerLabel: "45% 65%",
      leafTint: "30% 16%",
    };
  } else {
    MODIFIED_FILL = "hsl(8 85% 78%)";
    ADDED_FILL = "hsl(150 55% 80%)";
    CYCLE_FILL = "hsl(0 70% 86%)";
    TEST_FILL = "hsl(210 10% 81%)";
    DOWNSTREAM_COLOR = "#ea580c";
    UPSTREAM_COLOR = "#0891b2";
    DOWNSTREAM_FILL = "hsl(21 90% 86%)";
    UPSTREAM_FILL = "hsl(193 70% 86%)";
    SELECT_STROKE = "#1d4ed8";
    LINKED_STROKE = "#d97706";
    LEAF_STROKE = "#64748b";
    SYMBOL_STROKE = "#475569";
    SYMBOL_EDGE = "#7c3aed";
    MACRO_EDGE = "#475569";
    ACTIVE_EDGE = "#c2410c";
    CIRCLE_FILL = "#eef2f7";
    CIRCLE_STROKE = "#334155";
    CIRCLE_CYCLE_FILL = "hsl(0 65% 92%)";
    SYMBOL_KIND_COLORS = {
      function: "#334155",
      component: "#0d9488",
      class: "#d97706",
      variable: "#2563eb",
      type: "#db2777",
      interface: "#0891b2",
      enum: "#4d7c0f",
      method: "#16a34a",
      property: "#ea580c",
    };
    SERVICE_EDGE_COLORS = {
      depends: "#64748b",
      invoke: "#ea580c",
      queue: "#0891b2",
      event: "#7c3aed",
      http: "#16a34a",
    };
    SERVICE_STORE_COLOR = "#d97706";
    CLASS_BOUNDARY = "#d97706";
    MODULE_LABEL_INK = "#0f172a";
    FILE_LABEL_INK = "#334155";
    TEST_LABEL_INK = "#059669";
    DEPS_INK = "#0891b2";
    WATERMARK_INK = "#334155";
    PORT_FILL = "#ffffff";
    EXPORTED_DOT = "#059669";
    EXPORTED_LABEL = "#047857";
    INTERNAL_LABEL = "#5b21b6";
    PAGE_BG = "#e2e8f0";
    MAP_BG = "#f8fafc";
    PANEL_BG = "rgba(248, 250, 252, 0.92)";
    PANEL_BORDER = "#cbd5e1";
    INK = "#0f172a";
    MUTED_INK = "#64748b";
    hueProfile = {
      topFill: "30% 97%",
      topStroke: "45% 55%",
      topLabel: "50% 32%",
      innerStroke: "35% 62%",
      innerLabel: "40% 42%",
      leafTint: "25% 94%",
    };
  }
}

/** Past this natural screen size a cell's name becomes a translucent
 * watermark behind the detail (symbols, CFG) instead of a foreground
 * label fighting them for attention. */
const WATERMARK_PX = 140;

/** On-screen px below which a boundary cell's outline is suppressed: the
 * fill texture still reads at macro zoom, but drawing every leaf/district
 * border there is noise (and overdraw). The border fades in as the cell
 * grows past this on screen. Districts use a larger gate than leaves. */
export const LEAF_BORDER_MIN_PX = 8;
const DISTRICT_BORDER_MIN_PX = 44;
/** Class boundaries are deferred far past other districts: only a deep zoom
 * into the class shows the outline, so the overview isn't carved into class
 * regions. */
const CLASS_BORDER_MIN_PX = 170;

/** Zoom level at which individual symbols become interactive nodes. */
export const SYMBOL_ZOOM = 2.2;
/** A symbol's name appears once its cell fills this share of the
 * viewport's short side (selected/linked symbols are exempt). */
export const SYMBOL_DOMINANT_FRACTION = 0.35;
/** Exported-symbol label color vs internal symbols. */
export let EXPORTED_LABEL = "#047857";
export let INTERNAL_LABEL = "#5b21b6";

/** Stable pastel per top-level group so the borders read as districts. */
function moduleHue(moduleId: string): number {
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
  symbol: (id: string) => number;
  /** Intermediate districts dim per group when the focus runs at their
   * level, otherwise they follow their top-level ancestor. */
  group: (id: string, top: string) => number;
};

export function focusDimOf(focus: FocusView | null): FocusDim {
  if (!focus) {
    return { module: () => 1, leaf: () => 1, symbol: () => 1, group: () => 1 };
  }
  const module = (id: string) => (focus.moduleIds.has(id) ? 1 : DIM);
  return {
    module,
    leaf: (id) => (focus.fileIds.has(id) ? 1 : DIM),
    symbol: (id) => (focus.symbolIds.has(id) ? 1 : DIM),
    group: (id, top) =>
      focus.groupIds ? (focus.groupIds.has(id) ? 1 : DIM) : module(top),
  };
}

/* ------------------------------------------------------------ leaf fill */

export type LeafFillContext = {
  /** Diff kind for this leaf (file or symbol), resolving symbol→file inherit. */
  changedOf?: (id: string) => "added" | "modified" | undefined;
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
  const changed = ctx.changedOf?.(id);
  if (changed === "added") return ADDED_FILL;
  if (changed === "modified") return MODIFIED_FILL;
  if (ctx.cyclicIds?.has(id)) return CYCLE_FILL;
  if (ctx.testFileIds?.has(id)) return TEST_FILL;
  return leafTint(ctx.topAncestorOf(id) ?? "");
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
  /** Active plane tilt; district labels stay upright on the plane. */
  tilt?: Affine;
  /** Slider-tunable label sizing: 9px baseline factor + font multiplier. */
  labelMinPx?: number;
  labelScale?: number;
}) {
  const labelFactor = (props.labelMinPx ?? 9) / 9;
  const labelScale = props.labelScale ?? 1;
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
            // real class districts (a `class:` group, not a singleton wrapping
            // one non-class symbol) read as a strong solid outline; singleton
            // class-level groups draw nothing, other levels stay faint+dashed
            const isClass =
              level.kind === "class" && cell.id.startsWith("class:");
            if (level.kind === "class" && !isClass) return null;
            // zoom-gate: a district outline only draws once its cell is big
            // enough on screen — macro views stay free of nested borders.
            // class boundaries are deferred until you zoom right in, so they
            // don't dominate the overview as filled regions
            const gate = isClass
              ? CLASS_BORDER_MIN_PX
              : DISTRICT_BORDER_MIN_PX;
            if (
              !isSelected(cell.id) &&
              Math.sqrt(cell.actualArea) * zoom < gate
            ) {
              return null;
            }
            const top = topAncestorOf(cell.id) ?? "";
            return (
              <polygon
                key={cell.id}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={
                  isSelected(cell.id)
                    ? SELECT_STROKE
                    : isClass
                      ? CLASS_BOUNDARY
                      : innerDistrictStroke(top)
                }
                stroke-opacity={
                  isClass ? Math.max(0.9, dim.group(cell.id, top)) : dim.group(cell.id, top)
                }
                stroke-width={isSelected(cell.id) ? 2.5 : isClass ? 3 : 1}
                stroke-dasharray={
                  isSelected(cell.id) || isClass ? undefined : "5 3"
                }
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
            // only real class groups carry a class label (skip singletons)
            const isClassGroup = cell.id.startsWith("class:");
            if (level.kind === "class" && !isClassGroup) return null;
            const px = Math.sqrt(cell.actualArea) * zoom;
            // class labels track their (deep-zoom) outline; others at 80px
            const labelGate =
              (isClassGroup ? CLASS_BORDER_MIN_PX : 80) * labelFactor;
            if (px < labelGate && !isSelected(cell.id)) return null;
            const top = topAncestorOf(cell.id) ?? "";
            const fontSize =
              Math.min(Math.sqrt(cell.actualArea) * 0.12, 16 / zoom + 4) * labelScale;
            // honour the user's minimum drawn size: drop labels smaller than it
            if (fontSize * zoom < (props.labelMinPx ?? 9) && !isSelected(cell.id))
              return null;
            const label =
              props.labels?.get(cell.id) ??
              (isClassGroup
                ? cell.id.slice(cell.id.lastIndexOf(":") + 1)
                : cell.id.split("/").pop()!);
            return (
              <text
                key={cell.id}
                transform={uprightAt(props.tilt, cell.site)}
                font-size={fontSize}
                font-weight="600"
                fill={isClassGroup ? CLASS_BOUNDARY : innerDistrictLabelFill(top)}
                fill-opacity={0.7 * dim.group(cell.id, top)}
              >
                {label}
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
  /** Committed viewport: the name slides along inside its cell so it
   * stays on screen while the camera is inside the cell. */
  view?: { x: number; y: number; w: number; h: number };
  /** Active plane tilt; watermarks stay upright on the plane. */
  tilt?: Affine;
}) {
  const { cells, zoom, labelOf, dim, view } = props;
  return (
    <g
      text-anchor="middle"
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {cells.map((cell) => {
        const natural = Math.sqrt(cell.actualArea) * 0.18;
        const onScreen = natural * zoom;
        if (onScreen < WATERMARK_PX) return null;
        // the watermark rides in front of the symbols (so the file/module name
        // is never buried), so it must fade as you zoom in or it would block
        // what you came to read: prominent the moment it appears, thinning to a
        // faint wash the deeper the cell fills the screen
        const fade = Math.max(0.08, Math.min(0.4, (WATERMARK_PX * 2) / onScreen));
        // deep inside a cell, a centroid-anchored giant name leaves the
        // screen entirely — cap the size to the viewport and clamp the
        // anchor into the visible part of the cell
        const fontSize = view ? Math.min(natural, view.w * 0.09) : natural;
        let x = cell.site.x;
        let y = cell.site.y + fontSize * 0.35;
        if (view) {
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          for (const p of cell.polygon) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
          }
          const padX = fontSize * 2;
          const padY = fontSize;
          const lo = (a: number, b: number) => Math.max(a, b);
          const hi = (a: number, b: number) => Math.min(a, b);
          const x0 = lo(minX + padX, view.x + padX);
          const x1 = hi(maxX - padX, view.x + view.w - padX);
          const y0 = lo(minY + padY, view.y + padY);
          const y1 = hi(maxY - padY, view.y + view.h - padY);
          if (x0 <= x1) x = Math.min(Math.max(x, x0), x1);
          if (y0 <= y1) y = Math.min(Math.max(y, y0), y1);
        }
        return (
          <text
            key={cell.id}
            transform={uprightAt(props.tilt, { x, y })}
            font-size={fontSize}
            font-weight="600"
            fill={WATERMARK_INK}
            opacity={fade * dim.leaf(cell.id)}
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

/* --------------------------------------------------------- exit previews */

type ExitPreview = {
  id: string;
  x: number;
  y: number;
  side: "left" | "right" | "top" | "bottom";
};

/**
 * Names of reference targets that left the screen, docked where their
 * edge crosses the viewport border. Clicking one selects the target.
 */
export function ExitPreviewsLayer(props: {
  edges: readonly AtlasEdge[];
  color: string;
  view: { x: number; y: number; w: number; h: number };
  endpointsOf: (edge: AtlasEdge) => [Vec2, Vec2] | null;
  labelOf: (id: string) => string;
  onSelect: (id: string, additive?: boolean) => void;
  /** Clicking a docked name flies the camera to that off-screen target;
   * falls back to plain selection when not provided. */
  onFocus?: (id: string) => void;
  zoom: number;
  /** Active plane tilt; docked names stay upright on the plane. */
  tilt?: Affine;
}) {
  const { view, zoom, labelOf, onSelect } = props;
  const onFocus = props.onFocus;
  const x0 = view.x;
  const x1 = view.x + view.w;
  const y0 = view.y;
  const y1 = view.y + view.h;
  const inside = (p: Vec2) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  const seen = new Set<string>();
  const previews: ExitPreview[] = [];
  for (const edge of props.edges) {
    const ends = props.endpointsOf(edge);
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
    previews.push({ id: farId, x: near.x + dx * t, y: near.y + dy * t, side });
  }
  if (previews.length === 0) return null;
  const fontSize = 10.5 / zoom;
  return (
    <g style={{ userSelect: "none" }}>
      {previews.map((preview) => (
        <text
          key={preview.id}
          transform={uprightAt(props.tilt, {
            x:
              preview.side === "left"
                ? preview.x + fontSize * 0.5
                : preview.side === "right"
                  ? preview.x - fontSize * 0.5
                  : preview.x,
            y:
              preview.side === "top"
                ? preview.y + fontSize * 1.3
                : preview.side === "bottom"
                  ? preview.y - fontSize * 0.5
                  : preview.y + fontSize * 0.35,
          })}
          font-size={fontSize}
          font-weight="600"
          text-anchor={
            preview.side === "left"
              ? "start"
              : preview.side === "right"
                ? "end"
                : "middle"
          }
          fill={props.color}
          stroke="#f8fafc"
          stroke-width={3 / zoom}
          paint-order="stroke"
          style={{ cursor: "pointer" }}
          onClick={(event) => {
            event.stopPropagation();
            if (onFocus) onFocus(preview.id);
            else onSelect(preview.id, event.shiftKey);
          }}
        >
          {labelOf(preview.id)}
        </text>
      ))}
    </g>
  );
}

/* -------------------------------------------------------- satellite plane */

/** Stroke for the faint stacked-plane outlines. */
let PLANE_OUTLINE = "#475569";

const planePolyOf = (m: Affine, w: number, h: number) =>
  [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]
    .map((p) => apply(m, p))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

/**
 * Resolve which nodes a hover/selection lights and in what colour, following
 * the cross-layer edges transitively: hovering a deps package walks deps →
 * tests → source, tinting each hop in the colour of the edge that reached it,
 * so the highlight flows all the way up the stack (plus one reverse hop, so
 * hovering a target lights what imports it). Returns id → tint colour.
 */
export function propagateLinkTints(
  layers: readonly {
    id: string;
    placed: readonly { id: string; sourceIds: readonly string[] }[];
  }[],
  opts: {
    hover: string | null;
    pinned: ReadonlySet<string>;
    all: boolean;
    tintFor: (layerId: string) => string;
  },
): Map<string, string> {
  const out = new Map<string, { to: string; color: string }[]>();
  const into = new Map<string, { from: string; color: string }[]>();
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };
  for (const layer of layers) {
    const color = opts.tintFor(layer.id);
    for (const n of layer.placed)
      for (const sid of n.sourceIds) {
        push(out, n.id, { to: sid, color });
        push(into, sid, { from: n.id, color });
      }
  }
  const seeds: string[] = [];
  if (opts.all) {
    for (const layer of layers) for (const n of layer.placed) seeds.push(n.id);
  } else {
    if (opts.hover) seeds.push(opts.hover);
    for (const id of opts.pinned) seeds.push(id);
  }
  const tint = new Map<string, string>();
  // forward transitively: a node lights everything it (transitively) imports
  const seen = new Set<string>();
  const queue = [...seeds];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of out.get(id) ?? []) {
      if (!tint.has(e.to)) tint.set(e.to, e.color);
      queue.push(e.to);
    }
  }
  // one reverse hop: hovering a target lights the nodes that import it
  for (const seed of seeds)
    for (const e of into.get(seed) ?? [])
      if (!tint.has(e.from)) tint.set(e.from, e.color);
  return tint;
}

/**
 * A stacked plane below the source map (Tests, Deps, ...). Its nodes are
 * already laid out by a `PlaneLayout` strategy (capacity Voronoi, rings, ...)
 * in the plane's own coordinates; this view tilts that geometry onto `tilt1`,
 * keeps the labels upright via `uprightAt`, and draws correspondence lines from
 * each node up to its related source files on the `tilt0` plane.
 */
export function PlaneLayerView(props: {
  tilt0: Affine;
  tilt1: Affine;
  /** World extent of the map viewport, for the plane outline. */
  extent: { w: number; h: number };
  /** Resolve any node id (source file, test, dep, ...) to its screen point on
   * whichever plane owns it. Lets a dep edge land on the tests plane (vitest →
   * its test importers) instead of being dropped for not being a source file. */
  screenPosOf: (id: string) => Vec2 | undefined;
  /** Ids that are an endpoint of some cross-layer edge — highlighted as the
   * nodes worth reading out of the hairball. */
  referencedIds?: Set<string>;
  placed: readonly PlacedNode[];
  /** Intermediate boundary (e.g. module) outlines for this plane's layout. */
  districts?: readonly (readonly Vec2[])[];
  /** Cell stroke / label / line tint. */
  color: string;
  /** Also draw the source-plane frame (only one layer need do this). */
  withSourceFrame?: boolean;
  /** Cap correspondence lines per node so popular packages don't hairball. */
  edgeCap?: number;
  zoom: number;
  onSelect: (id: string, additive?: boolean) => void;
  /** Click a correspondence line → select + jump to that source node. */
  onLinkSelect?: (sourceId: string, additive?: boolean) => void;
  selectedId?: string | null;
  /** Show every cross-layer edge (alt held); otherwise only the hovered node's.
   */
  altEdges?: boolean;
  /** Cross-plane hovered id (a node on any plane); its edges show. */
  hoverId?: string | null;
  /** Report this plane's node hover up so other planes can light their links. */
  onHover?: (id: string | null) => void;
  /** Endpoints whose edges stay shown even without hover — the selection (node
   * ids and their files), so picking a node keeps its links up. */
  pinnedIds?: Set<string>;
  /** Node id → tint for nodes a currently-shown edge points at; fills the cell
   * region in the connecting edge's colour. */
  tintOf?: (id: string) => string | undefined;
  /** Node id → a status fill colour (test reporter: pass/fail/skip), applied to
   * the cell when no live edge tint is overriding it. */
  statusFillOf?: (id: string) => string | undefined;
  /** Node id → a short label suffix (test reporter: duration), appended after
   * the cell's name. */
  labelSuffixOf?: (id: string) => string | undefined;
  /** Double-click a cell → run it (test reporter: run just that case). */
  onRunCell?: (id: string) => void;
  /** A link highlight is active somewhere: dim this plane's untouched nodes so
   * the tinted ones lead, and let the "referenced" cue yield to the tint. */
  linksActive?: boolean;
}) {
  const { tilt0, tilt1, extent, screenPosOf, placed, color, zoom } = props;
  const referencedIds = props.referencedIds;
  const edgeCap = props.edgeCap ?? 16;
  const tilt1Matrix = toMatrixString(tilt1);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverId = props.hoverId ?? hovered;
  // a node's world size (cell extent / circle diameter); labels gate on it the
  // same way the source map does, so big cells get a name without hovering
  const sizeOf = (d: PlacedNode): number => {
    if (d.r !== undefined) return d.r * 2;
    if (!d.polygon) return 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of d.polygon) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return Math.max(maxX - minX, maxY - minY);
  };
  // label budget grows with zoom: few names when zoomed out, more as cells
  // enlarge. The biggest cells win the budget; hover/selection always show.
  const LABELS_PER_ZOOM = 7;
  const LABEL_MIN_PX = 26;
  const labelledNodes = (() => {
    const eligible = placed
      .filter((d) => sizeOf(d) * zoom >= LABEL_MIN_PX)
      .sort((a, b) => sizeOf(b) - sizeOf(a));
    const budget = Math.max(2, Math.round(zoom * LABELS_PER_ZOOM));
    const shown = new Map(eligible.slice(0, budget).map((d) => [d.id, d]));
    for (const d of placed)
      if (d.id === hovered || d.id === props.selectedId) shown.set(d.id, d);
    return [...shown.values()];
  })();
  return (
    <>
      {/* plane frames */}
      <g fill="none" stroke={PLANE_OUTLINE} style={{ pointerEvents: "none" }}>
        {props.withSourceFrame ? (
          <polygon points={planePolyOf(tilt0, extent.w, extent.h)} stroke-opacity={0.3} stroke-width={1.5} />
        ) : null}
        <polygon points={planePolyOf(tilt1, extent.w, extent.h)} stroke-opacity={0.5} stroke-width={1.5} />
      </g>
      {/* correspondence: each node's references (top, on whichever plane owns
          them) fan up from the node (bottom). Every leg stays its own strand
          but is pulled through a shared waist toward the targets' centroid, so
          edges of one node read as a gathered rope that splays at the ends —
          drawn together, not collapsed into a single line. Hidden until you
          hover an endpoint (its rope lights up) or hold alt (all of them).
          Clicking a strand selects + jumps to that target. */}
      <g fill="none" stroke={color}>
        {(props.altEdges || hoverId != null || (props.pinnedIds?.size ?? 0) > 0
          ? placed
          : []
        ).flatMap((d) => {
          const bot = apply(tilt1, d.site);
          const pinned = props.pinnedIds;
          const nodeHot = hoverId === d.id || (pinned?.has(d.id) ?? false);
          const active = nodeHot || d.id === props.selectedId;
          // a node reached by the highlight chain (it carries a tint) also draws
          // its onward edges, so the rope runs the full deps→tests→source path
          // instead of stopping one hop from the hovered node
          const chained = props.tintOf?.(d.id) !== undefined;
          const showAll = props.altEdges || nodeHot || chained;
          const tops = d.sourceIds
            .map((s) => [s, screenPosOf(s)] as const)
            .filter((v): v is readonly [string, Vec2] => !!v[1])
            .filter(
              ([sid]) => showAll || hoverId === sid || (pinned?.has(sid) ?? false),
            )
            .slice(0, edgeCap);
          if (tops.length === 0) return [];
          // pull point = part-way from the node toward its targets' centroid;
          // every strand bends toward it (gathered) but keeps its own ends
          const cx = tops.reduce((s, [, p]) => s + p.x, 0) / tops.length;
          const cy = tops.reduce((s, [, p]) => s + p.y, 0) / tops.length;
          const gather = { x: bot.x + (cx - bot.x) * 0.5, y: bot.y + (cy - bot.y) * 0.5 };
          // a specifically-hovered rope reads bold; the alt-held everything view
          // stays faint so it's legible as a field
          const sw = active ? 1.4 : 0.9;
          const so = active ? 0.85 : props.altEdges ? 0.2 : 0.5;
          const out: VNode[] = [];
          for (let i = 0; i < tops.length; i++) {
            const [sid, top] = tops[i]!;
            // nudge the shared gather a little toward this target: strands sit
            // close together through the middle but never collapse to one point
            const via = {
              x: gather.x + (top.x - gather.x) * 0.15,
              y: gather.y + (top.y - gather.y) * 0.15,
            };
            const path =
              tops.length > 1
                ? smoothPathD([bot, via, top])
                : smoothPathD([bot, top]);
            const key = `${d.id}:${i}`;
            out.push(
              <path
                key={key}
                d={path}
                stroke-width={sw}
                stroke-opacity={so}
                style={{ pointerEvents: "none" }}
              />,
              <path
                key={`${key}-hit`}
                d={path}
                stroke="transparent"
                stroke-width={8 / zoom}
                style={{ cursor: "pointer" }}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onLinkSelect?.(sid, event.shiftKey);
                }}
              />,
            );
          }
          return out;
        })}
      </g>
      {/* district outlines, tilted with the plane */}
      <g transform={tilt1Matrix} fill="none" style={{ pointerEvents: "none" }}>
        {(props.districts ?? []).map((poly, i) => (
          <polygon
            key={`d${i}`}
            points={poly.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke={PLANE_OUTLINE}
            stroke-opacity={0.35}
            stroke-width={1}
          />
        ))}
      </g>
      {/* in-plane cells / rings, hoverable for their name */}
      <g transform={tilt1Matrix} stroke={color}>
        {placed.map((d) => {
          const active = d.id === hovered || d.id === props.selectedId;
          // a currently-shown edge points here: tint the cell in that edge's
          // colour so the live targets read as a coloured region
          const tint = props.tintOf?.(d.id);
          // test reporter status (pass/fail/skip), shown when no edge tint wins
          const statusFill = tint ? undefined : props.statusFillOf?.(d.id);
          // referenced by another plane's edges: brighten the fill so the nodes
          // actually in play surface — yields to the live tint while exploring
          const linked =
            !active &&
            !props.linksActive &&
            (referencedIds?.has(d.id) ?? false);
          // dim untouched nodes once a highlight is active, so targets lead
          const dim = props.linksActive && !tint && !active ? 0.4 : 1;
          const fill = tint ?? statusFill ?? color;
          const onEnter = () => {
            setHovered(d.id);
            props.onHover?.(d.id);
          };
          const onLeave = () => {
            setHovered((h) => (h === d.id ? null : h));
            props.onHover?.(null);
          };
          const onClick = (event: MouseEvent) => {
            event.stopPropagation();
            props.onSelect(d.id, event.shiftKey);
          };
          const onDblClick = props.onRunCell
            ? (event: MouseEvent) => {
                event.stopPropagation();
                props.onRunCell!(d.id);
              }
            : undefined;
          return d.polygon ? (
            <polygon
              key={d.id}
              points={d.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={fill}
              fill-opacity={tint ? 0.34 : statusFill ? 0.4 : active ? 0.22 : linked ? 0.18 : 0.08}
              stroke={tint ?? (active ? SELECT_STROKE : statusFill ?? color)}
              stroke-opacity={tint ? 0.85 : statusFill ? 0.85 : active ? 0.9 : linked ? 0.75 : 0.5}
              stroke-width={active || tint ? 1.6 : 1}
              opacity={dim}
              style={{ cursor: "pointer" }}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              onClick={onClick}
              onDblClick={onDblClick}
            />
          ) : d.r !== undefined ? (
            <circle
              key={d.id}
              cx={d.site.x}
              cy={d.site.y}
              r={d.r}
              fill={fill}
              fill-opacity={tint ? 0.34 : statusFill ? 0.4 : active ? 0.28 : linked ? 0.24 : 0.12}
              stroke={tint ?? (active ? SELECT_STROKE : statusFill ?? color)}
              stroke-opacity={tint ? 0.85 : statusFill ? 0.85 : active ? 0.9 : linked ? 0.8 : 0.6}
              stroke-width={active || tint ? 1.6 : 1}
              opacity={dim}
              style={{ cursor: "pointer" }}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              onClick={onClick}
              onDblClick={onDblClick}
            />
          ) : null;
        })}
      </g>
      {/* names: a zoom-scaled budget of the biggest cells gets a label (more
          as you zoom in, few when zoomed out), plus the hovered / selected
          node. Upright at the node's projected site (plain translate, no tilt
          parent, so it never rotates / scales). */}
      {labelledNodes.map((d) => {
        const p = apply(tilt1, d.site);
        const fontSize = 12 / zoom;
        const suffix = props.labelSuffixOf?.(d.id);
        return (
          <g
            key={d.id}
            transform={`translate(${p.x},${p.y})`}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <text
              y={fontSize * 0.34}
              font-size={fontSize}
              font-weight="600"
              text-anchor="middle"
              fill={color}
            >
              {suffix ? `${d.label} ${suffix}` : d.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

/* ----------------------------------------------------------- edge bundles */

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

/** A picked edge, raised above the map: a bold accented stroke that both
 * layouts draw for the current selection. Endpoint emphasis (circle rings,
 * cell outlines) stays layout-specific; the stroke itself is shared. */
export function RaisedEdgePath(props: {
  d: string;
  color?: string;
  width?: number;
  opacity?: number;
}) {
  return (
    <path
      d={props.d}
      fill="none"
      stroke={props.color ?? SELECT_STROKE}
      stroke-width={props.width ?? 2.4}
      stroke-opacity={props.opacity ?? 0.95}
      stroke-linecap="round"
      style={{ pointerEvents: "none" }}
    />
  );
}

/** Bundling pull toward the hierarchy route. With only a couple of
 * control points per edge, textbook-strong β reads as wild S-curves;
 * a mild pull keeps the trunk grouping without the swerves. */
export const BUNDLE_STRENGTH = 0.45;
/** Detour ratio (route length / chord) where straightening kicks in. */
const BUNDLE_MAX_DETOUR = 1.3;
/** Chords shorter than this share of the map diagonal barely bundle —
 * neighbors should connect directly, only the long hauls join trunks. */
const BUNDLE_FULL_AT = 0.35;

export type EdgeBundle = {
  source: string;
  target: string;
  d: string;
  /** Straight-line endpoint distance, for screen-size culling. */
  chord: number;
  /** The bundled control polyline `d` curves through — proximity picking
   * measures against these segments (close enough to the smooth curve). */
  points: Vec2[];
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
  /** Map diagonal; short edges (relative to it) stay near-straight. */
  span?: number;
  cfgAnchors?: ReadonlyMap<string, CfgAnchor>;
}): (edge: AtlasEdge) => EdgeBundle | null {
  const strength = options.strength ?? BUNDLE_STRENGTH;
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
    const chord = Math.hypot(last.x - first.x, last.y - first.y);
    // adaptive strength: when the control route detours far relative to
    // the direct chord (a short hop whose LCA sits across the module),
    // full bundling hairpins past the target — straighten such edges
    // instead of dragging them through the distant ancestor
    let route = 0;
    for (let i = 1; i < path.length; i++) {
      route += Math.hypot(
        path[i]!.x - path[i - 1]!.x,
        path[i]!.y - path[i - 1]!.y,
      );
    }
    const detour = chord > 1e-6 ? route / chord : 1;
    const lengthRamp = options.span
      ? Math.min(1, chord / (options.span * BUNDLE_FULL_AT))
      : 1;
    const effective =
      strength *
      lengthRamp *
      Math.min(1, BUNDLE_MAX_DETOUR / Math.max(detour, 1e-6));
    const bundled = bundlePath(path, effective);
    return {
      source: edge.source,
      target: edge.target,
      d: smoothPathD(bundled),
      chord,
      points: bundled,
    };
  };
}

/**
 * One uniform group of bundled edges — a `<g>` with shared stroke / opacity /
 * dash, each edge a `<path>` of its bundled curve. Both renderers used to
 * inline this loop per edge kind (selection, focus, lsp, trace); they now share
 * it. `strokeWidth` may vary per edge (e.g. by weight). Returns null when empty
 * so the group disappears exactly as the inline guards did.
 */
export function BundledEdges(props: {
  edges: readonly AtlasEdge[];
  bundleOf: (edge: AtlasEdge) => EdgeBundle | null;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number | ((edge: AtlasEdge) => number);
  /** SVG `stroke-dasharray`; omit for a solid line. */
  dash?: string;
  /** Disambiguates path keys when several groups share endpoints. */
  keyPrefix: string;
}): VNode | null {
  if (props.edges.length === 0) return null;
  return (
    <g
      stroke={props.stroke}
      stroke-opacity={props.strokeOpacity}
      stroke-dasharray={props.dash}
      fill="none"
    >
      {props.edges.map((edge) => {
        const bundle = props.bundleOf(edge);
        if (!bundle) return null;
        const width =
          typeof props.strokeWidth === "function"
            ? props.strokeWidth(edge)
            : props.strokeWidth;
        return (
          <path
            key={`${props.keyPrefix}-${edge.source}-${edge.target}`}
            d={bundle.d}
            stroke-width={width}
            style={{ pointerEvents: "none" }}
          />
        );
      })}
    </g>
  );
}
