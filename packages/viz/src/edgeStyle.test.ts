import { describe, expect, it } from "vitest";
import { ambientEdgeVisual, lspDash, REFERENCE_EDGE_BASE } from "./edgeStyle.ts";

const colors = { active: "#A", ambient: "#B" };

describe("ambientEdgeVisual", () => {
  it("tints a selection-touching edge active but keeps it thin (no bold fan)", () => {
    expect(ambientEdgeVisual(true, true, colors)).toEqual({
      stroke: "#A",
      opacity: 0.22,
      width: 1,
    });
  });

  it("recedes an inactive edge, fainter still when something is selected", () => {
    expect(ambientEdgeVisual(false, true, colors)).toEqual({
      stroke: "#B",
      opacity: 0.08,
      width: 1,
    });
    expect(ambientEdgeVisual(false, false, colors)).toEqual({
      stroke: "#B",
      opacity: 0.22,
      width: 1,
    });
  });
});

describe("REFERENCE_EDGE_BASE", () => {
  it("draws a faint thin solid mesh that recedes vs the old bright 0.9 fan", () => {
    expect(REFERENCE_EDGE_BASE.opacity).toBeLessThan(0.9);
    expect(REFERENCE_EDGE_BASE.width).toBe(1);
  });
});

describe("dash helpers", () => {
  it("scale the dash with zoom so the gap reads at any scale", () => {
    expect(lspDash(1)).toBe("8 5");
    expect(lspDash(2)).toBe("4 2.5");
  });
});
