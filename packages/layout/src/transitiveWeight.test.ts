import { describe, expect, it } from "vitest";
import { transitiveWeights } from "./transitiveWeight.js";

const ids = (...xs: string[]) => xs;
const one = () => 1;

describe("transitiveWeights", () => {
  it("sums a chain downstream, including the node itself", () => {
    const weights = transitiveWeights(
      ids("a", "b", "c"),
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
      one,
    );
    expect(weights.get("a")).toBe(3);
    expect(weights.get("b")).toBe(2);
    expect(weights.get("c")).toBe(1);
  });

  it("counts shared dependencies once (diamond)", () => {
    const weights = transitiveWeights(
      ids("a", "b", "c", "d"),
      [
        { source: "a", target: "b" },
        { source: "a", target: "c" },
        { source: "b", target: "d" },
        { source: "c", target: "d" },
      ],
      one,
    );
    expect(weights.get("a")).toBe(4); // not 5
  });

  it("treats cycle members as one closure", () => {
    const weights = transitiveWeights(
      ids("a", "b", "c"),
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
        { source: "b", target: "c" },
      ],
      one,
    );
    expect(weights.get("a")).toBe(3);
    expect(weights.get("b")).toBe(3);
    expect(weights.get("c")).toBe(1);
  });

  it("uses the base metric per node", () => {
    const base = new Map([
      ["a", 10],
      ["b", 5],
    ]);
    const weights = transitiveWeights(
      ids("a", "b"),
      [{ source: "a", target: "b" }],
      (id) => base.get(id) ?? 0,
    );
    expect(weights.get("a")).toBe(15);
    expect(weights.get("b")).toBe(5);
  });

  it("ignores edges with unknown endpoints", () => {
    const weights = transitiveWeights(
      ids("a"),
      [{ source: "a", target: "ghost" }],
      one,
    );
    expect(weights.get("a")).toBe(1);
  });

  it("handles a thousand-node mesh without blowing up", () => {
    const n = 1000;
    const nodes = Array.from({ length: n }, (_, i) => `n${i}`);
    const edges = [];
    for (let i = 0; i < n - 1; i++) {
      edges.push({ source: `n${i}`, target: `n${i + 1}` });
      if (i % 7 === 0) edges.push({ source: `n${i}`, target: `n${(i + 13) % n}` });
    }
    const weights = transitiveWeights(nodes, edges, one);
    expect(weights.get("n0")).toBeGreaterThan(1);
    expect(weights.size).toBe(n);
  });
});
