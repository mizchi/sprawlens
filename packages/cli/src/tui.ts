import type { CodeSymbol, Snapshot } from "@sprawlens/schema";
import { squarify } from "@sprawlens/layout";

export type ChangeKind = "added" | "modified";
export type TuiOptions = {
  cols?: number;
  rows?: number;
  /** Working-tree changes, by repo-relative file path — tints the cells. */
  changed?: Map<string, ChangeKind>;
};

/** A node in the module → file → symbol treemap hierarchy. `path` is a stable
 * id used for zoom + breadcrumbs ("pkg/x", "pkg/x/f.ts", "pkg/x/f.ts#sym"). */
export type TreeNode = {
  path: string;
  label: string;
  weight: number;
  changed?: ChangeKind;
  children?: TreeNode[];
};

/** A placed box: a node mapped to integer grid coordinates. `leaf` = it did not
 * subdivide (so it owns its area — tinted, and the hit-test target). */
export type PlacedTile = {
  node: TreeNode;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  leaf: boolean;
};

/** Structural module key: the top two path segments, or "(root)" for a bare file. */
function moduleOf(path: string): string {
  const segs = path.split("/");
  if (segs.length <= 1) return "(root)";
  if (segs.length === 2) return segs[0]!;
  return `${segs[0]}/${segs[1]}`;
}

function baseName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

/** modified outranks added; undefined if nothing changed. */
function mostSevereChange(
  changes: (ChangeKind | undefined)[],
): ChangeKind | undefined {
  if (changes.includes("modified")) return "modified";
  if (changes.includes("added")) return "added";
  return undefined;
}

function symbolChildren(
  filePath: string,
  symbols: readonly CodeSymbol[],
  fileLoc: number,
  changed: ChangeKind | undefined,
): TreeNode[] | undefined {
  if (symbols.length === 0) return undefined;
  const children: TreeNode[] = symbols.map((s) => ({
    path: `${filePath}#${s.name}`,
    label: s.name,
    weight: Math.max(s.loc, 1),
    changed,
  }));
  const covered = children.reduce((s, c) => s + c.weight, 0);
  if (fileLoc - covered > 0)
    children.push({ path: `${filePath}#`, label: "", weight: fileLoc - covered, changed });
  return children;
}

/**
 * The module → file → symbol forest, plus lookups for interactive navigation.
 * `byPath` resolves a zoom target; `parentOf` walks back out.
 */
export function buildForest(
  snapshot: Snapshot,
  changed?: Map<string, ChangeKind>,
): {
  modules: TreeNode[];
  byPath: Map<string, TreeNode>;
  parentOf: Map<string, string>;
} {
  const moduleFiles = new Map<string, TreeNode[]>();
  for (const node of snapshot.nodes) {
    if (node.type !== "file") continue;
    const change = changed?.get(node.path);
    const file: TreeNode = {
      path: node.path,
      label: baseName(node.path),
      weight: Math.max(node.loc, 1),
      changed: change,
      children: symbolChildren(node.path, node.symbols ?? [], node.loc, change),
    };
    const key = moduleOf(node.path);
    (moduleFiles.get(key) ?? moduleFiles.set(key, []).get(key)!).push(file);
  }
  const modules = [...moduleFiles].map(([key, files]) => ({
    path: key,
    label: key,
    weight: files.reduce((s, f) => s + f.weight, 0),
    changed: mostSevereChange(files.map((f) => f.changed)),
    children: files,
  }));

  const byPath = new Map<string, TreeNode>();
  const parentOf = new Map<string, string>();
  const index = (node: TreeNode, parent: string) => {
    byPath.set(node.path, node);
    parentOf.set(node.path, parent);
    for (const c of node.children ?? []) index(c, node.path);
  };
  for (const m of modules) index(m, "");
  return { modules, byPath, parentOf };
}

/** Recursively squarify `nodes` into `rect`, returning every placed box. A box
 * subdivides while it stays large enough; otherwise it's a labeled leaf. */
export function layoutTiles(
  nodes: readonly TreeNode[],
  rect: { x: number; y: number; w: number; h: number },
): PlacedTile[] {
  const out: PlacedTile[] = [];
  const place = (node: TreeNode, x: number, y: number, w: number, h: number) => {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w);
    const y1 = Math.round(y + h);
    if (x1 - x0 < 2 || y1 - y0 < 2) return; // too small to box
    const ix = x0 + 1;
    const iy = y0 + 2;
    const iw = x1 - 1 - ix;
    const ih = y1 - 1 - iy;
    const descends = !!node.children && iw >= 5 && ih >= 3;
    out.push({ node, x0, y0, x1, y1, leaf: !descends });
    if (descends) {
      for (const t of squarify(
        node.children!.map((c, i) => ({ id: String(i), weight: c.weight, node: c })),
        { x: ix, y: iy, w: iw, h: ih },
      ))
        place(t.item.node, t.x, t.y, t.w, t.h);
    }
  };
  for (const t of squarify(
    nodes.map((c, i) => ({ id: String(i), weight: c.weight, node: c })),
    rect,
  ))
    place(t.item.node, t.x, t.y, t.w, t.h);
  return out;
}

/** The deepest (innermost) tile containing a grid cell, or null. */
export function tileAt(tiles: readonly PlacedTile[], x: number, y: number): PlacedTile | null {
  let hit: PlacedTile | null = null;
  for (const t of tiles) {
    if (x >= t.x0 && x < t.x1 && y >= t.y0 && y < t.y1) hit = t; // last wins = deepest
  }
  return hit;
}

const BG: Record<ChangeKind, number> = { added: 22, modified: 58 }; // 256-color
const HOVER_BG = 24; // distinct blue for the hovered tile

type Cell = { ch: string; bg: number | null };

/** Paint placed tiles into a `cols × rows` grid, returning the ANSI string. The
 * hovered tile is filled with a highlight background; changed leaves are tinted. */
export function paintTiles(
  tiles: readonly PlacedTile[],
  cols: number,
  rows: number,
  hoverPath?: string | null,
): string {
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ch: " ", bg: null }) as Cell),
  );
  const at = (x: number, y: number): Cell | null =>
    x >= 0 && x < cols && y >= 0 && y < rows ? grid[y]![x]! : null;
  const put = (x: number, y: number, ch: string) => {
    const cell = at(x, y);
    if (cell) cell.ch = ch;
  };
  const write = (x: number, y: number, text: string, max: number) => {
    const cut =
      text.length <= max
        ? text
        : max >= 2
          ? `${text.slice(0, max - 1)}…`
          : text.slice(0, max);
    for (let i = 0; i < cut.length; i++) put(x + i, y, cut[i]!);
  };

  for (const t of tiles) {
    const hovered = hoverPath != null && t.node.path === hoverPath;
    const bg = hovered ? HOVER_BG : t.leaf && t.node.changed ? BG[t.node.changed] : null;
    if (bg !== null) {
      for (let yy = t.y0; yy < t.y1; yy++)
        for (let xx = t.x0; xx < t.x1; xx++) {
          const cell = at(xx, yy);
          if (cell) cell.bg = bg;
        }
    }
    for (let xx = t.x0; xx < t.x1; xx++) {
      put(xx, t.y0, "─");
      put(xx, t.y1 - 1, "─");
    }
    for (let yy = t.y0; yy < t.y1; yy++) {
      put(t.x0, yy, "│");
      put(t.x1 - 1, yy, "│");
    }
    put(t.x0, t.y0, "┌");
    put(t.x1 - 1, t.y0, "┐");
    put(t.x0, t.y1 - 1, "└");
    put(t.x1 - 1, t.y1 - 1, "┘");
    const innerW = t.x1 - t.x0 - 2;
    if (innerW >= 1 && t.y1 - t.y0 >= 3 && t.node.label)
      write(t.x0 + 1, t.y0 + 1, t.node.label, innerW);
  }
  return gridToString(grid);
}

/** Render the whole snapshot as a static (non-interactive) treemap. */
export function renderTui(snapshot: Snapshot, opts: TuiOptions = {}): string {
  const cols = Math.max(opts.cols ?? 80, 1);
  const rows = Math.max(opts.rows ?? 30, 1);
  const { modules } = buildForest(snapshot, opts.changed);
  const tiles = layoutTiles(modules, { x: 0, y: 0, w: cols, h: rows });
  return paintTiles(tiles, cols, rows);
}

/** Emit the grid, coalescing same-background runs into ANSI escapes. */
function gridToString(grid: Cell[][]): string {
  const lines: string[] = [];
  for (const row of grid) {
    let line = "";
    let bg: number | null = null;
    for (const cell of row) {
      if (cell.bg !== bg) {
        if (bg !== null) line += "\x1b[49m";
        if (cell.bg !== null) line += `\x1b[48;5;${cell.bg}m`;
        bg = cell.bg;
      }
      line += cell.ch;
    }
    if (bg !== null) line += "\x1b[49m";
    lines.push(line);
  }
  return lines.join("\n");
}
