import { describe, expect, it } from "vitest";
import {
  affectedGroups,
  diffGraphs,
  isEmptyDelta,
  type GraphDelta,
} from "./delta.js";
import type { AtlasGraph } from "./graph.js";

const file = (id: string, loc: number, extra?: Partial<{ complexity: number; exported: boolean }>) => ({
  id,
  kind: "file" as const,
  label: id.split("/").pop()!,
  metrics: { loc, complexity: extra?.complexity },
  exported: extra?.exported,
});

const graph = (nodes: ReturnType<typeof file>[], edges: { source: string; target: string }[] = []): AtlasGraph => ({
  nodes,
  edges,
});

describe("diffGraphs", () => {
  it("treats every node as added when there is no previous graph", () => {
    const next = graph([file("a", 10), file("b", 20)]);
    const d = diffGraphs(null, next);
    expect(d.added.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(d.modified).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("detects added, removed, and untouched nodes", () => {
    const prev = graph([file("a", 10), file("b", 20)]);
    const next = graph([file("a", 10), file("c", 30)]);
    const d = diffGraphs(prev, next);
    expect(d.added.map((n) => n.id)).toEqual(["c"]);
    expect(d.removed).toEqual(["b"]);
    expect(d.modified).toEqual([]);
  });

  it("flags a node modified when loc, complexity, or exported changes", () => {
    const prev = graph([file("a", 10), file("b", 20, { complexity: 3 }), file("c", 5)]);
    const next = graph([
      file("a", 15), // loc changed
      file("b", 20, { complexity: 4 }), // complexity changed
      file("c", 5, { exported: true }), // exported changed
    ]);
    const d = diffGraphs(prev, next);
    expect(d.modified.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("does not flag an unchanged node", () => {
    const prev = graph([file("a", 10, { complexity: 2, exported: true })]);
    const next = graph([file("a", 10, { complexity: 2, exported: true })]);
    expect(diffGraphs(prev, next).modified).toEqual([]);
  });

  it("diffs edges by endpoint pair", () => {
    const prev = graph([file("a", 1), file("b", 1), file("c", 1)], [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ]);
    const next = graph([file("a", 1), file("b", 1), file("c", 1)], [
      { source: "b", target: "c" }, // kept
      { source: "a", target: "c" }, // added
    ]);
    const d = diffGraphs(prev, next);
    expect(d.edgesAdded.map((e) => `${e.source}>${e.target}`)).toEqual(["a>c"]);
    expect(d.edgesRemoved.map((e) => `${e.source}>${e.target}`)).toEqual(["a>b"]);
  });
});

describe("isEmptyDelta", () => {
  it("is true only when nothing changed", () => {
    const same = graph([file("a", 10)], [{ source: "a", target: "a" }]);
    expect(isEmptyDelta(diffGraphs(same, same))).toBe(true);
    const next = graph([file("a", 11)], [{ source: "a", target: "a" }]);
    expect(isEmptyDelta(diffGraphs(same, next))).toBe(false);
  });
});

describe("affectedGroups", () => {
  const groupOf = (id: string) => (id === "ghost" ? null : id.split("/")[0]!);

  it("collects the groups of every changed node and edge endpoint", () => {
    const delta: GraphDelta = {
      added: [file("alpha/new.ts", 5)],
      modified: [file("beta/x.ts", 9)],
      removed: ["gamma/old.ts"],
      edgesAdded: [{ source: "delta/a.ts", target: "epsilon/b.ts" }],
      edgesRemoved: [],
    };
    expect([...affectedGroups(delta, groupOf)].sort()).toEqual([
      "alpha",
      "beta",
      "delta",
      "epsilon",
      "gamma",
    ]);
  });

  it("ignores ids with no group", () => {
    const delta: GraphDelta = {
      added: [],
      modified: [],
      removed: ["ghost"],
      edgesAdded: [],
      edgesRemoved: [],
    };
    expect(affectedGroups(delta, groupOf).size).toBe(0);
  });
});
