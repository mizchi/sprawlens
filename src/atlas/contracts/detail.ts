import type { AtlasGraph } from "./graph.js";

/**
 * Dynamic detail levels (AST, CFG). These are never part of the static
 * snapshot graph: a provider fetches them on demand — an LSP/analyzer
 * round-trip like the call-hierarchy client — when the camera zooms into
 * a symbol cell past the detail threshold, and the result renders as a
 * nested layout inside that cell (the same mechanism as nested symbols
 * inside file cells). Runtime traces (contracts/overlay.ts) lift onto the
 * same block ids, so an executed path can be drawn over the fetched CFG.
 */
export type DetailKind = "ast" | "cfg";

export type DetailRequest = {
  kind: DetailKind;
  /** The symbol whose interior is being expanded. */
  symbolId: string;
};

/**
 * Graph local to one symbol: nodes carry kind "block" (CFG basic blocks
 * or AST nodes), edges carry kind "flow". Ids must be stable across
 * fetches so overlays and selections survive a re-fetch.
 */
export type DetailGraph = AtlasGraph;

/** Resolves on null when the symbol has no expandable interior. */
export type DetailProvider = (
  request: DetailRequest,
) => Promise<DetailGraph | null>;
