import { describe, expect, it } from "vitest";
import { elevationFromEntry, type ElevationEdge } from "./elevation.ts";

// `source` depends on (imports) `target`, same direction as topoRank / the
// atlas edges. Elevation = topological height with the entry at the summit.
const e = (source: string, target: string): ElevationEdge => ({ source, target });

describe("elevationFromEntry", () => {
  it("puts the entry at the summit and its deepest dependency at sea level", () => {
    // main → a → b → c  (main depends on a, … c is the bedrock)
    const elev = elevationFromEntry("main", [e("main", "a"), e("a", "b"), e("b", "c")]);
    expect(elev.get("c")).toBe(0);
    expect(elev.get("b")).toBe(1);
    expect(elev.get("a")).toBe(2);
    expect(elev.get("main")).toBe(3);
  });

  it("ranks by the longest dependency path through a diamond", () => {
    // main → a → d ; main → b → c → d  (d is shared bedrock)
    const elev = elevationFromEntry("main", [
      e("main", "a"),
      e("a", "d"),
      e("main", "b"),
      e("b", "c"),
      e("c", "d"),
    ]);
    expect(elev.get("d")).toBe(0);
    expect(elev.get("a")).toBe(1);
    expect(elev.get("c")).toBe(1);
    expect(elev.get("b")).toBe(2);
    // longest path main→b→c→d = 3
    expect(elev.get("main")).toBe(3);
  });

  it("gives a dependency cycle one shared elevation", () => {
    // main → a, a ↔ b (cycle), both sit at the same height
    const elev = elevationFromEntry("main", [e("main", "a"), e("a", "b"), e("b", "a")]);
    expect(elev.get("a")).toBe(elev.get("b"));
    expect(elev.get("main")).toBeGreaterThan(elev.get("a")!);
  });

  it("only covers the entry's dependency closure — unrelated nodes are absent", () => {
    // main → a ; x → y is a separate island
    const elev = elevationFromEntry("main", [e("main", "a"), e("x", "y")]);
    expect(elev.has("main")).toBe(true);
    expect(elev.has("a")).toBe(true);
    expect(elev.has("x")).toBe(false);
    expect(elev.has("y")).toBe(false);
  });

  it("does not climb upstream — nodes that depend on the entry are excluded", () => {
    // caller → main → a ; caller depends on main but sits above it, not below
    const elev = elevationFromEntry("main", [e("caller", "main"), e("main", "a")]);
    expect(elev.has("caller")).toBe(false);
    expect(elev.get("main")).toBe(1);
    expect(elev.get("a")).toBe(0);
  });

  it("a leaf entry with no dependencies sits flat at 0", () => {
    const elev = elevationFromEntry("main", [e("a", "b")]);
    expect(elev.get("main")).toBe(0);
    expect(elev.size).toBe(1);
  });

  it("accepts multiple entries (e.g. several symbols in main.tsx)", () => {
    // m1 → a → b ; m2 → b  — union closure, deepest path wins
    const elev = elevationFromEntry(["m1", "m2"], [e("m1", "a"), e("a", "b"), e("m2", "b")]);
    expect(elev.get("b")).toBe(0);
    expect(elev.get("a")).toBe(1);
    expect(elev.get("m1")).toBe(2);
    expect(elev.get("m2")).toBe(1);
  });
});
