import type { AtlasGraph } from "../contracts/graph.js";
import { pageRank } from "../kernel/pagerank.js";

/**
 * Orthogonal view axes. The old ViewKind ("files" | "api") bundled all of
 * these; presets below reproduce those bundles, but each axis can be
 * switched independently — a manual change just drops the preset to
 * "custom".
 */

/** What unit becomes a layout leaf (and what edges connect). Derived
 * from the display levels — the finest partitioning level wins: files
 * nest symbols when both show; symbols without files form the network. */
export type Granularity = "module" | "file" | "symbol";

export function granularityOf(
  levels: readonly DisplayLevel[],
): Granularity {
  if (levels.includes("file")) return "file";
  if (levels.includes("symbol")) return "symbol";
  return "module";
}
/**
 * Boundary levels partition the space: each checked level becomes a ring
 * of nested districts (module ⊃ directory ⊃ file, canonical order). This
 * is the *structure* axis — independent of which elements are displayed.
 * A file boundary only makes sense around sub-file leaves.
 */
export type BoundaryLevel = "module" | "file";
export const BOUNDARY_LEVELS: readonly BoundaryLevel[] = ["module", "file"];

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
export type DisplayLevel = "module" | "file" | "symbol" | "ast" | "cfg";
export const DISPLAY_LEVELS: readonly DisplayLevel[] = [
  "module",
  "file",
  "symbol",
  "ast",
  "cfg",
];
/** No dynamic provider yet; the UI lists them disabled. */
export const UNAVAILABLE_LEVELS: ReadonlySet<DisplayLevel> = new Set(["ast"]);

/**
 * Include scopes: content categories the map shows, orthogonal to both
 * depth and boundaries. Unchecking excludes — internally the state stays
 * an exclusion set so newly appearing scopes default to included. "test"
 * is the test-file layer, "local" the non-exported symbols.
 */
export type OmitScope = "test" | "local";
export const OMIT_SCOPES: readonly OmitScope[] = ["test", "local"];

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

export type ViewConfig = {
  boundaries: BoundaryLevel[];
  displayLevels: DisplayLevel[];
  omit: OmitScope[];
  weight: WeightKind;
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
      boundaries: ["module"],
      displayLevels: ["module", "file", "symbol"],
      omit: [],
      weight: "loc",
    },
  },
  {
    id: "api",
    label: "public API network",
    config: {
      boundaries: ["module"],
      displayLevels: ["module", "symbol"],
      omit: ["local"],
      weight: "pagerank",
    },
  },
  {
    id: "modules",
    label: "modules only",
    config: {
      boundaries: ["module"],
      displayLevels: ["module"],
      omit: [],
      weight: "loc",
    },
  },
];

export function presetOf(config: ViewConfig): string {
  const match = VIEW_PRESETS.find(
    (p) =>
      p.config.boundaries.join("+") === config.boundaries.join("+") &&
      [...p.config.displayLevels].sort().join("+") ===
        [...config.displayLevels].sort().join("+") &&
      [...p.config.omit].sort().join("+") ===
        [...config.omit].sort().join("+") &&
      p.config.weight === config.weight,
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

