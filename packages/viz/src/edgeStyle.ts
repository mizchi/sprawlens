/**
 * Shared edge styling, so the two renderers stop carrying their own copies of
 * the same magic numbers. The ambient dependency mesh and the dashed
 * selection / lsp references looked identical in both `RingsMapSvg` and
 * `TreemapSvg`; these are the single source for that.
 */

export type EdgeVisual = { stroke: string; opacity: number; width: number };

/**
 * Ambient dependency-edge styling. An edge touching the selection leads
 * (bright, thick, opaque); the rest recede, and recede further when a selection
 * is active so the lit ones stand out. Theme colors are passed in (they live in
 * mapShared and flip with dark mode) to keep this pure and unit-testable.
 */
export function ambientEdgeVisual(
  active: boolean,
  hasSelection: boolean,
  colors: { active: string; ambient: string },
): EdgeVisual {
  return active
    ? { stroke: colors.active, opacity: 0.9, width: 1.8 }
    : { stroke: colors.ambient, opacity: hasSelection ? 0.08 : 0.22, width: 1 };
}

/** Selection-reference dash, scaled so the gap reads at any zoom. */
export const selectionDash = (zoom: number): string => `${5 / zoom} ${4 / zoom}`;

/** LSP call-hierarchy dash — longer than the selection dash so the two
 * reference overlays stay distinguishable. */
export const lspDash = (zoom: number): string => `${8 / zoom} ${5 / zoom}`;
