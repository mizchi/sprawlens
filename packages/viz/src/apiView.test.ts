import { describe, expect, it } from "vitest";
import type { AtlasEdge, AtlasGraph, AtlasNode } from "@sprawlens/schema";
import {
  apiModuleIdOf,
  applySymbolBudget,
  buildApiGraph,
  moduleScopeId,
  splitApiBoundary,
} from "./apiView.ts";

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
    expect(api.nodes.map((n) => n.label).sort()).toEqual(["Bar", "View", "foo", "only"]);
    expect(api.nodes.every((n) => n.exported === true)).toBe(true);
  });

  it("weights symbols by the complexity they transitively pull in", () => {
    const api = buildApiGraph(fileGraph, (id) => symbolsOf.get(id) ?? [], symbolEdges);
    const weight = (label: string) => api.nodes.find((n) => n.label === label)!.metrics.loc;
    // View references foo, only references Bar — the referrer carries its
    // own complexity plus everything downstream
    expect(weight("View")).toBeGreaterThan(weight("foo"));
    expect(weight("only")).toBeGreaterThan(weight("Bar"));
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

describe("buildApiGraph options", () => {
  it("weight: loc keeps each symbol's own LOC as its area", () => {
    const api = buildApiGraph(fileGraph, (id) => symbolsOf.get(id) ?? [], symbolEdges, {
      weight: "loc",
    });
    expect(api.nodes.every((n) => n.metrics.loc === 40)).toBe(true);
  });

  it("includePrivate keeps non-exported symbols and their edges", () => {
    const api = buildApiGraph(fileGraph, (id) => symbolsOf.get(id) ?? [], symbolEdges, {
      includePrivate: true,
    });
    expect(api.nodes.map((n) => n.label).sort()).toEqual(["Bar", "View", "foo", "hidden", "only"]);
    // the private-source edge survives because both endpoints are nodes now
    expect(api.edges).toContainEqual({
      source: "symbol:src/core/a.ts:function:hidden:30",
      target: "symbol:src/core/b.ts:function:only:1",
    });
  });
});

describe("splitApiBoundary", () => {
  it("moves externally-referenced symbols to the module boundary", () => {
    const api = buildApiGraph(fileGraph, (id) => symbolsOf.get(id) ?? [], symbolEdges);
    // View (src/ui) → foo (src/core) is the only cross-module edge:
    // foo becomes src/core's boundary port; everything else stays internal
    const split = splitApiBoundary(api, apiModuleIdOf);
    expect(split.boundaryByModule.get("src/core")!.map((n) => n.label)).toEqual(["foo"]);
    expect(split.internal.nodes.map((n) => n.label).sort()).toEqual(["Bar", "View", "only"]);
    // internal layout edges keep only internal↔internal pairs
    expect(split.internal.edges).toEqual([
      {
        source: "symbol:src/core/b.ts:function:only:1",
        target: "symbol:src/core/a.ts:class:Bar:60",
      },
    ]);
  });
});

describe("splitApiBoundary with raw edges", () => {
  it("marks targets of ambiguous cross-module references as boundary", () => {
    const api = buildApiGraph(fileGraph, (id) => symbolsOf.get(id) ?? [], symbolEdges);
    // src/core/a.ts has two exports, so this file-source reference was
    // dropped from the projection — but it still proves `only` is used
    // from another module
    const raw = [{ source: "src/ui/v.tsx", target: "symbol:src/core/b.ts:function:only:1" }];
    const split = splitApiBoundary(api, apiModuleIdOf, raw);
    expect(
      split.boundaryByModule
        .get("src/core")!
        .map((n) => n.label)
        .sort(),
    ).toEqual(["foo", "only"]);
  });
});

describe("apiModuleIdOf", () => {
  it("groups symbols by their parent file's module", () => {
    expect(apiModuleIdOf("symbol:src/core/a.ts:function:foo:1")).toBe("src/core");
    expect(apiModuleIdOf("packages/x/f.ts#s1")).toBe("packages/x");
  });
});

describe("applySymbolBudget", () => {
  const big: AtlasGraph = {
    nodes: Array.from({ length: 10 }, (_, i) => ({
      id: `symbol:src/core/a.ts:function:f${i}:${i}`,
      kind: "symbol" as const,
      label: `f${i}`,
      metrics: { loc: i + 1 }, // f9 heaviest
    })),
    edges: [
      {
        source: "symbol:src/core/a.ts:function:f9:9",
        target: "symbol:src/core/a.ts:function:f8:8",
      },
      {
        source: "symbol:src/core/a.ts:function:f0:0",
        target: "symbol:src/core/a.ts:function:f1:1",
      },
    ],
  };

  it("returns the graph unchanged when under budget", () => {
    expect(applySymbolBudget(big, { budget: 10 })).toBe(big);
    expect(applySymbolBudget(big, { budget: 99 })).toBe(big);
  });

  it("keeps the top-weight symbols and folds the rest into a module filler", () => {
    const out = applySymbolBudget(big, { budget: 3 });
    const ids = out.nodes.map((n) => n.id);
    // f9, f8, f7 are heaviest; the rest collapse into one filler
    expect(ids).toContain("symbol:src/core/a.ts:function:f9:9");
    expect(ids).toContain("symbol:src/core/a.ts:function:f7:7");
    expect(ids).not.toContain("symbol:src/core/a.ts:function:f0:0");
    const filler = out.nodes.find((n) => n.id === moduleScopeId("src/core"));
    expect(filler).toBeDefined();
    expect(filler!.label).toBe("(module scope)");
    // dropped f0..f6 area (1+2+..+7 = 28) preserved in the filler
    expect(filler!.metrics.loc).toBe(28);
    expect(out.nodes).toHaveLength(4); // 3 kept + 1 filler
  });

  it("drops the folded filler entirely when dropFolded is set", () => {
    const out = applySymbolBudget(big, { budget: 3, dropFolded: true });
    expect(out.nodes).toHaveLength(3); // 3 kept, no filler
    expect(out.nodes.find((n) => n.id === moduleScopeId("src/core"))).toBeUndefined();
    expect(out.nodes.every((n) => n.label !== "(module scope)")).toBe(true);
  });

  it("honors a custom priority (focus weighting overrides size)", () => {
    // prioritize the lightest symbols
    const out = applySymbolBudget(big, {
      budget: 2,
      priorityOf: (_, w) => -w,
    });
    const ids = out.nodes.map((n) => n.id);
    expect(ids).toContain("symbol:src/core/a.ts:function:f0:0");
    expect(ids).toContain("symbol:src/core/a.ts:function:f1:1");
    expect(ids).not.toContain("symbol:src/core/a.ts:function:f9:9");
  });

  it("drops edges that touch a budgeted-out symbol", () => {
    const out = applySymbolBudget(big, { budget: 3 });
    // f9->f8 survives (both kept); f0->f1 is gone (both dropped)
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0]!.source).toBe("symbol:src/core/a.ts:function:f9:9");
  });
});
