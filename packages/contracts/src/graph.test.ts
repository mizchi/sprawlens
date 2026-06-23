import { describe, expect, it } from "vitest";
import { locScorer, type AtlasGraph } from "./graph.ts";

describe("locScorer", () => {
  it("maps node ids to their LOC metric", () => {
    const graph: AtlasGraph = {
      nodes: [
        { id: "a", kind: "file", label: "a.ts", metrics: { loc: 120 } },
        { id: "b", kind: "file", label: "b.ts", metrics: { loc: 30 } },
      ],
      edges: [{ source: "a", target: "b" }],
    };
    const weights = locScorer(graph);
    expect(weights.get("a")).toBe(120);
    expect(weights.get("b")).toBe(30);
  });
});
