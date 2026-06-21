import { describe, expect, it } from "vitest";
import {
  snapshotExternalDeps,
  snapshotSymbolEdges,
  snapshotSymbols,
  snapshotToAtlasGraph,
  type SnapshotLike,
} from "./adapter.js";

const snapshot: SnapshotLike = {
  nodes: [
    { id: "repo", type: "repo" },
    { id: "dir:src", type: "dir" },
    {
      id: "file:src/a.ts",
      type: "file",
      path: "src/a.ts",
      loc: 100,
      symbols: [
        {
          id: "symbol:src/a.ts:function:foo:1",
          name: "foo",
          kind: "function",
          loc: 40,
          exported: true,
        },
        { id: "symbol:src/a.ts:class:Bar:50", name: "Bar", kind: "class", loc: 30 },
      ],
    },
    {
      id: "file:src/b.ts",
      type: "file",
      path: "src/b.ts",
      loc: 50,
      symbols: [],
    },
  ],
  edges: [
    { type: "contains", from: "dir:src", to: "file:src/a.ts" },
    {
      type: "imports",
      from: "file:src/b.ts",
      to: "file:src/a.ts",
      resolved: true,
      symbolImports: [
        { toSymbolId: "symbol:src/a.ts:function:foo:1" },
        { toSymbolId: "symbol:src/a.ts:function:foo:1" },
        { toSymbolId: "symbol:src/a.ts:class:Bar:50" },
      ],
    },
    {
      type: "imports",
      from: "file:src/b.ts",
      to: "file:src/external.ts",
      resolved: false,
    },
    {
      type: "imports",
      from: "file:src/a.ts",
      to: "external:preact",
      specifier: "preact",
      resolved: true,
      external: true,
    },
    {
      type: "imports",
      from: "file:src/b.ts",
      to: "external:preact",
      specifier: "preact",
      resolved: true,
      external: true,
    },
  ],
};

describe("snapshotToAtlasGraph", () => {
  it("maps file nodes to AtlasNodes keyed by path", () => {
    const graph = snapshotToAtlasGraph(snapshot);
    expect(graph.nodes).toHaveLength(2);
    const a = graph.nodes.find((n) => n.id === "src/a.ts")!;
    expect(a.kind).toBe("file");
    expect(a.label).toBe("a.ts");
    expect(a.metrics.loc).toBe(100);
  });

  it("keeps only resolved import edges between known files", () => {
    const graph = snapshotToAtlasGraph(snapshot);
    // the edge carries the imported symbol names (deduped: foo appears twice)
    expect(graph.edges).toEqual([
      { source: "src/b.ts", target: "src/a.ts", refs: ["foo", "Bar"] },
    ]);
  });

  it("omits refs when an import names no symbols", () => {
    const graph = snapshotToAtlasGraph({
      nodes: [
        { id: "file:p.ts", type: "file", path: "p.ts", loc: 5, symbols: [] },
        { id: "file:q.ts", type: "file", path: "q.ts", loc: 5, symbols: [] },
      ],
      edges: [
        { type: "imports", from: "file:p.ts", to: "file:q.ts", resolved: true },
      ],
    });
    expect(graph.edges).toEqual([{ source: "p.ts", target: "q.ts" }]);
  });

  it("guards against zero-LOC files with a floor of 1", () => {
    const graph = snapshotToAtlasGraph({
      nodes: [{ id: "file:x.ts", type: "file", path: "x.ts", loc: 0, symbols: [] }],
      edges: [],
    });
    expect(graph.nodes[0]!.metrics.loc).toBe(1);
  });
});

describe("snapshotExternalDeps", () => {
  it("pairs each source file with the packages it imports", () => {
    expect(snapshotExternalDeps(snapshot)).toEqual([
      { source: "src/a.ts", specifier: "preact" },
      { source: "src/b.ts", specifier: "preact" },
    ]);
  });

  it("ignores resolved and unresolved relative imports", () => {
    const deps = snapshotExternalDeps({
      nodes: snapshot.nodes,
      edges: [
        { type: "imports", from: "file:src/b.ts", to: "file:src/a.ts", resolved: true },
      ],
    });
    expect(deps).toEqual([]);
  });
});

describe("snapshotSymbolEdges", () => {
  it("links the importing file to the imported symbols, deduped", () => {
    const edges = snapshotSymbolEdges(snapshot);
    expect(edges).toEqual([
      { source: "src/b.ts", target: "symbol:src/a.ts:function:foo:1" },
      { source: "src/b.ts", target: "symbol:src/a.ts:class:Bar:50" },
    ]);
  });

  it("ignores unresolved imports", () => {
    const edges = snapshotSymbolEdges({
      nodes: snapshot.nodes,
      edges: [
        {
          type: "imports",
          from: "file:src/b.ts",
          to: "file:src/x.ts",
          resolved: false,
          symbolImports: [{ toSymbolId: "symbol:x" }],
        },
      ],
    });
    expect(edges).toEqual([]);
  });
});

describe("snapshotSymbols", () => {
  it("maps real symbols per file and adds a remainder node", () => {
    const symbols = snapshotSymbols(snapshot);
    const a = symbols.get("src/a.ts")!;
    // foo(40) + Bar(30) + remainder(30)
    expect(a).toHaveLength(3);
    expect(a.map((s) => s.metrics.loc).reduce((x, y) => x + y, 0)).toBe(100);
    expect(a.find((s) => s.label === "foo")).toBeTruthy();
    expect(a.every((s) => s.kind === "symbol")).toBe(true);
  });

  it("carries the exported flag; fillers are never exported", () => {
    const symbols = snapshotSymbols(snapshot).get("src/a.ts")!;
    expect(symbols.find((s) => s.label === "foo")!.exported).toBe(true);
    expect(symbols.find((s) => s.label === "Bar")!.exported).toBe(false);
    expect(symbols.find((s) => s.id.endsWith("#rest"))!.exported).toBeFalsy();
  });

  it("represents files without symbols as a single node", () => {
    const symbols = snapshotSymbols(snapshot);
    const b = symbols.get("src/b.ts")!;
    expect(b).toHaveLength(1);
    expect(b[0]!.metrics.loc).toBe(50);
  });

  it("nests a test file's cases as cells, keeping the suite path in the label", () => {
    const withTests = {
      ...snapshot,
      nodes: [
        ...snapshot.nodes,
        { id: "file:src/a.test.ts", type: "file", path: "src/a.test.ts", loc: 5 },
      ],
      tests: {
        root: {
          id: "testroot",
          kind: "dir" as const,
          name: "",
          children: [
            {
              id: "testfile:src/a.test.ts",
              kind: "file" as const,
              name: "a.test.ts",
              file: "src/a.test.ts",
              children: [
                {
                  id: "suite:1",
                  kind: "suite" as const,
                  name: "math",
                  file: "src/a.test.ts",
                  startLine: 1,
                  children: [
                    {
                      id: "case:2",
                      kind: "case" as const,
                      name: "adds",
                      file: "src/a.test.ts",
                      startLine: 2,
                      endLine: 4,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    };
    const cells = snapshotSymbols(withTests).get("src/a.test.ts")!;
    const cell = cells.find((c) => c.id === "case:2")!;
    expect(cell.label).toBe("math › adds");
    expect(cell.kind).toBe("symbol");
    expect(cell.metrics.loc).toBe(3);
  });
});
