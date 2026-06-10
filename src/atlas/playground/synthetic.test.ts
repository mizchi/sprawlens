import { describe, expect, it } from "vitest";
import { createSyntheticGraph, synthesizeSymbols } from "./synthetic.js";

describe("createSyntheticGraph", () => {
  it("is deterministic for the same seed", () => {
    const a = createSyntheticGraph({ count: 40, seed: 3 });
    const b = createSyntheticGraph({ count: 40, seed: 3 });
    expect(a).toEqual(b);
  });

  it("produces the requested node count with positive LOC", () => {
    const graph = createSyntheticGraph({ count: 25, seed: 1 });
    expect(graph.nodes).toHaveLength(25);
    for (const node of graph.nodes) {
      expect(node.metrics.loc).toBeGreaterThan(0);
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

  it("synthesizes different symbols for different files", () => {
    const a = synthesizeSymbols("f1", 400, 7);
    const b = synthesizeSymbols("f2", 400, 7);
    expect(a.map((n) => n.metrics.loc)).not.toEqual(
      b.map((n) => n.metrics.loc),
    );
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
