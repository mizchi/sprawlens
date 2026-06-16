import { describe, expect, it } from "vitest";
import type { Snapshot } from "@sprawlens/schema";
import { renderTui } from "./tui.js";

const commit = {
  hash: "W",
  shortHash: "w",
  timestamp: "2020-01-01T00:00:00.000Z",
  authorName: "t",
  message: "t",
  aiIndicators: [],
};

function snap(files: { path: string; loc: number }[]): Snapshot {
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
    })),
    edges: [],
    metrics: { loc: 0 } as Snapshot["metrics"],
  };
}

describe("renderTui", () => {
  it("renders a grid of the requested size with box-drawing borders", () => {
    const out = renderTui(
      snap([
        { path: "packages/cli/index.ts", loc: 100 },
        { path: "packages/viz/app.ts", loc: 200 },
        { path: "packages/layout/squarify.ts", loc: 50 },
      ]),
      { cols: 40, rows: 12 },
    );
    const lines = out.split("\n");
    expect(lines).toHaveLength(12);
    for (const line of lines) expect([...line].length).toBe(40);
    expect(out).toContain("┌");
    expect(out).toContain("┘");
  });

  it("labels modules and shows their LOC", () => {
    const out = renderTui(
      snap([
        { path: "packages/cli/index.ts", loc: 100 },
        { path: "packages/viz/app.ts", loc: 400 },
      ]),
      { cols: 60, rows: 20 },
    );
    expect(out).toContain("packages/viz");
    expect(out).toContain("loc");
  });

  it("culls labels that overflow a narrow box (ellipsis or drop)", () => {
    // one wide-but-short module in a small grid → long name can't fit fully
    const out = renderTui(
      snap([{ path: "a-very-long-module-name/x/file.ts", loc: 100 }]),
      { cols: 12, rows: 6 },
    );
    // the full name never appears verbatim; it's truncated
    expect(out).not.toContain("a-very-long-module-name/x");
    expect(out).toContain("┌");
  });

  it("handles an empty snapshot", () => {
    const out = renderTui(snap([]), { cols: 10, rows: 4 });
    expect(out.split("\n")).toHaveLength(4);
    expect(out.trim()).toBe("");
  });
});
