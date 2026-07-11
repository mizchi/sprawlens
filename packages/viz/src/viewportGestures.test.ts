import { describe, expect, it } from "vitest";
import {
  panViewByClientDelta,
  pinchView,
  zoomViewAtClientPoint,
  type ClientRectLike,
  type ViewBox,
} from "./viewportGestures.ts";

const rect: ClientRectLike = { left: 0, top: 0, width: 1000, height: 500 };
const view: ViewBox = { x: 0, y: 0, w: 1000, h: 500 };

describe("viewport gesture math", () => {
  it("zooms around the client point anchor", () => {
    expect(
      zoomViewAtClientPoint({
        view,
        rect,
        client: { x: 250, y: 100 },
        factor: 0.5,
        worldWidth: 1000,
        maxZoom: 400,
      }),
    ).toEqual({ x: 125, y: 50, w: 500, h: 250 });
  });

  it("pans in screen-pixel deltas", () => {
    expect(panViewByClientDelta(view, 20, -10, 2)).toEqual({
      x: -40,
      y: 20,
      w: 1000,
      h: 500,
    });
  });

  it("pinch-zooms in when the fingers move apart", () => {
    const next = pinchView({
      startView: view,
      rect,
      startDistance: 200,
      startMidpoint: { x: 500, y: 250 },
      currentDistance: 400,
      currentMidpoint: { x: 500, y: 250 },
      worldWidth: 1000,
      maxZoom: 400,
    });

    expect(next.w).toBeCloseTo(500);
    expect(next.h).toBeCloseTo(250);
    expect(next.x).toBeCloseTo(250);
    expect(next.y).toBeCloseTo(125);
  });

  it("pinch-zooms out when the fingers move together", () => {
    const startView: ViewBox = { x: 250, y: 125, w: 500, h: 250 };
    const next = pinchView({
      startView,
      rect,
      startDistance: 400,
      startMidpoint: { x: 500, y: 250 },
      currentDistance: 200,
      currentMidpoint: { x: 500, y: 250 },
      worldWidth: 1000,
      maxZoom: 400,
    });

    expect(next.w).toBeCloseTo(1000);
    expect(next.h).toBeCloseTo(500);
    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBeCloseTo(0);
  });

  it("keeps the original pinch anchor under the moved midpoint", () => {
    const next = pinchView({
      startView: view,
      rect,
      startDistance: 200,
      startMidpoint: { x: 500, y: 250 },
      currentDistance: 400,
      currentMidpoint: { x: 600, y: 300 },
      worldWidth: 1000,
      maxZoom: 400,
    });

    expect(next.w).toBeCloseTo(500);
    expect(next.x).toBeCloseTo(200);
    expect(next.y).toBeCloseTo(100);
  });

  it("clamps pinch zoom to the configured limits", () => {
    const next = pinchView({
      startView: view,
      rect,
      startDistance: 200,
      startMidpoint: { x: 500, y: 250 },
      currentDistance: 200_000,
      currentMidpoint: { x: 500, y: 250 },
      worldWidth: 1000,
      maxZoom: 400,
    });

    expect(next.w).toBe(2.5);
    expect(next.h).toBe(1.25);
  });
});
