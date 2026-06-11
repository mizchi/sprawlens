import { describe, expect, it } from "vitest";
import type { AtlasEdge, AtlasGraph, AtlasNode } from "../contracts/graph.js";
import { apiModuleIdOf, buildApiGraph } from "./apiView.js";

const fileGraph: AtlasGraph = {
  nodes: [
    { id: "src/core/a.ts", kind: "file", label: "a.ts", metrics: { loc: 100 } },
    { id: "src/core/b.ts", kind: "file", label: "b.ts", metrics: { loc: 50 } },
    { id: "src/ui/v.tsx", kind: "file", label: "v.tsx", metrics: { loc: 80 } },
  ],
  edges: [],
};

const symbolsOf = new Map<string, AtlasNode[]>([
  [
    "src/core/a.ts",
    [
      sym("symbol:src/core/a.ts:function:foo:1", "foo", true),
      sym("symbol:src/core/a.ts:function:hidden:30", "hidden", false),
      sym("symbol:src/core/a.ts:class:Bar:60", "Bar", true),
    ],
  ],
  ["src/core/b.ts", [sym("symbol:src/core/b.ts:function:only:1", "only", true)]],
  ["src/ui/v.tsx", [sym("symbol:src/ui/v.tsx:function:View:1", "View", true)]],
]);

function sym(id: string, label: string, exported: boolean): AtlasNode {
  return { id, kind: "symbol", label, metrics: { loc: 40 }, exported };
}

const symbolEdges: AtlasEdge[] = [
  // direct public→public
  {
    source: "symbol:src/ui/v.tsx:function:View:1",
    target: "symbol:src/core/a.ts:function:foo:1",
  },
  // private source: dropped (not a node)
  {
    source: "symbol:src/core/a.ts:function:hidden:30",
    target: "symbol:src/core/b.ts:function:only:1",
  },
  // file source with exactly one export: lifted to that symbol
  {
    source: "src/core/b.ts",
    target: "symbol:src/core/a.ts:class:Bar:60",
  },
  // file source with two exports: ambiguous, dropped
  {
    source: "src/core/a.ts",
    target: "symbol:src/core/b.ts:function:only:1",
  },
];

describe("buildApiGraph", () => {
  it("keeps only exported symbols", () => {
    const api = buildApiGraph(fileGraph, (id) => symbolsOf.get(id) ?? [], symbolEdges);
    expect(api.nodes.map((n) => n.label).sort()).toEqual([
      "Bar",
      "View",
      "foo",
      "only",
    ]);
    expect(api.nodes.every((n) => n.exported === true)).toBe(true);
  });

  it("weights symbols by PageRank: depended-upon APIs grow", () => {
    const api = buildApiGraph(fileGraph, (id) => symbolsOf.get(id) ?? [], symbolEdges);
    const weight = (label: string) =>
      api.nodes.find((n) => n.label === label)!.metrics.loc;
    // foo (referenced by View) and Bar (referenced by only) outrank
    // their referrers; mean weight stays 1
    expect(weight("foo")).toBeGreaterThan(weight("View"));
    expect(weight("Bar")).toBeGreaterThan(weight("only"));
    const mean =
      api.nodes.reduce((s, n) => s + n.metrics.loc, 0) / api.nodes.length;
    expect(mean).toBeCloseTo(1, 6);
    expect(api.nodes.every((n) => n.metrics.loc > 0)).toBe(true);
  });

  it("keeps direct public edges and lifts single-export file sources", () => {
    const api = buildApiGraph(fileGraph, (id) => symbolsOf.get(id) ?? [], symbolEdges);
    expect(api.edges).toEqual([
      {
        source: "symbol:src/ui/v.tsx:function:View:1",
        target: "symbol:src/core/a.ts:function:foo:1",
      },
      {
        source: "symbol:src/core/b.ts:function:only:1",
        target: "symbol:src/core/a.ts:class:Bar:60",
      },
    ]);
  });
});

describe("apiModuleIdOf", () => {
  it("groups symbols by their parent file's module", () => {
    expect(apiModuleIdOf("symbol:src/core/a.ts:function:foo:1")).toBe(
      "src/core",
    );
    expect(apiModuleIdOf("packages/x/f.ts#s1")).toBe("packages/x");
  });
});
