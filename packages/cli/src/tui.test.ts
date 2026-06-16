import { describe, expect, it } from "vitest";
import type { CodeSymbol, Snapshot } from "@sprawlens/schema";
import {
  buildForest,
  layoutTiles,
  neighbor,
  renderTui,
  tileAt,
  type PlacedTile,
} from "./tui.js";

const commit = {
  hash: "W",
  shortHash: "w",
  timestamp: "2020-01-01T00:00:00.000Z",
  authorName: "t",
  message: "t",
  aiIndicators: [],
};

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

type FileSpec = { path: string; loc: number; symbols?: CodeSymbol[] };
function snap(files: FileSpec[]): Snapshot {
  return {
    schemaVersion: 1,
    repoPath: "/x",
    commit,
    nodes: files.map((f) => ({
      id: `file:${f.path}`,
      type: "file" as const,
      path: f.path,
      ext: ".ts",
      loc: f.loc,
      sizeBytes: f.loc * 30,
      ...(f.symbols ? { symbols: f.symbols } : {}),
    })),
    edges: [],
    metrics: { loc: 0 } as Snapshot["metrics"],
  };
}

function sym(name: string, loc: number): CodeSymbol {
  return { id: `s:${name}`, kind: "function", name, startLine: 1, endLine: loc, loc, complexity: 1, exported: true };
}

describe("renderTui", () => {
  it("renders a grid of the requested visible size with box borders", () => {
    const out = renderTui(
      snap([
        { path: "packages/cli/index.ts", loc: 100 },
        { path: "packages/viz/app.ts", loc: 200 },
        { path: "packages/layout/squarify.ts", loc: 50 },
      ]),
      { cols: 40, rows: 12 },
    );
    const lines = stripAnsi(out).split("\n");
    expect(lines).toHaveLength(12);
    for (const line of lines) expect([...line].length).toBe(40);
    expect(out).toContain("┌");
  });

  it("nests modules → files → symbols when there is room", () => {
    const out = stripAnsi(
      renderTui(
        snap([
          {
            path: "core/engine.ts",
            loc: 200,
            symbols: [sym("solve", 120), sym("step", 60)],
          },
        ]),
        { cols: 60, rows: 24 },
      ),
    );
    expect(out).toContain("core"); // module
    expect(out).toContain("engine.ts"); // file
    expect(out).toContain("solve"); // symbol
  });

  it("tints changed files with an ANSI background", () => {
    const out = renderTui(
      snap([
        { path: "a/x.ts", loc: 100 },
        { path: "b/y.ts", loc: 100 },
      ]),
      { cols: 40, rows: 16, changed: new Map([["a/x.ts", "modified"]]) },
    );
    expect(out).toContain("\x1b[48;5;58m"); // modified background present
    // an unchanged-only render has no background escapes
    const plain = renderTui(snap([{ path: "a/x.ts", loc: 100 }]), { cols: 40, rows: 16 });
    expect(plain).not.toContain("\x1b[48;5;");
  });

  it("culls labels that overflow a narrow box", () => {
    const out = stripAnsi(
      renderTui(snap([{ path: "a-very-long-module-name/x/file.ts", loc: 100 }]), {
        cols: 12,
        rows: 6,
      }),
    );
    expect(out).not.toContain("a-very-long-module-name");
    expect(out).toContain("┌");
  });

  it("handles an empty snapshot", () => {
    const out = renderTui(snap([]), { cols: 10, rows: 4 });
    expect(stripAnsi(out).split("\n")).toHaveLength(4);
    expect(stripAnsi(out).trim()).toBe("");
  });
});

describe("buildForest (interactive navigation)", () => {
  it("assigns stable paths and parent links for zoom + breadcrumb", () => {
    const { byPath, parentOf } = buildForest(
      snap([{ path: "core/engine.ts", loc: 200, symbols: [sym("solve", 120)] }]),
    );
    expect(byPath.has("core")).toBe(true); // module
    expect(byPath.has("core/engine.ts")).toBe(true); // file
    expect(byPath.has("core/engine.ts#solve:1")).toBe(true); // symbol
    expect(parentOf.get("core/engine.ts#solve:1")).toBe("core/engine.ts");
    expect(parentOf.get("core/engine.ts")).toBe("core");
    expect(parentOf.get("core")).toBe(""); // top
  });
});

describe("neighbor (arrow-key navigation)", () => {
  const tile = (path: string, x0: number, y0: number, x1: number, y1: number): PlacedTile => ({
    node: { path, label: path, weight: 1 },
    x0,
    y0,
    x1,
    y1,
    leaf: true,
  });
  // a (top-left), b (right of a), c (below a)
  const tiles = [tile("a", 0, 0, 10, 5), tile("b", 10, 0, 20, 5), tile("c", 0, 5, 10, 10)];

  it("moves to the nearest box in a direction", () => {
    expect(neighbor(tiles, "a", "right")).toBe("b");
    expect(neighbor(tiles, "a", "down")).toBe("c");
    expect(neighbor(tiles, "b", "left")).toBe("a");
    expect(neighbor(tiles, "c", "up")).toBe("a");
  });
  it("stays put when there's nothing that way, and seeds from the first box", () => {
    expect(neighbor(tiles, "a", "left")).toBe("a");
    expect(neighbor(tiles, null, "right")).toBe("a");
  });
});

describe("tileAt (hit-testing)", () => {
  it("returns the deepest tile under a point", () => {
    const { modules } = buildForest(
      snap([{ path: "core/engine.ts", loc: 200, symbols: [sym("solve", 180)] }]),
    );
    const tiles = layoutTiles(modules, { x: 0, y: 0, w: 60, h: 24 });
    // a point well inside resolves to the innermost (symbol) tile, not the module
    const center = tileAt(tiles, 30, 12);
    expect(center).not.toBeNull();
    expect(center!.node.path).toContain("core/engine.ts"); // file or symbol, not bare module
    // outside the grid → nothing
    expect(tileAt(tiles, 999, 999)).toBeNull();
  });
});
