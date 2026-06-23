/**
 * Squarified treemap (Bruls, Huizing & van Wijk): partition a rectangle into
 * axis-aligned sub-rectangles whose areas are proportional to item weights,
 * greedily keeping each one as close to square as possible. Axis-aligned (unlike
 * the Voronoi treemap) so it rasterizes cleanly onto a character grid.
 */

export type SquarifyItem = { id: string; weight: number };
export type Tile<T> = { item: T; x: number; y: number; w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** Worst (largest) aspect ratio in a row of given areas laid along `side`. */
function worst(areas: number[], side: number, sum: number): number {
  if (areas.length === 0 || side === 0) return Infinity;
  let max = -Infinity;
  let min = Infinity;
  for (const a of areas) {
    if (a > max) max = a;
    if (a < min) min = a;
  }
  const s2 = sum * sum;
  const side2 = side * side;
  return Math.max((side2 * max) / s2, s2 / (side2 * min));
}

/**
 * Tile `items` into `rect`, areas ∝ weight. Returns one tile per item with a
 * positive weight (zero/negative weights are dropped). Order follows descending
 * weight, which the algorithm needs anyway.
 */
export function squarify<T extends SquarifyItem>(items: readonly T[], rect: Rect): Tile<T>[] {
  const positive = items.filter((i) => i.weight > 0);
  if (positive.length === 0 || rect.w <= 0 || rect.h <= 0) return [];
  const sorted = [...positive].sort((a, b) => b.weight - a.weight);
  const totalWeight = sorted.reduce((s, i) => s + i.weight, 0);
  const totalArea = rect.w * rect.h;
  const scale = totalArea / totalWeight; // weight → area

  const tiles: Tile<T>[] = [];
  let free: Rect = { ...rect };
  let i = 0;
  while (i < sorted.length) {
    const side = Math.min(free.w, free.h); // lay the row along the shorter side
    const rowItems: T[] = [];
    const rowAreas: number[] = [];
    let rowSum = 0;
    // grow the row while it keeps improving (lowers the worst aspect ratio)
    while (i < sorted.length) {
      const area = sorted[i]!.weight * scale;
      const withNext = worst([...rowAreas, area], side, rowSum + area);
      const current = worst(rowAreas, side, rowSum);
      if (rowItems.length > 0 && withNext > current) break;
      rowItems.push(sorted[i]!);
      rowAreas.push(area);
      rowSum += area;
      i++;
    }
    // place the fixed row across the shorter side, consuming `thickness`
    const thickness = side === 0 ? 0 : rowSum / side;
    const horizontal = free.w >= free.h; // long side horizontal → stack a column
    let cursor = horizontal ? free.y : free.x;
    for (let k = 0; k < rowItems.length; k++) {
      const length = rowSum === 0 ? 0 : (rowAreas[k]! / rowSum) * side;
      tiles.push(
        horizontal
          ? { item: rowItems[k]!, x: free.x, y: cursor, w: thickness, h: length }
          : { item: rowItems[k]!, x: cursor, y: free.y, w: length, h: thickness },
      );
      cursor += length;
    }
    free = horizontal
      ? { x: free.x + thickness, y: free.y, w: free.w - thickness, h: free.h }
      : { x: free.x, y: free.y + thickness, w: free.w, h: free.h - thickness };
    if (free.w <= 1e-9 || free.h <= 1e-9) break;
  }
  return tiles;
}
