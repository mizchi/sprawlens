import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "../contracts/graph.js";
import { buildHistoryIndex, diffGraphs, type HistoryEntry } from "./history.js";

function graphOf(files: [string, number][]): AtlasGraph {
  return {
    nodes: files.map(([id, loc]) => ({
      id,
      kind: "file" as const,
      label: id,
      metrics: { loc },
    })),
    edges: [],
  };
}

describe("diffGraphs", () => {
  const prev = graphOf([
    ["a.ts", 100],
    ["b.ts", 50],
    ["gone.ts", 10],
  ]);
  const next = graphOf([
    ["a.ts", 100], // unchanged
    ["b.ts", 80], // modified
    ["new.ts", 30], // added
  ]);

  it("classifies added and modified files and counts removals", () => {
    const diff = diffGraphs(prev, next);
    expect(diff.changed.get("new.ts")).toBe("added");
    expect(diff.changed.get("b.ts")).toBe("modified");
    expect(diff.changed.has("a.ts")).toBe(false);
    expect(diff.removed).toEqual(["gone.ts"]);
  });

  it("treats everything as unchanged when prev is null", () => {
    const diff = diffGraphs(null, next);
    expect(diff.changed.size).toBe(0);
    expect(diff.removed).toEqual([]);
  });
});

describe("buildHistoryIndex", () => {
  const entry = (
    hash: string,
    files: [string, number][],
  ): HistoryEntry => ({
    hash,
    shortHash: hash,
    message: hash,
    timestamp: "",
    snapshot: {
      nodes: files.map(([path, loc]) => ({
        id: `file:${path}`,
        type: "file",
        path,
        loc,
        symbols: [],
      })),
      edges: [],
    },
  });
  const entries = [
    entry("c0", [["a.ts", 10]]),
    entry("c1", [["a.ts", 20], ["b.ts", 5]]), // a modified, b added
    entry("c2", [["b.ts", 5]]), // a removed
  ];

  it("computes each commit's diff against its parent", () => {
    const index = buildHistoryIndex(entries);
    expect(index.diffs[0]!.changed.size).toBe(0);
    expect(index.diffs[1]!.changed.get("a.ts")).toBe("modified");
    expect(index.diffs[1]!.changed.get("b.ts")).toBe("added");
    expect(index.diffs[2]!.removed).toEqual(["a.ts"]);
  });

  it("inverts to a per-node commit history including removals", () => {
    const index = buildHistoryIndex(entries);
    expect(index.nodeHistory.get("a.ts")).toEqual([
      { index: 1, kind: "modified" },
      { index: 2, kind: "removed" },
    ]);
    expect(index.nodeHistory.get("b.ts")).toEqual([
      { index: 1, kind: "added" },
    ]);
  });
});
