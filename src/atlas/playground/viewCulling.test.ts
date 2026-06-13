import { describe, expect, it } from "vitest";
import { cellInView, pointInView, segmentInView } from "./viewCulling.js";

const VIEW = { x: 0, y: 0, w: 100, h: 80 };

describe("pointInView", () => {
  it("keeps points inside the rect", () => {
    expect(pointInView({ x: 50, y: 40 }, VIEW, 0)).toBe(true);
  });

  it("drops points outside the rect", () => {
    expect(pointInView({ x: 150, y: 40 }, VIEW, 0)).toBe(false);
    expect(pointInView({ x: 50, y: -20 }, VIEW, 0)).toBe(false);
  });

  it("admits points within the slack margin", () => {
    expect(pointInView({ x: 110, y: 40 }, VIEW, 0)).toBe(false);
    expect(pointInView({ x: 110, y: 40 }, VIEW, 20)).toBe(true);
  });
});

describe("cellInView", () => {
  it("keeps a cell whose center is inside", () => {
    expect(cellInView({ x: 50, y: 40 }, 5, VIEW)).toBe(true);
  });

  it("keeps a cell straddling the edge via its own span", () => {
    // center just outside the right edge, but the cell is wide enough to
    // poke back in
    expect(cellInView({ x: 108, y: 40 }, 10, VIEW)).toBe(true);
  });

  it("drops a cell fully off-screen", () => {
    expect(cellInView({ x: 200, y: 40 }, 5, VIEW)).toBe(false);
    expect(cellInView({ x: 50, y: 200 }, 5, VIEW)).toBe(false);
  });
});

describe("segmentInView", () => {
  it("keeps a segment fully inside", () => {
    expect(segmentInView({ x: 10, y: 10 }, { x: 90, y: 70 }, VIEW, 0)).toBe(
      true,
    );
  });

  it("keeps a segment that crosses the view from outside to outside", () => {
    // a long diagonal whose endpoints are both off-screen but whose body
    // sweeps over the rect — its bounding box still overlaps
    expect(
      segmentInView({ x: -50, y: -50 }, { x: 150, y: 130 }, VIEW, 0),
    ).toBe(true);
  });

  it("drops a segment whose bounding box misses the view", () => {
    expect(
      segmentInView({ x: 120, y: 10 }, { x: 200, y: 70 }, VIEW, 0),
    ).toBe(false);
    expect(
      segmentInView({ x: 10, y: -90 }, { x: 90, y: -20 }, VIEW, 0),
    ).toBe(false);
  });

  it("admits a near-miss within slack", () => {
    expect(
      segmentInView({ x: 115, y: 10 }, { x: 130, y: 70 }, VIEW, 0),
    ).toBe(false);
    expect(
      segmentInView({ x: 115, y: 10 }, { x: 130, y: 70 }, VIEW, 20),
    ).toBe(true);
  });
});
