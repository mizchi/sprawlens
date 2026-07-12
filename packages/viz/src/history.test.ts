import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import {
  buildHistoryIndex,
  clearHistorySelection,
  diffGraphs,
  historyCommitUpdateMode,
  moveHistorySelection,
  type HistoryEntry,
} from "./history.ts";

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
  const entry = (hash: string, files: [string, number][]): HistoryEntry => ({
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
    entry("c1", [
      ["a.ts", 20],
      ["b.ts", 5],
    ]), // a modified, b added
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
    expect(index.nodeHistory.get("b.ts")).toEqual([{ index: 1, kind: "added" }]);
  });
});

describe("historyCommitUpdateMode", () => {
  it("uses a warm delta only for the explicit stable-layout experiment", () => {
    expect(historyCommitUpdateMode(false)).toBe("cold");
    expect(historyCommitUpdateMode(true)).toBe("warm-experiment");
  });
});

describe("moveHistorySelection", () => {
  it("follows the visual commit-log direction and clamps at both ends", () => {
    expect(moveHistorySelection({ index: 2, rangeAnchor: null }, "ArrowUp", false, 5)).toEqual({
      index: 3,
      rangeAnchor: null,
      range: null,
    });
    expect(moveHistorySelection({ index: 2, rangeAnchor: null }, "ArrowDown", false, 5)).toEqual({
      index: 1,
      rangeAnchor: null,
      range: null,
    });
    expect(moveHistorySelection({ index: 4, rangeAnchor: null }, "ArrowUp", false, 5)).toEqual({
      index: 4,
      rangeAnchor: null,
      range: null,
    });
    expect(moveHistorySelection({ index: 0, rangeAnchor: null }, "ArrowDown", false, 5)).toEqual({
      index: 0,
      rangeAnchor: null,
      range: null,
    });
  });

  it("keeps the initial selection as the shift-range anchor", () => {
    const first = moveHistorySelection({ index: 2, rangeAnchor: null }, "ArrowDown", true, 6);
    expect(first).toEqual({ index: 1, rangeAnchor: 2, range: [1, 2] });
    expect(moveHistorySelection(first, "ArrowDown", true, 6)).toEqual({
      index: 0,
      rangeAnchor: 2,
      range: [0, 2],
    });
    const collapsed = moveHistorySelection(first, "ArrowUp", true, 6);
    expect(collapsed).toEqual({
      index: 2,
      rangeAnchor: 2,
      range: [2, 2],
    });
    expect(moveHistorySelection(collapsed, "ArrowUp", true, 6)).toEqual({
      index: 3,
      rangeAnchor: 2,
      range: [2, 3],
    });
  });

  it("clears the range anchor on the next unshifted move", () => {
    expect(moveHistorySelection({ index: 1, rangeAnchor: 3 }, "ArrowUp", false, 6)).toEqual({
      index: 2,
      rangeAnchor: null,
      range: null,
    });
  });

  it("clears an extended range without moving its current endpoint", () => {
    expect(clearHistorySelection({ index: 1, rangeAnchor: 3 })).toEqual({
      index: 1,
      rangeAnchor: null,
      range: null,
    });
  });
});
