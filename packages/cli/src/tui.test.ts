import { describe, expect, it } from "vitest";
import type { CodeSymbol, Snapshot } from "@sprawlens/schema";
import { renderTui } from "./tui.js";

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
