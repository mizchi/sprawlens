import { describe, expect, it } from "vitest";
import type { CodeSymbol, Snapshot } from "@sprawlens/schema";
import { buildForest } from "./tui.js";
import { composeFrame } from "./tuiApp.js";

const commit = {
  hash: "W",
  shortHash: "w",
  timestamp: "2020-01-01T00:00:00.000Z",
  authorName: "t",
  message: "t",
  aiIndicators: [],
};
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
function sym(name: string, loc: number): CodeSymbol {
  return { id: `s:${name}`, kind: "function", name, startLine: 1, endLine: loc, loc, complexity: 1, exported: true };
}
const snapshot: Snapshot = {
  schemaVersion: 1,
  repoPath: "/x",
  commit,
  nodes: [
    {
      id: "file:packages/viz/App.tsx",
      type: "file",
      path: "packages/viz/App.tsx",
      ext: ".tsx",
      loc: 300,
      sizeBytes: 9000,
      symbols: [sym("solve", 200), sym("step", 80)],
    },
    {
      id: "file:packages/cli/index.ts",
      type: "file",
      path: "packages/cli/index.ts",
      ext: ".ts",
      loc: 100,
      sizeBytes: 3000,
    },
  ],
  edges: [],
  metrics: { loc: 0 } as Snapshot["metrics"],
};

describe("composeFrame", () => {
  const forest = buildForest(snapshot);
  const size = { cols: 70, rows: 24 };

  it("shows the repo at the breadcrumb top with no zoom", () => {
    const { frame } = composeFrame(forest, { rootPath: "", hoverPath: null }, size, "demo");
    expect(stripAnsi(frame).split("\n")[0]).toContain("demo");
  });

  it("breadcrumbs the zoom path and lays out the root's children", () => {
    const { frame } = composeFrame(
      forest,
      { rootPath: "packages/viz/App.tsx", hoverPath: null },
      size,
      "demo",
    );
    const top = stripAnsi(frame).split("\n")[0]!;
    expect(top).toContain("demo › packages/viz › App.tsx");
    // zoomed into the file, its symbols fill the map
    expect(stripAnsi(frame)).toContain("solve");
  });

  it("shows the hovered box's full name in the status line", () => {
    const { frame } = composeFrame(
      forest,
      { rootPath: "", hoverPath: "packages/viz/App.tsx" },
      size,
      "demo",
    );
    const lines = stripAnsi(frame).split("\n");
    expect(lines[lines.length - 1]).toContain("packages/viz/App.tsx");
  });

  it("returns tiles for hit-testing", () => {
    const { tiles } = composeFrame(forest, { rootPath: "", hoverPath: null }, size, "demo");
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.some((t) => t.node.path === "packages/viz")).toBe(true);
  });

  it("fills the scope with source when zoomed into a symbol", () => {
    const code = { title: "solve — packages/viz/App.tsx", lines: ["12│const x = 1", "13│return x"] };
    const { frame, tiles } = composeFrame(
      forest,
      { rootPath: "packages/viz/App.tsx#solve:1", hoverPath: null, code },
      size,
      "demo",
    );
    const body = stripAnsi(frame);
    expect(body).toContain("solve — packages/viz/App.tsx");
    expect(body).toContain("const x = 1");
    // the code fills the scope — no nested treemap to hit-test
    expect(tiles).toHaveLength(0);
  });
});
