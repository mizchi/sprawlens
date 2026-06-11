import { describe, expect, it } from "vitest";
import { pageRank } from "./pagerank.js";

describe("pageRank", () => {
  it("ranks the most-depended-upon node highest in a star", () => {
    // a, b, c all depend on hub
    const ranks = pageRank(
      ["a", "b", "c", "hub"],
      [
        { source: "a", target: "hub" },
        { source: "b", target: "hub" },
        { source: "c", target: "hub" },
      ],
    );
    expect(ranks.get("hub")!).toBeGreaterThan(ranks.get("a")!);
    expect(ranks.get("a")!).toBeCloseTo(ranks.get("b")!, 10);
  });

  it("accumulates rank along dependency chains", () => {
    // a → b → c: c sits beneath everything
    const ranks = pageRank(
      ["a", "b", "c"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    );
    expect(ranks.get("c")!).toBeGreaterThan(ranks.get("b")!);
    expect(ranks.get("b")!).toBeGreaterThan(ranks.get("a")!);
  });

  it("sums to 1 even with dangling nodes", () => {
    const ranks = pageRank(
      ["a", "b", "dangling"],
      [{ source: "a", target: "b" }],
    );
    const total = [...ranks.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("is uniform without edges", () => {
    const ranks = pageRank(["a", "b", "c"], []);
    expect(ranks.get("a")!).toBeCloseTo(1 / 3, 6);
    expect(ranks.get("b")!).toBeCloseTo(1 / 3, 6);
  });

  it("converges on cycles", () => {
    const ranks = pageRank(
      ["a", "b"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
      ],
    );
    expect(ranks.get("a")!).toBeCloseTo(0.5, 4);
  });
});
