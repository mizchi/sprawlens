import { describe, expect, it } from "vitest";
import { ambientEdgeVisual, lspDash, selectionDash } from "./edgeStyle.ts";

const colors = { active: "#A", ambient: "#B" };

describe("ambientEdgeVisual", () => {
  it("leads a selection-touching edge: bright active color, full opacity, thick", () => {
    expect(ambientEdgeVisual(true, true, colors)).toEqual({
      stroke: "#A",
      opacity: 0.9,
      width: 1.8,
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

describe("dash helpers", () => {
  it("scale the dash with zoom so the gap reads at any scale", () => {
    expect(selectionDash(1)).toBe("5 4");
    expect(selectionDash(2)).toBe("2.5 2");
    expect(lspDash(1)).toBe("8 5");
  });
});
