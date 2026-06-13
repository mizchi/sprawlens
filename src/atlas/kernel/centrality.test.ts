import { describe, expect, it } from "vitest";
import {
  centralityRings,
  dependentWeights,
  importanceScore,
} from "./centrality.js";

describe("importanceScore", () => {
  it("lets a larger foundation outrank a small one with equal dependents", () => {
    expect(importanceScore(10, 10000)).toBeGreaterThan(
      importanceScore(10, 100),
    );
  });

  it("breaks ties between same-size modules by dependents", () => {
    expect(importanceScore(15, 4000)).toBeGreaterThan(
      importanceScore(10, 4000),
    );
  });

  it("ranks an unreferenced leaf by its own size (dependents floor at 1)", () => {
    expect(importanceScore(0, 900)).toBe(30); // 1 * sqrt(900)
  });
});

describe("dependentWeights", () => {
  it("scores a foundation above its dependents", () => {
    // a depends on b depends on c (c is the foundation)
    const ids = ["a", "b", "c"];
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const w = dependentWeights(ids, edges, () => 1);
    // c is pulled in by b and a (and itself) = 3; a only itself = 1
    expect(w.get("c")).toBe(3);
    expect(w.get("b")).toBe(2);
    expect(w.get("a")).toBe(1);
  });

  it("counts a shared dependency once (diamond)", () => {
    // a -> b, a -> c, b -> d, c -> d
    const ids = ["a", "b", "c", "d"];
    const edges = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "b", target: "d" },
      { source: "c", target: "d" },
    ];
    const w = dependentWeights(ids, edges, () => 1);
    // everything reaches d: a, b, c, d = 4
    expect(w.get("d")).toBe(4);
    expect(w.get("a")).toBe(1);
  });
});

describe("centralityRings", () => {
  const modules = [
    { id: "hub", area: 4000, centrality: 50 },
    { id: "b", area: 1000, centrality: 20 },
    { id: "c", area: 1000, centrality: 18 },
    { id: "d", area: 1000, centrality: 5 },
    { id: "e", area: 1000, centrality: 4 },
    { id: "f", area: 1000, centrality: 1 },
  ];

  it("puts the most central module at the center ring", () => {
    const rings = centralityRings(modules);
    expect(rings.get("hub")).toBe(0);
  });

  it("never assigns a more central module to an outer ring", () => {
    const rings = centralityRings(modules);
    const sorted = [...modules].sort((a, b) => b.centrality - a.centrality);
    for (let i = 1; i < sorted.length; i++) {
      expect(rings.get(sorted[i]!.id)!).toBeGreaterThanOrEqual(
        rings.get(sorted[i - 1]!.id)!,
      );
    }
  });

  it("assigns every module", () => {
    const rings = centralityRings(modules);
    expect(rings.size).toBe(modules.length);
  });

  it("is deterministic and breaks ties stably", () => {
    const tied = [
      { id: "x", area: 100, centrality: 1 },
      { id: "y", area: 100, centrality: 1 },
      { id: "z", area: 100, centrality: 1 },
    ];
    const a = centralityRings(tied);
    const b = centralityRings(tied);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("handles an empty input", () => {
    expect(centralityRings([]).size).toBe(0);
  });
});
