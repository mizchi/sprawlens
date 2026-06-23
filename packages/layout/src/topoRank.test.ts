import { describe, expect, it } from "vitest";
import { topoRank } from "./topoRank.ts";

describe("topoRank", () => {
  it("ranks dependency-free nodes 0 and dependents above", () => {
    // a imports b, b imports c  →  c=0, b=1, a=2
    const ranks = topoRank(
      ["a", "b", "c"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    );
    expect(ranks.get("c")).toBe(0);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("a")).toBe(2);
  });

  it("uses the longest path when multiple routes exist", () => {
    // a→b→c, a→c  →  c=0, b=1, a=2 (not 1)
    const ranks = topoRank(
      ["a", "b", "c"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
        { source: "a", target: "c" },
      ],
    );
    expect(ranks.get("a")).toBe(2);
  });

  it("ranks isolated nodes 0", () => {
    const ranks = topoRank(["solo"], []);
    expect(ranks.get("solo")).toBe(0);
  });

  it("collapses cycles into one rank instead of looping forever", () => {
    // a↔b form a cycle depending on c
    const ranks = topoRank(
      ["a", "b", "c"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
        { source: "a", target: "c" },
      ],
    );
    expect(ranks.get("c")).toBe(0);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("b")).toBe(1);
  });

  it("ranks nodes after a cycle relative to the collapsed component", () => {
    // d imports the (a,b) cycle which imports c: c=0, a=b=1, d=2
    const ranks = topoRank(
      ["a", "b", "c", "d"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
        { source: "a", target: "c" },
        { source: "d", target: "a" },
      ],
    );
    expect(ranks.get("d")).toBe(2);
  });

  it("ignores edges referencing unknown nodes", () => {
    const ranks = topoRank(["a"], [{ source: "a", target: "ghost" }]);
    expect(ranks.get("a")).toBe(0);
  });
});
