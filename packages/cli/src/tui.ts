import type { Snapshot } from "@sprawlens/schema";
import { squarify } from "@sprawlens/layout";

export type TuiOptions = { cols?: number; rows?: number };

/** Structural module key for a file: its top two path segments (the package /
 * sub-package), or "(root)" for a bare file. */
function moduleOf(path: string): string {
  const segs = path.split("/");
  if (segs.length <= 1) return "(root)";
  if (segs.length === 2) return segs[0]!;
  return `${segs[0]}/${segs[1]}`;
}

/**
 * Render a dependency map to a character grid: modules become axis-aligned
 * rectangles with area proportional to their LOC (squarified treemap), boxed
 * and labeled. Labels that overflow their box are truncated with an ellipsis;
 * boxes too small to hold even that are drawn empty (the text is culled). A
 * pure function — the CLI prints the string; it's also unit-testable.
 */
export function renderTui(snapshot: Snapshot, opts: TuiOptions = {}): string {
  const cols = Math.max(opts.cols ?? 80, 1);
  const rows = Math.max(opts.rows ?? 30, 1);

  const groups = new Map<string, { loc: number; files: number }>();
  for (const node of snapshot.nodes) {
    if (node.type !== "file") continue;
    const key = moduleOf(node.path);
    const g = groups.get(key) ?? { loc: 0, files: 0 };
    g.loc += node.loc;
    g.files += 1;
    groups.set(key, g);
  }
  const items = [...groups].map(([id, g]) => ({
    id,
    weight: Math.max(g.loc, 1),
    loc: g.loc,
    files: g.files,
  }));
  const tiles = squarify(items, { x: 0, y: 0, w: cols, h: rows });

  const grid: string[][] = Array.from({ length: rows }, () =>
    Array<string>(cols).fill(" "),
  );
  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < cols && y >= 0 && y < rows) grid[y]![x] = ch;
  };
  const write = (x: number, y: number, text: string, max: number) => {
    // cull overflow: truncate to `max`, ellipsis when there's room
    const cut =
      text.length <= max
        ? text
        : max >= 2
          ? `${text.slice(0, max - 1)}…`
          : text.slice(0, max);
    for (let i = 0; i < cut.length; i++) put(x + i, y, cut[i]!);
  };

  for (const tile of tiles) {
    const x0 = Math.round(tile.x);
    const y0 = Math.round(tile.y);
    const x1 = Math.round(tile.x + tile.w);
    const y1 = Math.round(tile.y + tile.h);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 2 || h < 2) continue; // too small to box — drop it
    for (let x = x0; x < x1; x++) {
      put(x, y0, "─");
      put(x, y1 - 1, "─");
    }
    for (let y = y0; y < y1; y++) {
      put(x0, y, "│");
      put(x1 - 1, y, "│");
    }
    put(x0, y0, "┌");
    put(x1 - 1, y0, "┐");
    put(x0, y1 - 1, "└");
    put(x1 - 1, y1 - 1, "┘");

    const innerW = w - 2;
    if (innerW >= 1 && h >= 3) {
      write(x0 + 1, y0 + 1, tile.item.id, innerW);
      if (h >= 4 && innerW >= 3) {
        write(x0 + 1, y0 + 2, `${tile.item.loc} loc`, innerW);
      }
    }
  }
  return grid.map((row) => row.join("")).join("\n");
}
