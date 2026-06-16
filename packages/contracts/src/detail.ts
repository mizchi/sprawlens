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
type DetailKind = "ast" | "cfg";

type DetailRequest = {
  kind: DetailKind;
  /** The symbol whose interior is being expanded. */
  symbolId: string;
};

/**
 * Graph local to one symbol: nodes carry kind "block" (CFG basic blocks
 * or AST nodes), edges carry kind "flow". Ids must be stable across
 * fetches so overlays and selections survive a re-fetch. Structured
 * producers may add grid hints — code-shaped placement (row = execution
 * order downward, col = nesting indent) that a layout can use verbatim
 * instead of solving a generic layered layout.
 */
export type DetailGraph = AtlasGraph & {
  grid?: Record<string, { row: number; col: number }>;
  /**
   * Block id → names called from that block. Lets the host map anchor an
   * outgoing reference edge at the step that actually makes the call
   * (incoming references anchor at the entry node instead).
   */
  calls?: Record<string, string[]>;
  /**
   * Block id → the source text behind the block (length-capped): branch
   * conditions for heads, the statements for plain blocks, the signature
   * for the entry. Shown on hover.
   */
  code?: Record<string, string>;
  /**
   * Block id → externally observable effects: "await", "fetch",
   * "assigns <name>" (writes a binding declared outside the function) and
   * "mutates <name>" (property/element writes on non-local objects,
   * including parameters and `this`). Approximate — scope analysis is
   * syntactic, no type checker.
   */
  effects?: Record<string, string[]>;
};

/** Resolves on null when the symbol has no expandable interior. */
type DetailProvider = (
  request: DetailRequest,
) => Promise<DetailGraph | null>;
