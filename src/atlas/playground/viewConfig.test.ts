import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "../contracts/graph.js";
import {
  presetConfig,
  presetOf,
  resolveSelection,
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

describe("resolveSelection", () => {
  const ctx = {
    isModule: (id: string) => id.startsWith("mod:"),
    parentFileOf: (id: string) =>
      id.startsWith("symbol:") ? (id.split(":")[1] ?? id) : id,
    moduleOf: (id: string) => "mod:" + (id.split("/")[0] ?? id),
  };
  const symbol = "symbol:core/a.ts:function:foo:1";

  it("auto keeps whatever was clicked", () => {
    expect(resolveSelection(symbol, "auto", ctx)).toBe(symbol);
    expect(resolveSelection("core/a.ts", "auto", ctx)).toBe("core/a.ts");
  });

  it("module mode resolves anything up to its module", () => {
    expect(resolveSelection(symbol, "module", ctx)).toBe("mod:core");
    expect(resolveSelection("core/a.ts", "module", ctx)).toBe("mod:core");
    expect(resolveSelection("mod:core", "module", ctx)).toBe("mod:core");
  });

  it("file mode resolves symbols to their file, leaves coarser ids alone", () => {
    expect(resolveSelection(symbol, "file", ctx)).toBe("core/a.ts");
    expect(resolveSelection("core/a.ts", "file", ctx)).toBe("core/a.ts");
    expect(resolveSelection("mod:core", "file", ctx)).toBe("mod:core");
  });

  it("symbol mode keeps the finest unit clicked", () => {
    expect(resolveSelection(symbol, "symbol", ctx)).toBe(symbol);
    expect(resolveSelection("core/a.ts", "symbol", ctx)).toBe("core/a.ts");
  });
});
