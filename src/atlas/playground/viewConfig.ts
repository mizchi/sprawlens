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
/** What scores a leaf's area. */
export type WeightKind = "loc" | "pagerank";
/** What a click resolves to; "auto" selects whatever the LOD shows. */
export type SelectMode = "auto" | "module" | "file" | "symbol";

export type ViewConfig = {
  granularity: Granularity;
  weight: WeightKind;
  /**
   * Symbol granularity only: drop non-exported symbols and re-project
   * edges through them (the public-API network). Nested file views filter
   * by layers instead.
   */
  hidePrivate: boolean;
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
      weight: "loc",
      hidePrivate: false,
      focusGranularity: "file",
    },
  },
  {
    id: "api",
    label: "public API network",
    config: {
      granularity: "symbol",
      weight: "pagerank",
      hidePrivate: true,
      focusGranularity: "symbol",
    },
  },
  {
    id: "modules",
    label: "modules only",
    config: {
      granularity: "module",
      weight: "loc",
      hidePrivate: false,
      focusGranularity: "module",
    },
  },
];

export function presetOf(config: ViewConfig): string {
  const match = VIEW_PRESETS.find(
    (p) =>
      p.config.granularity === config.granularity &&
      p.config.weight === config.weight &&
      p.config.hidePrivate === config.hidePrivate &&
      p.config.focusGranularity === config.focusGranularity,
  );
  return match?.id ?? "custom";
}

export function presetConfig(id: string): ViewConfig | null {
  const preset = VIEW_PRESETS.find((p) => p.id === id);
  return preset ? { ...preset.config } : null;
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
