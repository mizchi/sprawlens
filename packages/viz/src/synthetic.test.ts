import { describe, expect, it } from "vitest";
import { createSyntheticGraph, synthesizeSymbolEdges, synthesizeSymbols } from "./synthetic.ts";

describe("createSyntheticGraph", () => {
  it("is deterministic for the same seed", () => {
    const a = createSyntheticGraph({ count: 40, seed: 3 });
    const b = createSyntheticGraph({ count: 40, seed: 3 });
    expect(a).toEqual(b);
  });

  it("produces the requested source count plus name-matched test files", () => {
    const graph = createSyntheticGraph({ count: 25, seed: 1 });
    const source = graph.nodes.filter((n) => !n.id.includes(".test."));
    const tests = graph.nodes.filter((n) => n.id.includes(".test."));
    expect(source).toHaveLength(25);
    expect(tests.length).toBeGreaterThan(0);
    for (const node of graph.nodes) {
      expect(node.metrics.loc).toBeGreaterThan(0);
    }
    for (const test of tests) {
      const subject = test.id.replace(".test.ts", ".ts");
      expect(source.some((n) => n.id === subject)).toBe(true);
    }
  });

  it("synthesizes deterministic symbols whose LOC sums to the file LOC", () => {
    const a = synthesizeSymbols("f1", 400, 7);
    const b = synthesizeSymbols("f1", 400, 7);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(2);
    const total = a.reduce((s, n) => s + n.metrics.loc, 0);
    expect(total).toBe(400);
    for (const symbol of a) {
      expect(symbol.kind).toBe("symbol");
      expect(symbol.metrics.loc).toBeGreaterThan(0);
    }
  });

  it("synthesizes symbol edges along and inside file edges, deterministically", () => {
    const graph = createSyntheticGraph({ count: 30, seed: 2 });
    const a = synthesizeSymbolEdges(graph, 2);
    const b = synthesizeSymbolEdges(graph, 2);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    const symbolIdsOf = (fileId: string) =>
      new Set(synthesizeSymbols(fileId, 100, 1).map((s) => s.id));
    for (const edge of a) {
      // endpoints are symbol ids of the form <fileId>#sN
      expect(edge.source).toContain("#");
      expect(edge.target).toContain("#");
      const sourceFile = edge.source.split("#")[0]!;
      const targetFile = edge.target.split("#")[0]!;
      // cross edges follow a file edge; intra edges stay within one file
      if (sourceFile !== targetFile) {
        expect(graph.edges.some((e) => e.source === sourceFile && e.target === targetFile)).toBe(
          true,
        );
      }
      expect(symbolIdsOf(sourceFile).has(edge.source)).toBe(true);
    }
  });

  it("marks a deterministic public surface on synthesized symbols", () => {
    const a = synthesizeSymbols("f1", 400, 7);
    expect(a[0]!.exported).toBe(true);
    expect(a.map((s) => s.exported)).toEqual(
      synthesizeSymbols("f1", 400, 7).map((s) => s.exported),
    );
  });

  it("synthesizes different symbols for different files", () => {
    const a = synthesizeSymbols("f1", 400, 7);
    const b = synthesizeSymbols("f2", 400, 7);
    expect(a.map((n) => n.metrics.loc)).not.toEqual(b.map((n) => n.metrics.loc));
  });

  it("produces a layered DAG (edges point to earlier layers only)", () => {
    const graph = createSyntheticGraph({ count: 60, seed: 5 });
    const index = new Map(graph.nodes.map((n, i) => [n.id, i]));
    expect(graph.edges.length).toBeGreaterThan(0);
    for (const edge of graph.edges) {
      expect(index.get(edge.source)!).toBeGreaterThan(index.get(edge.target)!);
    }
  });

  it("spreads several modules across each dependency level", () => {
    const graph = createSyntheticGraph({ count: 150, seed: 7 });
    const moduleIds = new Set(graph.nodes.map((n) => n.id.split("/")[0]!));
    expect(moduleIds.size).toBeGreaterThanOrEqual(6);
    // distinct module-level cross edges exist (a module DAG, not a chain)
    const crossPairs = new Set(
      graph.edges
        .map((e) => [e.source.split("/")[0], e.target.split("/")[0]] as const)
        .filter(([a, b]) => a !== b)
        .map(([a, b]) => `${a}->${b}`),
    );
    // level-0 modules have no deps, so expect roughly one outgoing
    // dependency for the rest — far more than a chain would produce
    expect(crossPairs.size).toBeGreaterThanOrEqual(moduleIds.size / 2);
  });
});
