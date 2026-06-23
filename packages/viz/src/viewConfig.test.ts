import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import {
  presetConfig,
  presetOf,
  reweightByTransitiveComplexity,
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
      boundaries: ["module", "file"],
      displayLevels: ["module"],
      omit: [],
      weight: "complexity",
    };
    expect(presetOf(config)).toBe("custom");
  });

  it("presetConfig returns a copy, not the shared object", () => {
    const a = presetConfig("files")!;
    a.weight = "complexity";
    expect(presetConfig("files")!.weight).toBe("loc");
    expect(presetConfig("nope")).toBeNull();
  });
});

describe("reweightByTransitiveComplexity", () => {
  const graph: AtlasGraph = {
    nodes: [
      { id: "a.ts", kind: "file", label: "a", metrics: { loc: 120, complexity: 10 } },
      { id: "b.ts", kind: "file", label: "b", metrics: { loc: 12, complexity: 4 } },
      { id: "c.ts", kind: "file", label: "c", metrics: { loc: 12, complexity: 2 } },
    ],
    edges: [
      { source: "a.ts", target: "b.ts" },
      { source: "b.ts", target: "c.ts" },
    ],
  };

  it("weights a node by the complexity it transitively pulls in", () => {
    const weighted = reweightByTransitiveComplexity(graph);
    const weight = (id: string) => weighted.nodes.find((n) => n.id === id)!.metrics.loc;
    expect(weight("a.ts")).toBe(16); // 10 + 4 + 2
    expect(weight("b.ts")).toBe(6);
    expect(weight("c.ts")).toBe(2);
  });

  it("estimates missing complexity from LOC and keeps inputs intact", () => {
    const bare: AtlasGraph = {
      nodes: [{ id: "x.ts", kind: "file", label: "x", metrics: { loc: 24 } }],
      edges: [],
    };
    const weighted = reweightByTransitiveComplexity(bare);
    expect(weighted.nodes[0]!.metrics.loc).toBeCloseTo(3, 5); // 1 + 24/12
    expect(bare.nodes[0]!.metrics.loc).toBe(24);
  });
});
