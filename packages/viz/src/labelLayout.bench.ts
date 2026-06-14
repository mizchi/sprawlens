import { bench, describe } from "vitest";
import type { CellResult } from "@sprawlens/layout";
import { createRng } from "@sprawlens/layout";

// Replicates the per-frame label math the SVG layers run over every visible
// cell — sqrt(actualArea) several times, threshold gates, screen-font clamps,
// and the watermark bbox scan. No preact: this isolates the "font-size
// recalculation" cost the rendering does each frame, to see if the math is
// actually the bottleneck or if it is preact vnode churn.

const W = 960;
const H = 640;
const WATERMARK_PX = 140;
const MIN_CELL_PX = 2.5;
const SYMBOL_DOMINANT_FRACTION = 0.35;

function cells(n: number, seed = 1): CellResult[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const r = 4 + rng() * 40;
    const cx = rng() * W;
    const cy = rng() * H;
    const polygon = Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
    return {
      id: `pkg/file${i}.ts`,
      site: { x: cx, y: cy },
      polygon,
      edges: [],
      targetArea: Math.PI * r * r,
      actualArea: Math.PI * r * r,
    };
  });
}

const screenFont = (
  worldBase: number,
  min: number,
  max: number,
  zoom: number,
  force = false,
  hideAbove = Infinity,
): number | null => {
  const screen = worldBase * zoom;
  if ((screen < min || screen > hideAbove) && !force) return null;
  return Math.min(Math.max(screen, min), max) / zoom;
};

/** One frame's worth of label visibility + font sizing over all cells. */
function labelFrame(list: readonly CellResult[], zoom: number): number {
  const view = { x: 0, y: 0, w: W, h: H };
  let drawn = 0;
  for (const cell of list) {
    // visibleFileCells gate
    if (Math.sqrt(cell.actualArea) * zoom < MIN_CELL_PX) continue;
    // watermark layer
    const natural = Math.sqrt(cell.actualArea) * 0.18;
    if (natural * zoom >= WATERMARK_PX) {
      const fontSize = Math.min(natural, view.w * 0.09);
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
      void fontSize;
      void (minX + maxX + minY + maxY);
      drawn++;
      continue;
    }
    // foreground file label
    const fg = screenFont(Math.sqrt(cell.actualArea) * 0.18, 9, 15, zoom);
    if (fg !== null) drawn++;
    // symbol-dominance gate (inner labels reuse the same pattern)
    const dominant =
      Math.sqrt(cell.actualArea) * zoom >=
      Math.min(W, H) * SYMBOL_DOMINANT_FRACTION;
    if (dominant) drawn++;
  }
  return drawn;
}

describe("label frame (per-render font sizing)", () => {
  for (const n of [300, 1000, 3000]) {
    const list = cells(n);
    bench(`n=${n}`, () => {
      labelFrame(list, 2.2);
    });
  }
});
