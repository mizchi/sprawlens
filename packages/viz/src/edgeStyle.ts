/**
 * Shared edge styling, so the two renderers stop carrying their own copies of
 * the same magic numbers. The ambient dependency mesh and the dashed
 * selection / lsp references looked identical in both `RingsMapSvg` and
 * `TreemapSvg`; these are the single source for that.
 */

export type EdgeVisual = { stroke: string; opacity: number; width: number };

/**
 * Ambient dependency-edge styling. An edge touching the selection takes the
 * active tint and reads at the normal mesh prominence; the rest recede further
 * so the lit ones stand out. Crucially every ambient edge stays THIN — only the
 * one edge under the cursor lifts (the hover preview, drawn separately). A
 * selection no longer fattens its whole neighbourhood into a bold fan. Theme
 * colors are passed in (they live in mapShared and flip with dark mode) to keep
 * this pure and unit-testable.
 */
export function ambientEdgeVisual(
  active: boolean,
  hasSelection: boolean,
  colors: { active: string; ambient: string },
): EdgeVisual {
  return active
    ? { stroke: colors.active, opacity: 0.22, width: 1 }
    : { stroke: colors.ambient, opacity: hasSelection ? 0.08 : 0.22, width: 1 };
}

/**
 * Base styling for the selection reference fan. A node with dozens of
 * references used to draw dozens of bright dashed lines that overlapped into
 * an unreadable spray at zoom; instead the fan reads as a faint solid mesh
 * that recedes — no louder than the ambient module mesh — and stays thin until
 * the cursor hovers an individual edge, which raises only that one (drawn on
 * top, separately).
 */
export const REFERENCE_EDGE_BASE = { opacity: 0.28, width: 1 } as const;

/** LSP call-hierarchy dash, scaled so the gap reads at any zoom — the dashed
 * detail overlay stays distinct from the solid selection reference mesh. */
export const lspDash = (zoom: number): string => `${8 / zoom} ${5 / zoom}`;
