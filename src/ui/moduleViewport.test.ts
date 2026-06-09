import { describe, expect, it } from "vitest";
import {
  clampViewport,
  focusViewport,
  panViewport,
  rectIntersectsViewport,
  viewportRect,
  viewportToViewBox,
  zoomViewportAt,
  wheelZoomFactor,
  type MapViewport,
} from "./moduleViewport.js";

const size = { width: 1000, height: 600 };

function worldAt(viewport: MapViewport, point: { x: number; y: number }) {
  return {
    x: viewport.x + point.x / viewport.zoom,
    y: viewport.y + point.y / viewport.zoom,
  };
}

describe("module viewport", () => {
  it("zooms around the pointer position instead of the viewport center", () => {
    const viewport = { x: 100, y: 50, zoom: 2 };
    const pointer = { x: 250, y: 120 };
    const before = worldAt(viewport, pointer);

    const next = zoomViewportAt(viewport, size, pointer, 3);
    const after = worldAt(next, pointer);

    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(next.zoom).toBe(3);
  });

  it("pans in the opposite world direction of the drag delta", () => {
    const viewport = { x: 300, y: 180, zoom: 2 };

    const next = panViewport(viewport, size, { x: 80, y: -40 });

    expect(next.x).toBeCloseTo(260);
    expect(next.y).toBeCloseTo(200);
  });

  it("clamps the viewport inside the map bounds", () => {
    const next = clampViewport({ x: 900, y: 500, zoom: 2 }, size);

    expect(next).toEqual({ x: 500, y: 300, zoom: 2 });
    expect(viewportToViewBox(next, size)).toBe("500 300 500 300");
  });

  it("focuses a selected module without exceeding map bounds", () => {
    const next = focusViewport(size, 4, { x0: 900, y0: 540, x1: 980, y1: 590 });

    expect(next.zoom).toBe(4);
    expect(next.x).toBeLessThanOrEqual(750);
    expect(next.y).toBeLessThanOrEqual(450);
  });

  it("reports the visible world rectangle for detail rendering", () => {
    const rect = viewportRect({ x: 100, y: 80, zoom: 2 }, size);

    expect(rect).toEqual({ x0: 100, y0: 80, x1: 600, y1: 380 });
  });

  it("detects modules that intersect the current viewport", () => {
    const viewport = { x: 100, y: 80, zoom: 2 };

    expect(rectIntersectsViewport({ x0: 550, y0: 100, x1: 650, y1: 180 }, viewport, size)).toBe(true);
    expect(rectIntersectsViewport({ x0: 650, y0: 100, x1: 700, y1: 180 }, viewport, size)).toBe(false);
  });

  it("keeps wheel zoom increments slow and delta-aware", () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(-100)).toBeLessThanOrEqual(1.03);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(100)).toBeGreaterThanOrEqual(0.97);
    expect(wheelZoomFactor(-5)).toBeCloseTo(1, 2);
  });
});
