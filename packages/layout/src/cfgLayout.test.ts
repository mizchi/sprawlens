import { describe, expect, it } from "vitest";
import type { AtlasEdge, AtlasNode } from "@sprawlens/contracts";
import { layoutCfg } from "./cfgLayout.ts";

const block = (id: string): AtlasNode => ({
  id,
  kind: "block",
  label: id,
  metrics: { loc: 1 },
});
const flow = (source: string, target: string): AtlasEdge => ({
  source,
  target,
  kind: "flow",
});

describe("layoutCfg", () => {
  it("stacks a chain top-down on the center line", () => {
    const layout = layoutCfg(
      [block("b-entry"), block("a"), block("b-exit")],
      [flow("b-entry", "a"), flow("a", "b-exit")],
    );
    const entry = layout.positions.get("b-entry")!;
    const mid = layout.positions.get("a")!;
    const exit = layout.positions.get("b-exit")!;
    expect(entry.y).toBeLessThan(mid.y);
    expect(mid.y).toBeLessThan(exit.y);
    expect(entry.x).toBeCloseTo(0.5, 5);
    expect(mid.x).toBeCloseTo(0.5, 5);
    // everything inside the unit square
    for (const p of layout.positions.values()) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(1);
    }
  });

  it("places if branches side by side, merge below both", () => {
    const layout = layoutCfg(
      [block("b-entry"), block("if"), block("then"), block("else"), block("b-exit")],
      [
        flow("b-entry", "if"),
        flow("if", "then"),
        flow("if", "else"),
        flow("then", "b-exit"),
        flow("else", "b-exit"),
      ],
    );
    const thenP = layout.positions.get("then")!;
    const elseP = layout.positions.get("else")!;
    const exitP = layout.positions.get("b-exit")!;
    expect(thenP.y).toBeCloseTo(elseP.y, 5);
    expect(thenP.x).not.toBeCloseTo(elseP.x, 5);
    expect(exitP.y).toBeGreaterThan(thenP.y);
  });

  it("classifies loop back edges without disturbing ranks", () => {
    const layout = layoutCfg(
      [block("b-entry"), block("head"), block("body"), block("b-exit")],
      [
        flow("b-entry", "head"),
        flow("head", "body"),
        flow("body", "head"), // back edge
        flow("head", "b-exit"),
      ],
    );
    expect(layout.backEdges.has("body head")).toBe(true);
    const head = layout.positions.get("head")!;
    const body = layout.positions.get("body")!;
    expect(body.y).toBeGreaterThan(head.y);
    expect(layout.positions.get("b-exit")!.y).toBeGreaterThan(body.y - 1e-9);
  });

  it("uses producer grid hints verbatim when present", () => {
    const layout = layoutCfg(
      [block("b-entry"), block("if"), block("then"), block("else"), block("b-exit")],
      [
        flow("b-entry", "if"),
        flow("if", "then"),
        flow("if", "else"),
        flow("then", "b-exit"),
        flow("else", "b-exit"),
      ],
      {
        grid: {
          "b-entry": { row: 0, col: 0 },
          if: { row: 1, col: 0 },
          then: { row: 2, col: 0 },
          else: { row: 2, col: 1 },
          "b-exit": { row: 3, col: 0 },
        },
      },
    );
    expect(layout.rows).toBe(4);
    expect(layout.cols).toBe(2);
    // the spine shares one x column; else sits one column right
    expect(layout.positions.get("then")!.x).toBeCloseTo(layout.positions.get("if")!.x, 5);
    expect(layout.positions.get("else")!.x).toBeGreaterThan(layout.positions.get("then")!.x);
    expect(layout.positions.get("b-exit")!.y).toBeGreaterThan(layout.positions.get("else")!.y);
  });

  it("ranks the longer branch fully before the merge", () => {
    // if → a → b → merge, if → merge: merge must sit below b
    const layout = layoutCfg(
      [block("b-entry"), block("if"), block("a"), block("b"), block("merge")],
      [
        flow("b-entry", "if"),
        flow("if", "a"),
        flow("a", "b"),
        flow("if", "merge"),
        flow("b", "merge"),
      ],
    );
    expect(layout.positions.get("merge")!.y).toBeGreaterThan(layout.positions.get("b")!.y);
  });
});
