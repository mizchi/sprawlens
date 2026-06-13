import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "./graph.js";
import {
  ancestorAt,
  classGrouping,
  deriveLevels,
  directoryGrouping,
  fileGrouping,
  moduleGrouping,
  parentFileOf,
  serviceGrouping,
} from "./hierarchy.js";

function fileGraph(): AtlasGraph {
  const file = (id: string, loc: number) => ({
    id,
    kind: "file" as const,
    label: id.split("/").pop()!,
    metrics: { loc },
  });
  return {
    nodes: [
      file("src/alpha/core/a.ts", 100),
      file("src/alpha/core/b.ts", 50),
      file("src/alpha/util/c.ts", 30),
      file("src/alpha/root.ts", 20),
      file("src/beta/core/d.ts", 200),
    ],
    edges: [
      { source: "src/alpha/core/a.ts", target: "src/alpha/core/b.ts" },
      { source: "src/alpha/core/a.ts", target: "src/alpha/util/c.ts" },
      { source: "src/alpha/util/c.ts", target: "src/beta/core/d.ts" },
      { source: "src/alpha/root.ts", target: "src/beta/core/d.ts" },
    ],
  };
}

describe("parentFileOf", () => {
  it("extracts the file from symbol id schemes", () => {
    expect(parentFileOf("symbol:src/a.ts:fn:foo:3")).toBe("src/a.ts");
    expect(parentFileOf("src/a.ts#s2")).toBe("src/a.ts");
    expect(parentFileOf("src/a.ts")).toBe("src/a.ts");
  });
});

describe("groupings", () => {
  it("moduleGrouping maps files and symbols to their module", () => {
    const g = moduleGrouping();
    expect(g.kind).toBe("module");
    expect(g.groupOf("src/alpha/core/a.ts")).toBe("src/alpha");
    expect(g.groupOf("symbol:src/alpha/core/a.ts:fn:f:1")).toBe("src/alpha");
  });

  it("directoryGrouping truncates the dirname to maxDepth segments", () => {
    const g = directoryGrouping(3);
    expect(g.groupOf("src/alpha/core/deep/a.ts")).toBe("src/alpha/core");
    expect(g.groupOf("src/alpha/core/a.ts")).toBe("src/alpha/core");
    expect(g.groupOf("src/alpha/a.ts")).toBe("src/alpha");
    expect(g.groupOf("top.ts")).toBe("(root)");
  });

  it("fileGrouping groups symbols under their file", () => {
    expect(fileGrouping().groupOf("symbol:src/a.ts:fn:f:1")).toBe("src/a.ts");
  });

  it("serviceGrouping delegates to the provided mapping", () => {
    const g = serviceGrouping((fileId) =>
      fileId.startsWith("src/alpha") ? "svc-alpha" : "svc-beta",
    );
    expect(g.kind).toBe("service");
    expect(g.groupOf("symbol:src/alpha/core/a.ts:fn:f:1")).toBe("svc-alpha");
    expect(g.groupOf("src/beta/core/d.ts")).toBe("svc-beta");
  });
});

describe("deriveLevels — single boundary", () => {
  const tree = deriveLevels(fileGraph(), [moduleGrouping()]);

  it("aggregates group nodes with summed loc", () => {
    expect(tree.levels).toHaveLength(1);
    const modules = new Map(tree.levels[0]!.nodes.map((n) => [n.id, n]));
    expect(modules.get("src/alpha")!.metrics.loc).toBe(200);
    expect(modules.get("src/beta")!.metrics.loc).toBe(200);
    expect(modules.get("src/alpha")!.kind).toBe("module");
  });

  it("lifts cross-group edges with aggregated weight", () => {
    expect(tree.levels[0]!.edges).toEqual([
      { source: "src/alpha", target: "src/beta", weight: 2, kind: undefined },
    ]);
  });

  it("keeps intra-group leaf edges in innerEdgesOf", () => {
    expect(tree.innerEdgesOf.get("src/alpha")).toEqual([
      { source: "src/alpha/core/a.ts", target: "src/alpha/core/b.ts" },
      { source: "src/alpha/core/a.ts", target: "src/alpha/util/c.ts" },
    ]);
  });

  it("links parents and children", () => {
    expect(tree.parentOf.get("src/alpha")).toBeNull();
    expect(tree.parentOf.get("src/alpha/core/a.ts")).toBe("src/alpha");
    expect(tree.childrenOf.get("src/alpha")!.map((n) => n.id)).toEqual([
      "src/alpha/core/a.ts",
      "src/alpha/core/b.ts",
      "src/alpha/util/c.ts",
      "src/alpha/root.ts",
    ]);
  });
});

describe("deriveLevels — edge refs", () => {
  const graph: AtlasGraph = {
    nodes: [
      { id: "src/a/x.ts", kind: "file", label: "x", metrics: { loc: 10 } },
      { id: "src/a/y.ts", kind: "file", label: "y", metrics: { loc: 10 } },
      { id: "src/b/z.ts", kind: "file", label: "z", metrics: { loc: 10 } },
    ],
    edges: [
      { source: "src/a/x.ts", target: "src/b/z.ts", refs: ["foo", "bar"] },
      { source: "src/a/y.ts", target: "src/b/z.ts", refs: ["bar", "baz"] },
    ],
  };

  it("unions the refs of every edge folded into a lifted edge", () => {
    const tree = deriveLevels(graph, [moduleGrouping()]);
    const lifted = tree.levels[0]!.edges[0]!;
    expect(lifted.source).toBe("src/a");
    expect(lifted.target).toBe("src/b");
    expect(lifted.weight).toBe(2);
    expect([...lifted.refs!].sort()).toEqual(["bar", "baz", "foo"]);
  });

  it("omits refs when no contributing edge carries any", () => {
    const tree = deriveLevels(fileGraph(), [moduleGrouping()]);
    expect(tree.levels[0]!.edges[0]!.refs).toBeUndefined();
  });
});

describe("deriveLevels — module + directory", () => {
  const tree = deriveLevels(fileGraph(), [moduleGrouping(), directoryGrouping(3)]);

  it("nests directory groups inside modules", () => {
    expect(tree.levels.map((l) => l.kind)).toEqual(["module", "directory"]);
    expect(tree.parentOf.get("src/alpha/core")).toBe("src/alpha");
    expect(tree.parentOf.get("src/alpha/core/a.ts")).toBe("src/alpha/core");
    expect(tree.kindOf.get("src/alpha/core")).toBe("directory");
  });

  it("synthesizes a (root) group when a leaf sits at the parent boundary", () => {
    // src/alpha/root.ts: directory == module path → synthetic nested group
    const dir = tree.parentOf.get("src/alpha/root.ts")!;
    expect(dir).toBe("src/alpha/(root)");
    expect(tree.parentOf.get(dir)).toBe("src/alpha");
  });

  it("module-level children are the directory group nodes", () => {
    const ids = tree.childrenOf.get("src/alpha")!.map((n) => n.id);
    expect(ids).toEqual(["src/alpha/core", "src/alpha/util", "src/alpha/(root)"]);
    const core = tree.childrenOf.get("src/alpha")!.find((n) => n.id === "src/alpha/core")!;
    expect(core.metrics.loc).toBe(150);
  });

  it("intra-module directory edges land in the module's innerEdgesOf", () => {
    expect(tree.innerEdgesOf.get("src/alpha")).toEqual([
      {
        source: "src/alpha/core",
        target: "src/alpha/util",
        weight: 1,
        kind: undefined,
      },
    ]);
  });

  it("directory level edges include cross-module ones", () => {
    const dirEdges = tree.levels[1]!.edges;
    expect(dirEdges).toContainEqual({
      source: "src/alpha/util",
      target: "src/beta/core",
      weight: 1,
      kind: undefined,
    });
  });

  it("innermost groups keep raw leaf edges", () => {
    expect(tree.innerEdgesOf.get("src/alpha/core")).toEqual([
      { source: "src/alpha/core/a.ts", target: "src/alpha/core/b.ts" },
    ]);
  });
});

describe("deriveLevels — native edges", () => {
  it("injects native edges at the matching level", () => {
    const services = serviceGrouping((id) =>
      id.startsWith("src/alpha") ? "svc-alpha" : "svc-beta",
    );
    const tree = deriveLevels(fileGraph(), [services, moduleGrouping()], {
      nativeEdges: new Map([
        [
          "service",
          [
            { source: "svc-alpha", target: "svc-beta", kind: "call" as const },
            { source: "svc-alpha", target: "svc-unknown", kind: "call" as const },
          ],
        ],
      ]),
    });
    const serviceEdges = tree.levels[0]!.edges;
    // lifted code edges and the native call edge coexist
    expect(serviceEdges).toContainEqual({
      source: "svc-alpha",
      target: "svc-beta",
      weight: 2,
      kind: undefined,
    });
    expect(serviceEdges).toContainEqual({
      source: "svc-alpha",
      target: "svc-beta",
      kind: "call",
    });
    // unknown endpoints are dropped
    expect(
      serviceEdges.some((e) => e.target === "svc-unknown"),
    ).toBe(false);
  });

  it("preserves a uniform kind through lifting", () => {
    const graph: AtlasGraph = {
      nodes: [
        { id: "src/a/x.ts", kind: "file", label: "x", metrics: { loc: 1 } },
        { id: "src/b/y.ts", kind: "file", label: "y", metrics: { loc: 1 } },
      ],
      edges: [
        { source: "src/a/x.ts", target: "src/b/y.ts", kind: "import" },
      ],
    };
    const tree = deriveLevels(graph, [moduleGrouping()]);
    expect(tree.levels[0]!.edges[0]!.kind).toBe("import");
  });
});

describe("deriveLevels — degenerate group ids", () => {
  it("wraps a group whose id equals the leaf id (file boundary on files)", () => {
    const graph: AtlasGraph = {
      nodes: [
        { id: "src/a/x.ts", kind: "file", label: "x", metrics: { loc: 1 } },
      ],
      edges: [],
    };
    const tree = deriveLevels(graph, [moduleGrouping(), fileGrouping()]);
    const parent = tree.parentOf.get("src/a/x.ts")!;
    expect(parent).toBe("src/a/x.ts/(root)");
    expect(tree.parentOf.get(parent)).toBe("src/a");
  });
});

describe("deriveLevels — no boundaries", () => {
  it("yields an empty tree where leaves are roots", () => {
    const tree = deriveLevels(fileGraph(), []);
    expect(tree.levels).toEqual([]);
    expect(tree.parentOf.get("src/alpha/core/a.ts")).toBeNull();
  });
});

describe("ancestorAt", () => {
  const tree = deriveLevels(fileGraph(), [moduleGrouping(), directoryGrouping(3)]);

  it("walks a leaf up to the requested level kind", () => {
    expect(ancestorAt(tree, "src/alpha/core/a.ts", "directory")).toBe(
      "src/alpha/core",
    );
    expect(ancestorAt(tree, "src/alpha/core/a.ts", "module")).toBe("src/alpha");
  });

  it("returns a group itself when it already has the kind", () => {
    expect(ancestorAt(tree, "src/alpha/core", "directory")).toBe("src/alpha/core");
  });

  it("returns null for unknown ids or missing levels", () => {
    expect(ancestorAt(tree, "nope.ts", "module")).toBeNull();
    expect(ancestorAt(tree, "src/alpha/core/a.ts", "service")).toBeNull();
  });
});

describe("classGrouping", () => {
  const g = classGrouping();
  it("groups a class declaration and its members together", () => {
    const cls = "symbol:src/a.ts:class:Widget:5";
    const method = "symbol:src/a.ts:method:Widget.render:7";
    const staticProp = "symbol:src/a.ts:static-property:Widget.count:6";
    expect(g.groupOf(cls)).toBe("class:src/a.ts:Widget");
    expect(g.groupOf(method)).toBe("class:src/a.ts:Widget");
    expect(g.groupOf(staticProp)).toBe("class:src/a.ts:Widget");
    expect(g.labelOf!(g.groupOf(cls))).toBe("Widget");
  });
  it("buckets a non-class top-level symbol by its parent file", () => {
    // a shared file bucket (not a per-symbol singleton) keeps loose symbols
    // in a melting leaf layout instead of a frozen intermediate district
    const fn = "symbol:src/a.ts:function:helper:1";
    const other = "symbol:src/a.ts:variable:CONST:9";
    expect(g.groupOf(fn)).toBe("src/a.ts");
    expect(g.groupOf(other)).toBe("src/a.ts");
  });
});
