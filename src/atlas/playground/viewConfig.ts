import type { AtlasGraph, AtlasNode } from "../contracts/graph.js";
import { transitiveWeights } from "../kernel/transitiveWeight.js";

/**
 * Orthogonal view axes. The old ViewKind ("files" | "api") bundled all of
 * these; presets below reproduce those bundles, but each axis can be
 * switched independently — a manual change just drops the preset to
 * "custom".
 */

/** What unit becomes a layout leaf (and what edges connect). The boundary
 * axis owns it: a file boundary makes files the leaf (symbols nest inside);
 * without it, displaying symbols forms the network; otherwise modules. */
export type Granularity = "module" | "file" | "symbol";

export function granularityOf(
  boundaries: readonly BoundaryLevel[],
  displayLevels: readonly DisplayLevel[],
): Granularity {
  if (boundaries.includes("file")) return "file";
  if (displayLevels.includes("symbol")) return "symbol";
  return "module";
}
/**
 * Boundary levels are the partition axis: each checked level subdivides
 * the space (module ⊃ directory ⊃ file). The innermost decides the leaf —
 * a file boundary makes files the leaf cells (symbols nest inside them);
 * without it the leaf is a module-grouped symbol network or bare modules.
 * Changing this re-solves the layout; the display axis never does.
 */
export type BoundaryLevel = "module" | "directory" | "file";
export const BOUNDARY_LEVELS: readonly BoundaryLevel[] = [
  "module",
  "directory",
  "file",
];

/**
 * Display levels select which strata are *drawn*, never the partition: a
 * level can be a subdivision unit (boundaries) while its outline is hidden
 * — partition by directory but hide directory outlines, say. "file" is not
 * here: it is a boundary, and its leaf cells always draw (zoom-gated). AST
 * and CFG are planned dynamic levels: fetched on demand and rendered only
 * past a zoom threshold, never part of the static graph.
 */
export type DisplayLevel =
  | "module"
  | "directory"
  | "symbol"
  | "ast"
  | "cfg";
export const DISPLAY_LEVELS: readonly DisplayLevel[] = [
  "module",
  "directory",
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
export type WeightKind = "loc" | "complexity";

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
      boundaries: ["module", "file"],
      displayLevels: ["module", "symbol"],
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
      weight: "complexity",
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

/** Own cyclomatic complexity, measured by the producer or estimated
 * from LOC (branching correlates with length closely enough to rank). */
export function complexityOf(node: AtlasNode): number {
  return node.metrics.complexity ?? 1 + node.metrics.loc / 12;
}

/**
 * Transitive-complexity weights: a node's area follows the total
 * complexity it pulls in — its own plus everything it transitively
 * references (shared dependencies counted once, cycles share a closure).
 */
export function reweightByTransitiveComplexity(graph: AtlasGraph): AtlasGraph {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const weights = transitiveWeights(
    graph.nodes.map((n) => n.id),
    graph.edges,
    (id) => complexityOf(byId.get(id)!),
  );
  return {
    nodes: graph.nodes.map((node) => ({
      ...node,
      metrics: {
        ...node.metrics,
        loc: weights.get(node.id) ?? node.metrics.loc,
      },
    })),
    edges: graph.edges,
  };
}

