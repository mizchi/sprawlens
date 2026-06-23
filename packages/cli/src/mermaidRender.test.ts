import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import { renderDiffMermaid } from "./mermaidRender.ts";

const GRAPH: AtlasGraph = {
  nodes: [
    { id: "src/a/foo.ts", kind: "file", label: "foo.ts", metrics: { loc: 120 } },
    { id: "src/a/bar.ts", kind: "file", label: "bar.ts", metrics: { loc: 60 } },
    { id: "src/b/baz.ts", kind: "file", label: "baz.ts", metrics: { loc: 90 } },
    { id: "src/b/qux.ts", kind: "file", label: "qux.ts", metrics: { loc: 40 } },
  ],
  edges: [
    { source: "src/a/foo.ts", target: "src/b/baz.ts" },
    { source: "src/a/bar.ts", target: "src/a/foo.ts" },
    { source: "src/b/qux.ts", target: "src/b/baz.ts" },
  ],
};

describe("renderDiffMermaid", () => {
  it("renders a fenced mermaid block of the changed subgraph + 1-hop neighbors", () => {
    const changed = new Map<string, "added" | "modified">([
      ["src/a/foo.ts", "modified"],
      ["src/b/qux.ts", "added"],
    ]);
    const out = renderDiffMermaid(GRAPH, changed, {
      summary: { added: 1, modified: 1, removed: 0 },
    });
    expect(out).toContain("```mermaid");
    expect(out.trimEnd().endsWith("```")).toBe(true);
    // summary renders as a plain markdown line above the fence
    expect(out).toContain("`+1` added");
    expect(out).toContain("`~1` modified");
    expect(out).toContain("`-0` removed");
    expect(out).toContain("flowchart LR");
    expect(out).toContain("classDef added");
    expect(out).toContain("classDef modified");
    // both changed files are present, labeled with disambiguating paths
    expect(out).toContain('"src/a/foo.ts"');
    expect(out).toContain('"src/b/qux.ts"');
    // neighbor baz.ts is pulled in (foo→baz and qux→baz)
    expect(out).toContain('"src/b/baz.ts"');
    // bar.ts → foo.ts makes bar a neighbor of a changed node too
    expect(out).toContain('"src/a/bar.ts"');
    // class assignments applied to changed nodes
    expect(out).toMatch(/class n\d+ modified/);
    expect(out).toMatch(/class n\d+ added/);
  });

  it("is deterministic", () => {
    const changed = new Map<string, "added" | "modified">([["src/a/foo.ts", "modified"]]);
    const a = renderDiffMermaid(GRAPH, changed);
    const b = renderDiffMermaid(GRAPH, changed);
    expect(a).toBe(b);
  });

  it("returns empty string when no changed file is on the map", () => {
    const changed = new Map<string, "added" | "modified">([["README.md", "modified"]]);
    expect(renderDiffMermaid(GRAPH, changed)).toBe("");
  });

  it("aggregates files into modules at level 'module'", () => {
    const changed = new Map<string, "added" | "modified">([
      ["src/a/foo.ts", "modified"],
      ["src/b/qux.ts", "added"],
    ]);
    const out = renderDiffMermaid(GRAPH, changed, { level: "module" });
    // modules, not files, are the nodes
    expect(out).toContain('"src/a"');
    expect(out).toContain('"src/b"');
    expect(out).not.toContain('"foo.ts"');
    expect(out).not.toContain('"qux.ts"');
    // src/b has qux (added) but baz (unchanged) → partial change → modified
    expect(out).toMatch(/class n\d+ modified/);
    expect(out).not.toMatch(/class n\d+ added/);
  });

  it("marks a module 'added' only when all its files are new", () => {
    const graph: AtlasGraph = {
      nodes: [
        { id: "src/a/foo.ts", kind: "file", label: "foo.ts", metrics: { loc: 10 } },
        { id: "src/new/x.ts", kind: "file", label: "x.ts", metrics: { loc: 5 } },
        { id: "src/new/y.ts", kind: "file", label: "y.ts", metrics: { loc: 5 } },
      ],
      edges: [{ source: "src/new/x.ts", target: "src/a/foo.ts" }],
    };
    const changed = new Map<string, "added" | "modified">([
      ["src/new/x.ts", "added"],
      ["src/new/y.ts", "added"],
    ]);
    const out = renderDiffMermaid(graph, changed, { level: "module" });
    expect(out).toContain('"src/new"');
    // every file in src/new is added → the module is added
    expect(out).toMatch(/class n\d+ added/);
    expect(out).not.toMatch(/class n\d+ modified/);
  });

  it("caps nodes and notes how many were dropped", () => {
    const changed = new Map<string, "added" | "modified">([
      ["src/a/foo.ts", "modified"],
      ["src/b/qux.ts", "added"],
    ]);
    const out = renderDiffMermaid(GRAPH, changed, { maxNodes: 2 });
    expect(out).toContain("more node(s) not shown");
  });
});
