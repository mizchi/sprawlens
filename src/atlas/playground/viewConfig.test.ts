import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "../contracts/graph.js";
import {
  presetConfig,
  presetOf,
  reweightByPageRank,
  VIEW_PRESETS,
  type ViewConfig,
} from "./viewConfig.js";

describe("presets", () => {
  it("recognizes each preset's own config", () => {
    for (const preset of VIEW_PRESETS) {
      expect(presetOf(preset.config)).toBe(preset.id);
    }
  });

  it("falls back to custom for unlisted combinations", () => {
    const config: ViewConfig = {
      boundaries: ["module"],
      displayLevels: ["module", "file"],
      omit: [],
      weight: "pagerank",
    };
    expect(presetOf(config)).toBe("custom");
  });

  it("presetConfig returns a copy, not the shared object", () => {
    const a = presetConfig("files")!;
    a.weight = "pagerank";
    expect(presetConfig("files")!.weight).toBe("loc");
    expect(presetConfig("nope")).toBeNull();
  });
});

describe("reweightByPageRank", () => {
  const graph: AtlasGraph = {
    nodes: [
      { id: "a.ts", kind: "file", label: "a", metrics: { loc: 10 } },
      { id: "b.ts", kind: "file", label: "b", metrics: { loc: 500 } },
      { id: "c.ts", kind: "file", label: "c", metrics: { loc: 20 } },
    ],
    edges: [
      { source: "b.ts", target: "a.ts" },
      { source: "c.ts", target: "a.ts" },
    ],
  };

  it("grows depended-upon nodes regardless of their LOC", () => {
    const ranked = reweightByPageRank(graph);
    const weight = (id: string) =>
      ranked.nodes.find((n) => n.id === id)!.metrics.loc;
    expect(weight("a.ts")).toBeGreaterThan(weight("b.ts"));
    const mean =
      ranked.nodes.reduce((s, n) => s + n.metrics.loc, 0) /
      ranked.nodes.length;
    expect(mean).toBeCloseTo(1, 6);
  });

  it("keeps the input graph and node identities untouched", () => {
    const ranked = reweightByPageRank(graph);
    expect(graph.nodes[0]!.metrics.loc).toBe(10);
    expect(ranked.edges).toBe(graph.edges);
    expect(ranked.nodes.map((n) => n.id)).toEqual(
      graph.nodes.map((n) => n.id),
    );
  });
});

