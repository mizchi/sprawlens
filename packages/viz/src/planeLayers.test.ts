import { describe, expect, it } from "vitest";
import { capacityPlane, ringPlane, type LayerNode } from "./planeLayers.js";

const node = (id: string, weight: number, rank?: number): LayerNode => ({
  id,
  label: id,
  weight,
  rank,
  sourceIds: [],
});

describe("capacityPlane", () => {
  const extent = { w: 400, h: 300 };

  it("places every node inside the plane rect with a polygon", () => {
    const placed = capacityPlane(
      [node("a", 100), node("b", 50), node("c", 25)],
      extent,
    );
    expect(placed).toHaveLength(3);
    for (const p of placed) {
      expect(p.polygon!.length).toBeGreaterThanOrEqual(3);
      expect(p.site.x).toBeGreaterThanOrEqual(0);
      expect(p.site.x).toBeLessThanOrEqual(extent.w);
      expect(p.site.y).toBeGreaterThanOrEqual(0);
      expect(p.site.y).toBeLessThanOrEqual(extent.h);
    }
  });

  it("gives the heavier node the larger cell area", () => {
    const placed = capacityPlane([node("big", 300), node("small", 30)], extent);
    const areaOf = (id: string) => {
      const poly = placed.find((p) => p.id === id)!.polygon!;
      let s = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!;
        const b = poly[(i + 1) % poly.length]!;
        s += a.x * b.y - b.x * a.y;
      }
      return Math.abs(s) / 2;
    };
    expect(areaOf("big")).toBeGreaterThan(areaOf("small") * 2);
  });

  it("returns nothing for no nodes", () => {
    expect(capacityPlane([], extent)).toEqual([]);
  });
});

describe("ringPlane", () => {
  const extent = { w: 400, h: 400 };

  it("places nodes with a radius, fitted into the plane", () => {
    const placed = ringPlane(
      [node("x", 40), node("y", 20), node("z", 10)],
      extent,
    );
    expect(placed).toHaveLength(3);
    for (const p of placed) {
      expect(p.r).toBeGreaterThan(0);
      expect(p.site.x).toBeGreaterThanOrEqual(0);
      expect(p.site.x).toBeLessThanOrEqual(extent.w);
    }
  });

  it("puts a lower rank closer to the plane center", () => {
    const placed = ringPlane(
      [node("center", 20, 0), node("outer", 20, 2)],
      extent,
    );
    const c = { x: extent.w / 2, y: extent.h / 2 };
    const dist = (id: string) => {
      const p = placed.find((q) => q.id === id)!;
      return Math.hypot(p.site.x - c.x, p.site.y - c.y);
    };
    expect(dist("center")).toBeLessThan(dist("outer"));
  });
});
