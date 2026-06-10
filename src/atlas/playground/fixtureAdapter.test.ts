import { describe, expect, it } from "vitest";
import {
  snapshotSymbols,
  snapshotToAtlasGraph,
  type SnapshotLike,
} from "./fixtureAdapter.js";

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
        { id: "symbol:src/a.ts:function:foo:1", name: "foo", kind: "function", loc: 40 },
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
    },
    {
      type: "imports",
      from: "file:src/b.ts",
      to: "file:src/external.ts",
      resolved: false,
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
    expect(graph.edges).toEqual([{ source: "src/b.ts", target: "src/a.ts" }]);
  });

  it("guards against zero-LOC files with a floor of 1", () => {
    const graph = snapshotToAtlasGraph({
      nodes: [{ id: "file:x.ts", type: "file", path: "x.ts", loc: 0, symbols: [] }],
      edges: [],
    });
    expect(graph.nodes[0]!.metrics.loc).toBe(1);
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

  it("represents files without symbols as a single node", () => {
    const symbols = snapshotSymbols(snapshot);
    const b = symbols.get("src/b.ts")!;
    expect(b).toHaveLength(1);
    expect(b[0]!.metrics.loc).toBe(50);
  });
});
