import { describe, expect, it } from "vitest";
import { reachSubgraph } from "./reach.js";

// a → b → c → d,  x → b,  c → y,  isolated: z
const edges = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
  { source: "c", target: "d" },
  { source: "x", target: "b" },
  { source: "c", target: "y" },
];

describe("reachSubgraph", () => {
  it("collects ancestors and descendants of the root", () => {
    const reach = reachSubgraph(edges, "b");
    expect([...reach.nodes].sort()).toEqual(["a", "b", "c", "d", "x", "y"]);
  });

  it("separates downstream and upstream edges", () => {
    const reach = reachSubgraph(edges, "b");
    // downstream of b (what b depends on): b→c→d, c→y
    expect(reach.downstreamEdges).toHaveLength(3);
    expect(reach.downstreamEdges.every((e) => ["b", "c"].includes(e.source))).toBe(true);
    // upstream of b (what depends on b): a→b, x→b
    expect(reach.upstreamEdges).toHaveLength(2);
    expect(reach.upstreamEdges.every((e) => e.target === "b")).toBe(true);
  });

  it("keeps only edges on the dependency paths", () => {
    const reach = reachSubgraph(edges, "c");
    // upstream of c: b (←a, ←x); downstream: d, y. All five edges qualify.
    expect(reach.edges).toHaveLength(5);
    const downstreamOnly = reachSubgraph(edges, "a");
    // a's paths: a→b→c→d / c→y. x→b is NOT on a path from/to a.
    expect(downstreamOnly.edges.some((e) => e.source === "x")).toBe(false);
    expect([...downstreamOnly.nodes].sort()).toEqual(["a", "b", "c", "d", "y"]);
  });

  it("returns just the root for isolated nodes", () => {
    const reach = reachSubgraph(edges, "z");
    expect([...reach.nodes]).toEqual(["z"]);
    expect(reach.edges).toEqual([]);
  });

  it("terminates on cycles", () => {
    const cyclic = [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
      { source: "b", target: "c" },
    ];
    const reach = reachSubgraph(cyclic, "a");
    expect([...reach.nodes].sort()).toEqual(["a", "b", "c"]);
    expect(reach.edges).toHaveLength(3);
  });
});
