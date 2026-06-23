import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import { renderAtlasSvg } from "./renderAtlasSvg.ts";

/** A small two-module graph: enough to exercise grouping, leaf cells, edges. */
const GRAPH: AtlasGraph = {
  nodes: [
    { id: "src/a/foo.ts", kind: "file", label: "foo.ts", metrics: { loc: 120 }, exported: true },
    { id: "src/a/bar.ts", kind: "file", label: "bar.ts", metrics: { loc: 60 } },
    { id: "src/b/baz.ts", kind: "file", label: "baz.ts", metrics: { loc: 90 }, exported: true },
    { id: "src/b/qux.ts", kind: "file", label: "qux.ts", metrics: { loc: 40 } },
  ],
  edges: [
    { source: "src/a/foo.ts", target: "src/b/baz.ts" },
    { source: "src/a/bar.ts", target: "src/a/foo.ts" },
    { source: "src/b/qux.ts", target: "src/b/baz.ts" },
  ],
};

describe("renderAtlasSvg", () => {
  it("renders a standalone treemap SVG with capacity cells", () => {
    const svg = renderAtlasSvg(GRAPH, { layout: "treemap", level: "file", seed: 1 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 1280 720"');
    // a background rect (the map background) then the Voronoi-ish leaf cells
    expect(svg).toContain("<rect");
    expect((svg.match(/<polygon/g) ?? []).length).toBeGreaterThan(0);
    // file labels make it into the document
    expect(svg).toContain("foo.ts");
  });

  it("renders a rings SVG with module circles and an edge mesh", () => {
    const svg = renderAtlasSvg(GRAPH, { layout: "rings", level: "file", seed: 1, showEdges: true });
    expect(svg).toContain('viewBox="0 0 960 640"');
    expect((svg.match(/<circle/g) ?? []).length).toBeGreaterThan(0);
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThan(0);
  });

  it("honors width/height overrides in the viewBox", () => {
    const svg = renderAtlasSvg(GRAPH, { layout: "treemap", width: 400, height: 300 });
    expect(svg).toContain('viewBox="0 0 400 300"');
    expect(svg).toContain('width="400"');
  });

  it("is deterministic for a fixed seed", () => {
    const a = renderAtlasSvg(GRAPH, { layout: "treemap", seed: 7 });
    const b = renderAtlasSvg(GRAPH, { layout: "treemap", seed: 7 });
    expect(a).toBe(b);
  });

  it("returns a non-empty placeholder for an empty graph", () => {
    const svg = renderAtlasSvg({ nodes: [], edges: [] }, { layout: "treemap" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
  });

  it("tints added/modified files when a changed map is supplied", () => {
    const changed = new Map<string, "added" | "modified">([
      ["src/a/foo.ts", "modified"],
      ["src/b/qux.ts", "added"],
    ]);
    const svg = renderAtlasSvg(GRAPH, { layout: "treemap", level: "file", seed: 1, changed });
    // ADDED_FILL = hsl(150 55% 80%), MODIFIED_FILL = hsl(8 85% 78%) in the light theme
    expect(svg).toContain("hsl(150 55% 80%)");
    expect(svg).toContain("hsl(8 85% 78%)");
  });

  it("embeds a diff legend with per-kind counts", () => {
    const svg = renderAtlasSvg(GRAPH, {
      layout: "treemap",
      seed: 1,
      diffSummary: { added: 2, modified: 7, removed: 3 },
    });
    expect(svg).toContain("added 2");
    expect(svg).toContain("modified 7");
    expect(svg).toContain("removed 3");
  });

  it("omits zero-count rows from the legend and draws none when all zero", () => {
    const someZero = renderAtlasSvg(GRAPH, {
      layout: "treemap",
      seed: 1,
      diffSummary: { added: 1, modified: 0, removed: 0 },
    });
    expect(someZero).toContain("added 1");
    expect(someZero).not.toContain("modified 0");
    expect(someZero).not.toContain("removed 0");

    const allZero = renderAtlasSvg(GRAPH, {
      layout: "treemap",
      seed: 1,
      diffSummary: { added: 0, modified: 0, removed: 0 },
    });
    expect(allZero).not.toContain("added 0");
  });
});
