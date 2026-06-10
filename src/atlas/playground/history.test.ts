import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "../contracts/graph.js";
import { diffGraphs } from "./history.js";

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
