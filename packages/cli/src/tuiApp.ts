import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Snapshot } from "@sprawlens/schema";
import {
  buildForest,
  drawPanel,
  gridToString,
  layoutTiles,
  makeGrid,
  neighbor,
  paintTilesInto,
  selectAt,
  type ChangeKind,
  type Direction,
  type PlacedTile,
  type TreeNode,
} from "./tui.ts";

type Forest = ReturnType<typeof buildForest>;
export type CodePreview = { title: string; lines: string[] };

/**
 * Compose one interactive frame: a breadcrumb of the current zoom path, the
 * treemap of the current root's children, and a status line with the hovered
 * box's full name. Pure — returns the string and the placed tiles (for
 * hit-testing the next mouse event).
 */
export function composeFrame(
  forest: Forest,
  state: { rootPath: string; hoverPath: string | null; code?: CodePreview },
  size: { cols: number; rows: number },
  repoName: string,
): { frame: string; tiles: PlacedTile[] } {
  const cols = Math.max(size.cols, 1);
  const gridRows = Math.max(size.rows - 2, 1);
  const cells = makeGrid(cols, gridRows);
  let tiles: PlacedTile[] = [];
  if (state.code) {
    // zoomed into a symbol: its source fills the scope (no nested treemap)
    drawPanel(cells, 0, 0, cols, gridRows, state.code.title, state.code.lines);
  } else {
    const root = state.rootPath === "" ? null : forest.byPath.get(state.rootPath);
    const nodes: TreeNode[] = root ? (root.children ?? []) : forest.modules;
    tiles = layoutTiles(nodes, { x: 0, y: 0, w: cols, h: gridRows });
    paintTilesInto(cells, tiles, state.hoverPath);
  }
  const grid = gridToString(cells);

  const chain: string[] = [];
  let p = state.rootPath;
  while (p !== "") {
    chain.unshift(forest.byPath.get(p)?.label ?? p);
    p = forest.parentOf.get(p) ?? "";
  }
  const crumb = `\x1b[1m${pad(clip([repoName, ...chain].join(" › "), cols), cols)}\x1b[0m`;

  const hovered = state.hoverPath ? forest.byPath.get(state.hoverPath) : null;
  const statusText = hovered
    ? `▸ ${hovered.path}  ·  ${hovered.weight} loc`
    : "hover a box · Enter/click zooms in · Esc zooms out · q quits";
  const status = `\x1b[2m${pad(clip(statusText, cols), cols)}\x1b[0m`;

  return { frame: `${crumb}\n${grid}\n${status}`, tiles };
}

/**
 * Interactive terminal viewer over the treemap. Mouse motion or the arrow keys
 * move the selection between boxes; the status line shows the selected box's
 * full name (labels in the map are culled to fit). Enter / left click zooms into
 * the selected box (module → file → symbol); zooming into a symbol fills the
 * scope with its source. Esc / Backspace zooms back out; the breadcrumb shows
 * the path. Runs in the alternate screen and restores the terminal on exit.
 */
export async function runTuiApp(opts: {
  snapshot: Snapshot;
  changed?: Map<string, ChangeKind>;
  repoName: string;
  repoRoot: string;
}): Promise<void> {
  const forest = buildForest(opts.snapshot, opts.changed);
  const out = process.stdout;
  const stdin = process.stdin;

  let rootPath = "";
  let hoverPath: string | null = null;
  let tiles: PlacedTile[] = [];

  // the selected symbol's source, read on demand and cached by file
  const fileLines = new Map<string, string[]>();
  const linesOf = (file: string): string[] => {
    let lines = fileLines.get(file);
    if (!lines) {
      try {
        lines = readFileSync(join(opts.repoRoot, file), "utf8").split("\n");
      } catch {
        lines = [];
      }
      fileLines.set(file, lines);
    }
    return lines;
  };
  const codeFor = (path: string | null): CodePreview | undefined => {
    const node = path ? forest.byPath.get(path) : null;
    if (!node?.file || node.startLine == null || node.endLine == null) return undefined;
    const all = linesOf(node.file);
    if (all.length === 0) return undefined;
    const start = Math.max(node.startLine, 1);
    const end = Math.min(node.endLine, all.length);
    const budget = Math.max((out.rows ?? 30) - 4, 4);
    const numW = String(end).length;
    const lines = all
      .slice(start - 1, end)
      .slice(0, budget)
      .map((ln, i) => `${String(start + i).padStart(numW)}│${ln}`);
    return { title: `${node.label} — ${node.file}`, lines };
  };

  const render = () => {
    // when the zoomed scope is a symbol, its source fills the scope
    const code = rootPath ? codeFor(rootPath) : undefined;
    const composed = composeFrame(
      forest,
      { rootPath, hoverPath, code },
      { cols: out.columns ?? 80, rows: out.rows ?? 30 },
      opts.repoName,
    );
    tiles = composed.tiles;
    out.write(`\x1b[H${composed.frame}`);
  };

  const move = (dir: Direction) => {
    hoverPath = neighbor(tiles, hoverPath, dir);
    render();
  };

  const zoomIn = (path: string | null) => {
    if (!path) return;
    const node = forest.byPath.get(path);
    if (!node) return;
    // zoom into a box with children, or into a symbol (whose scope is its code)
    const hasCode = node.file != null && node.startLine != null;
    if (!node.children?.length && !hasCode) return;
    rootPath = path;
    hoverPath = null;
    render();
  };
  const zoomOut = () => {
    if (rootPath === "") return;
    // re-select the box we were zoomed into, so backing out keeps your place
    const leaving = rootPath;
    rootPath = forest.parentOf.get(rootPath) ?? "";
    hoverPath = leaving;
    render();
  };

  const cleanup = () => {
    out.write("\x1b[?1003l\x1b[?1006l\x1b[?25h\x1b[?1049l");
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
  };

  return new Promise<void>((resolve) => {
    const quit = () => {
      cleanup();
      stdin.off("data", onData);
      out.off("resize", render);
      resolve();
    };
    const onData = (data: Buffer) => {
      const s = data.toString("utf8");
      const mouse = [...s.matchAll(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/g)];
      if (mouse.length > 0) {
        const m = mouse[mouse.length - 1]!;
        const button = Number(m[1]);
        const col = Number(m[2]) - 1;
        const row = Number(m[3]) - 1;
        const gridY = row - 1; // the breadcrumb occupies the first line
        // select the scope unit (file/module), not a deeper preview box
        const hit = selectAt(tiles, col, gridY);
        hoverPath = hit?.node.path ?? null;
        // a left press (button 0, no motion flag) on a box zooms into it
        if (m[4] === "M" && (button & 0b1100011) === 0) zoomIn(hoverPath);
        else render();
        return;
      }
      if (s === "\x03" || s === "q") return quit();
      // arrow keys move the selection between boxes
      if (s === "\x1b[A" || s === "\x1bOA") return move("up");
      if (s === "\x1b[B" || s === "\x1bOB") return move("down");
      if (s === "\x1b[C" || s === "\x1bOC") return move("right");
      if (s === "\x1b[D" || s === "\x1bOD") return move("left");
      if (s === "\r" || s === "\n") return zoomIn(hoverPath);
      if (s === "\x7f" || s === "\b" || s === "\x1b") return zoomOut(); // back
    };

    out.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[?1003h\x1b[?1006h");
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    out.on("resize", render);
    process.once("SIGINT", quit);
    render();
  });
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return max >= 2 ? `${text.slice(0, max - 1)}…` : text.slice(0, max);
}
function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}
