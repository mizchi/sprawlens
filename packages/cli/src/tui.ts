import type { CodeSymbol, Snapshot } from "@sprawlens/schema";
import { squarify } from "@sprawlens/layout";

export type ChangeKind = "added" | "modified";
export type TuiOptions = {
  cols?: number;
  rows?: number;
  /** Working-tree changes, by repo-relative file path — tints the cells. */
  changed?: Map<string, ChangeKind>;
};

/** A node in the module → file → symbol treemap hierarchy. */
type TreeNode = {
  label: string;
  weight: number;
  changed?: ChangeKind;
  children?: TreeNode[];
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

/** Symbols of a file as child nodes; a filler keeps areas honest to LOC. */
function symbolChildren(
  symbols: readonly CodeSymbol[],
  fileLoc: number,
  changed: ChangeKind | undefined,
): TreeNode[] | undefined {
  if (symbols.length === 0) return undefined;
  const children: TreeNode[] = symbols.map((s) => ({
    label: s.name,
    weight: Math.max(s.loc, 1),
    changed,
  }));
  const covered = children.reduce((s, c) => s + c.weight, 0);
  if (fileLoc - covered > 0) children.push({ label: "", weight: fileLoc - covered, changed });
  return children;
}

/** Build the module → file → symbol tree from a snapshot. */
function buildTree(snapshot: Snapshot, changed?: Map<string, ChangeKind>): TreeNode[] {
  const modules = new Map<string, TreeNode[]>();
  for (const node of snapshot.nodes) {
    if (node.type !== "file") continue;
    const change = changed?.get(node.path);
    const file: TreeNode = {
      label: baseName(node.path),
      weight: Math.max(node.loc, 1),
      changed: change,
      children: symbolChildren(node.symbols ?? [], node.loc, change),
    };
    const key = moduleOf(node.path);
    (modules.get(key) ?? modules.set(key, []).get(key)!).push(file);
  }
  return [...modules].map(([label, files]) => ({
    label,
    weight: files.reduce((s, f) => s + f.weight, 0),
    // a module inherits its files' change so it still shows tinted when it's
    // too small to descend into the individual changed files
    changed: mostSevereChange(files.map((f) => f.changed)),
    children: files,
  }));
}

/** modified outranks added; undefined if nothing changed. */
function mostSevereChange(
  changes: (ChangeKind | undefined)[],
): ChangeKind | undefined {
  if (changes.includes("modified")) return "modified";
  if (changes.includes("added")) return "added";
  return undefined;
}

const BG: Record<ChangeKind, number> = { added: 22, modified: 58 }; // 256-color

type Cell = { ch: string; bg: number | null };

/**
 * Render the dependency analysis as a nested treemap in a character grid:
 * modules contain files contain symbols, each an axis-aligned rectangle with
 * area ∝ LOC (squarified). A box subdivides into its children only while it
 * stays big enough; otherwise it's a labeled leaf. Labels that overflow are
 * truncated with an ellipsis (text culled). Changed files/symbols get a tinted
 * background. Pure — the CLI prints it.
 */
export function renderTui(snapshot: Snapshot, opts: TuiOptions = {}): string {
  const cols = Math.max(opts.cols ?? 80, 1);
  const rows = Math.max(opts.rows ?? 30, 1);
  const tree = buildTree(snapshot, opts.changed);

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

  const draw = (node: TreeNode, x: number, y: number, w: number, h: number) => {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w);
    const y1 = Math.round(y + h);
    if (x1 - x0 < 2 || y1 - y0 < 2) return; // too small to box — culled
    // will this box subdivide into a nested level, or is it a leaf?
    const ix = x0 + 1;
    const iy = y0 + 2;
    const iw = x1 - 1 - ix;
    const ih = y1 - 1 - iy;
    const descends = !!node.children && iw >= 5 && ih >= 3;
    // tint a leaf box when it (or, for an undescended parent, any descendant)
    // changed; descending boxes leave tinting to their children
    if (!descends && node.changed) {
      const bg = BG[node.changed];
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const cell = at(xx, yy);
          if (cell) cell.bg = bg;
        }
    }
    // border
    for (let xx = x0; xx < x1; xx++) {
      put(xx, y0, "─");
      put(xx, y1 - 1, "─");
    }
    for (let yy = y0; yy < y1; yy++) {
      put(x0, yy, "│");
      put(x1 - 1, yy, "│");
    }
    put(x0, y0, "┌");
    put(x1 - 1, y0, "┐");
    put(x0, y1 - 1, "└");
    put(x1 - 1, y1 - 1, "┘");

    const innerW = x1 - x0 - 2;
    if (innerW >= 1 && y1 - y0 >= 3 && node.label) write(x0 + 1, y0 + 1, node.label, innerW);
    // descend into children while there's room for a nested level
    if (descends) {
      const tiles = squarify(
        node.children!.map((c, i) => ({ id: String(i), weight: c.weight, node: c })),
        { x: ix, y: iy, w: iw, h: ih },
      );
      for (const t of tiles) draw(t.item.node, t.x, t.y, t.w, t.h);
    }
  };

  for (const t of squarify(
    tree.map((c, i) => ({ id: String(i), weight: c.weight, node: c })),
    { x: 0, y: 0, w: cols, h: rows },
  ))
    draw(t.item.node, t.x, t.y, t.w, t.h);

  return gridToString(grid);
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
