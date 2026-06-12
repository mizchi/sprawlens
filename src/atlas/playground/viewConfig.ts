import type { AtlasGraph } from "../contracts/graph.js";
import { pageRank } from "../kernel/pagerank.js";

/**
 * Orthogonal view axes. The old ViewKind ("files" | "api") bundled all of
 * these; presets below reproduce those bundles, but each axis can be
 * switched independently — a manual change just drops the preset to
 * "custom".
 */

/** What unit becomes a layout leaf (and what edges connect). */
export type Granularity = "module" | "file" | "symbol";
/**
 * Boundary levels partition the space: each checked level becomes a ring
 * of nested districts (module ⊃ directory ⊃ file, canonical order). This
 * is the *structure* axis — independent of which elements are displayed.
 * A file boundary only makes sense around sub-file leaves.
 */
export type BoundaryLevel = "module" | "directory" | "file";
export const BOUNDARY_LEVELS: readonly BoundaryLevel[] = [
  "module",
  "directory",
  "file",
];

/**
 * Display levels select which strata are *drawn*. Crucially this is not
 * the partition: a level can be used as a subdivision unit (boundaries,
 * leaf placement) while its rendering is switched off — e.g. partition by
 * directory but hide the directory outlines, or place symbols by their
 * file regions without drawing file borders. AST and CFG are planned
 * dynamic levels: fetched on demand (an LSP/analyzer round-trip like call
 * hierarchy) and rendered only past a zoom threshold, never part of the
 * static graph.
 */
export type DisplayLevel =
  | "module"
  | "directory"
  | "file"
  | "symbol"
  | "ast"
  | "cfg";
export const DISPLAY_LEVELS: readonly DisplayLevel[] = [
  "module",
  "directory",
  "file",
  "symbol",
  "ast",
  "cfg",
];
/** No dynamic provider yet; the UI lists them disabled. */
export const UNAVAILABLE_LEVELS: ReadonlySet<DisplayLevel> = new Set(["ast"]);

/**
 * Omit scopes exclude whole content categories from the map, orthogonal
 * to both depth and boundaries — the recurring "production code only"
 * views: drop test files, drop non-exported symbols.
 */
export type OmitScope = "test" | "private-symbol";
export const OMIT_SCOPES: readonly OmitScope[] = ["test", "private-symbol"];

/** Layers (contracts/layers.ts) hidden by the omit selection. */
export function hiddenLayersOf(omit: readonly OmitScope[]): string[] {
  return omit.includes("test") ? ["test"] : [];
}

/** Whether sub-file detail is rendered at all (nested symbol layouts). */
export function showsSymbolLevels(levels: readonly DisplayLevel[]): boolean {
  return levels.includes("symbol");
}
/** What scores a leaf's area. */
export type WeightKind = "loc" | "pagerank";
/** What a click resolves to; "auto" selects whatever the LOD shows. */
export type SelectMode = "auto" | "module" | "file" | "symbol";

export type ViewConfig = {
  granularity: Granularity;
  boundaries: BoundaryLevel[];
  displayLevels: DisplayLevel[];
  omit: OmitScope[];
  weight: WeightKind;
  /**
   * How deep the zoom auto-focus drills when nothing is selected: zooming
   * past the threshold implicitly selects the crosshair target at this
   * granularity. Explicit clicks always override it.
   */
  focusGranularity: Granularity;
};

export type ViewPreset = {
  id: string;
  label: string;
  config: ViewConfig;
};

export const VIEW_PRESETS: ViewPreset[] = [
  {
    id: "files",
    label: "files (LOC area)",
    config: {
      granularity: "file",
      boundaries: ["module"],
      displayLevels: ["module", "file", "symbol"],
      omit: [],
      weight: "loc",
      focusGranularity: "file",
    },
  },
  {
    id: "api",
    label: "public API network",
    config: {
      granularity: "symbol",
      boundaries: ["module"],
      displayLevels: ["module", "symbol"],
      omit: ["private-symbol"],
      weight: "pagerank",
      focusGranularity: "symbol",
    },
  },
  {
    id: "modules",
    label: "modules only",
    config: {
      granularity: "module",
      boundaries: ["module"],
      displayLevels: ["module"],
      omit: [],
      weight: "loc",
      focusGranularity: "module",
    },
  },
];

export function presetOf(config: ViewConfig): string {
  const match = VIEW_PRESETS.find(
    (p) =>
      p.config.granularity === config.granularity &&
      p.config.boundaries.join("+") === config.boundaries.join("+") &&
      [...p.config.displayLevels].sort().join("+") ===
        [...config.displayLevels].sort().join("+") &&
      [...p.config.omit].sort().join("+") ===
        [...config.omit].sort().join("+") &&
      p.config.weight === config.weight &&
      p.config.focusGranularity === config.focusGranularity,
  );
  return match?.id ?? "custom";
}

export function presetConfig(id: string): ViewConfig | null {
  const preset = VIEW_PRESETS.find((p) => p.id === id);
  return preset
    ? {
        ...preset.config,
        boundaries: [...preset.config.boundaries],
        displayLevels: [...preset.config.displayLevels],
        omit: [...preset.config.omit],
      }
    : null;
}

/**
 * PageRank-weighted variant of a graph: areas follow how depended-upon a
 * node is instead of its size. Normalized to mean 1 so totals stay stable.
 */
export function reweightByPageRank(graph: AtlasGraph): AtlasGraph {
  const ranks = pageRank(
    graph.nodes.map((n) => n.id),
    graph.edges,
  );
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      metrics: {
        ...node.metrics,
        loc: (ranks.get(node.id) ?? 0) * graph.nodes.length,
      },
    })),
    edges: graph.edges,
  };
}

export type SelectionContext = {
  isModule: (id: string) => boolean;
  /** Symbol id → its file id; non-symbols map to themselves. */
  parentFileOf: (id: string) => string;
  moduleOf: (id: string) => string;
};

/**
 * Resolve a clicked id to the configured selection granularity. Only
 * coarsening is possible — clicking a file in symbol mode cannot invent a
 * symbol, so finer modes pass coarser ids through unchanged.
 */
export function resolveSelection(
  id: string,
  mode: SelectMode,
  ctx: SelectionContext,
): string {
  if (mode === "auto" || mode === "symbol") return id;
  if (ctx.isModule(id)) return id;
  if (mode === "module") return ctx.moduleOf(ctx.parentFileOf(id));
  return ctx.parentFileOf(id);
}
