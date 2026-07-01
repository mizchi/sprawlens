import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import {
  cycles,
  dependencies,
  dependents,
  describe as describeNode,
  find,
  impact,
  indexGraph,
  lens,
  path,
  resolve,
  structure,
} from "./graphQuery.ts";

const file = (id: string, loc = 10) => ({
  id,
  kind: "file" as const,
  label: id.split("/").pop()!,
  metrics: { loc },
});
const sym = (id: string, label: string) => ({
  id,
  kind: "symbol" as const,
  label,
  metrics: { loc: 3 },
  symbolKind: "function" as const,
});

// modules: src/app (main, util), src/core (lib), src/db (store)
// deps (source depends on target): main→util, main→lib, util→lib, lib→store
const graph: AtlasGraph = {
  nodes: [
    file("src/app/main.ts"),
    file("src/app/util.ts"),
    file("src/core/lib.ts"),
    file("src/db/store.ts"),
    sym("symbol:src/app/main.ts:function:run:1", "run"),
    sym("symbol:src/core/lib.ts:function:load:1", "load"),
    sym("symbol:src/db/store.ts:function:read:1", "read"),
  ],
  edges: [
    { source: "src/app/main.ts", target: "src/app/util.ts", kind: "import" },
    { source: "src/app/main.ts", target: "src/core/lib.ts" },
    { source: "src/app/util.ts", target: "src/core/lib.ts" },
    { source: "src/core/lib.ts", target: "src/db/store.ts" },
    {
      source: "symbol:src/app/main.ts:function:run:1",
      target: "symbol:src/core/lib.ts:function:load:1",
    },
    {
      source: "symbol:src/core/lib.ts:function:load:1",
      target: "symbol:src/db/store.ts:function:read:1",
    },
  ],
};

const idx = indexGraph(graph);

describe("indexGraph + resolve", () => {
  it("derives modules from the file tree", () => {
    expect([...idx.moduleIds].sort()).toEqual(["src/app", "src/core", "src/db"]);
  });

  it("resolves a module id to module level and a symbol to symbol level", () => {
    expect(resolve(idx, "src/app")).toEqual({ level: "module", key: "src/app" });
    expect(resolve(idx, "src/app/util.ts")).toEqual({ level: "file", key: "src/app/util.ts" });
    expect(resolve(idx, "symbol:src/app/main.ts:function:run:1")).toEqual({
      level: "symbol",
      key: "symbol:src/app/main.ts:function:run:1",
    });
    expect(resolve(idx, "nope")).toBeNull();
  });
});

describe("dependencies / dependents", () => {
  it("returns a file's direct dependencies (forward)", () => {
    const d = dependencies(idx, "src/app/main.ts");
    expect(d?.items.map((i) => i.id).sort()).toEqual(["src/app/util.ts", "src/core/lib.ts"]);
  });

  it("walks transitively with depth", () => {
    const d = dependencies(idx, "src/app/main.ts", 5);
    expect(d?.items.map((i) => i.id).sort()).toEqual([
      "src/app/util.ts",
      "src/core/lib.ts",
      "src/db/store.ts",
    ]);
    expect(d?.items.find((i) => i.id === "src/db/store.ts")?.depth).toBe(2);
  });

  it("folds to modules when the target is a module", () => {
    const d = dependencies(idx, "src/app");
    expect(d?.level).toBe("module");
    expect(d?.items.map((i) => i.id).sort()).toEqual(["src/core"]);
  });

  it("returns dependents (backward)", () => {
    const d = dependents(idx, "src/core/lib.ts");
    expect(d?.items.map((i) => i.id).sort()).toEqual(["src/app/main.ts", "src/app/util.ts"]);
  });
});

describe("impact", () => {
  it("is the full upstream closure", () => {
    const i = impact(idx, "src/db/store.ts");
    expect(i?.items.map((x) => x.id).sort()).toEqual([
      "src/app/main.ts",
      "src/app/util.ts",
      "src/core/lib.ts",
    ]);
  });
});

describe("lens", () => {
  it("returns a query-focused subgraph with dependencies, dependents, and signals", () => {
    const r = lens(idx, "src/core/lib.ts", {
      direction: "both",
      depth: 1,
      changed: new Map([["src/app/main.ts", "modified"]]),
    });
    expect(r?.target).toBe("src/core/lib.ts");
    expect(r?.nodes.map((n) => n.id)).toEqual([
      "src/core/lib.ts",
      "src/app/main.ts",
      "src/app/util.ts",
      "src/db/store.ts",
    ]);
    expect(r?.nodes.find((n) => n.id === "src/core/lib.ts")?.role).toBe("target");
    expect(r?.nodes.find((n) => n.id === "src/db/store.ts")?.role).toBe("dependency");
    expect(r?.nodes.find((n) => n.id === "src/app/main.ts")?.role).toBe("dependent");
    expect(r?.nodes.find((n) => n.id === "src/app/main.ts")?.changed).toBe("modified");
    expect(r?.edges.map((e) => `${e.source}->${e.target}`).sort()).toEqual([
      "src/app/main.ts->src/app/util.ts",
      "src/app/main.ts->src/core/lib.ts",
      "src/app/util.ts->src/core/lib.ts",
      "src/core/lib.ts->src/db/store.ts",
    ]);
    expect(r?.summary).toMatchObject({ dependencies: 1, dependents: 2, changed: 1 });
  });

  it("folds changed file signals to module lenses", () => {
    const r = lens(idx, "src/core", {
      direction: "dependents",
      changed: new Map([["src/app/main.ts", "added"]]),
    });
    expect(r?.level).toBe("module");
    expect(r?.nodes.find((n) => n.id === "src/app")?.changed).toBe("added");
  });

  it("runs at symbol level and carries trace/test evidence", () => {
    const r = lens(idx, "symbol:src/core/lib.ts:function:load:1", {
      traceHeat: new Map([["symbol:src/core/lib.ts:function:load:1", 0.8]]),
      testSignals: new Map([
        [
          "symbol:src/core/lib.ts:function:load:1",
          [{ id: "test:src/core/lib.test.ts:3:loads", status: "fail", durationMs: 12 }],
        ],
      ]),
    });
    expect(r?.level).toBe("symbol");
    expect(r?.nodes.map((n) => n.id)).toEqual([
      "symbol:src/core/lib.ts:function:load:1",
      "symbol:src/app/main.ts:function:run:1",
      "symbol:src/db/store.ts:function:read:1",
    ]);
    const target = r?.nodes.find((n) => n.role === "target");
    expect(target?.traceHeat).toBe(0.8);
    expect(target?.tests?.[0]).toMatchObject({ status: "fail" });
    expect(r?.summary).toMatchObject({ traced: 1, tests: { fail: 1, total: 1 } });
  });

  it("keeps symbol and parent-file change signals on symbol lenses", () => {
    const r = lens(idx, "symbol:src/core/lib.ts:function:load:1", {
      changed: new Map([
        ["symbol:src/core/lib.ts:function:load:1", "modified"],
        ["src/db/store.ts", "added"],
      ]),
    });
    expect(r?.nodes.find((n) => n.id === "symbol:src/core/lib.ts:function:load:1")?.changed).toBe(
      "modified",
    );
    expect(r?.nodes.find((n) => n.id === "symbol:src/db/store.ts:function:read:1")?.changed).toBe(
      "added",
    );
  });
});

describe("structure", () => {
  it("lists top-level modules with file counts at the root", () => {
    const s = structure(idx);
    expect(s.level).toBe("root");
    expect(s.entries.find((e) => e.id === "src/app")?.children).toBe(2);
  });

  it("lists a module's files", () => {
    const s = structure(idx, "src/app");
    expect(s.entries.map((e) => e.id).sort()).toEqual(["src/app/main.ts", "src/app/util.ts"]);
  });

  it("lists a file's symbols", () => {
    const s = structure(idx, "src/app/main.ts");
    expect(s.level).toBe("file");
    expect(s.entries.map((e) => e.label)).toEqual(["run"]);
  });
});

describe("describe", () => {
  it("reports kind, module, and degree", () => {
    const d = describeNode(idx, "src/core/lib.ts");
    expect(d?.kind).toBe("file");
    expect(d?.module).toBe("src/core");
    expect(d?.dependsOn).toBe(1); // → store
    expect(d?.dependedOnBy).toBe(2); // main, util
  });
});

describe("path", () => {
  it("finds a dependency path", () => {
    expect(path(idx, "src/app/main.ts", "src/db/store.ts")).toEqual([
      "src/app/main.ts",
      "src/core/lib.ts",
      "src/db/store.ts",
    ]);
  });

  it("is null when unreachable in the dependency direction", () => {
    expect(path(idx, "src/db/store.ts", "src/app/main.ts")).toBeNull();
  });
});

describe("cycles", () => {
  it("finds none in an acyclic graph", () => {
    expect(cycles(idx)).toEqual([]);
  });

  it("detects a module cycle", () => {
    const cyclic = indexGraph({
      nodes: [file("src/a/x.ts"), file("src/b/y.ts")],
      edges: [
        { source: "src/a/x.ts", target: "src/b/y.ts" },
        { source: "src/b/y.ts", target: "src/a/x.ts" },
      ],
    });
    const c = cycles(cyclic);
    expect(c).toHaveLength(1);
    expect(c[0]!.sort()).toEqual(["src/a", "src/b"]);
  });
});

describe("find", () => {
  it("ranks an exact label match first", () => {
    expect(find(idx, "lib.ts")[0]?.id).toBe("src/core/lib.ts");
  });

  it("matches modules too", () => {
    expect(find(idx, "src/app").some((r) => r.id === "src/app" && r.kind === "module")).toBe(true);
  });
});
