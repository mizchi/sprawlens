import { describe, expect, it } from "vitest";
import { squarify } from "./squarify.ts";

const RECT = { x: 0, y: 0, w: 100, h: 100 };

describe("squarify", () => {
  it("areas are proportional to weights and fill the rect", () => {
    const items = [
      { id: "a", weight: 6 },
      { id: "b", weight: 3 },
      { id: "c", weight: 1 },
    ];
    const tiles = squarify(items, RECT);
    expect(tiles).toHaveLength(3);
    const total = tiles.reduce((s, t) => s + t.w * t.h, 0);
    expect(total).toBeCloseTo(100 * 100, 5);
    const areaOf = (id: string) => {
      const t = tiles.find((t) => t.item.id === id)!;
      return t.w * t.h;
    };
    // a:b:c areas ≈ 6:3:1
    expect(areaOf("a") / areaOf("b")).toBeCloseTo(2, 5);
    expect(areaOf("a") / areaOf("c")).toBeCloseTo(6, 5);
  });

  it("keeps every tile inside the rect and non-overlapping in area", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`,
      weight: (i % 5) + 1,
    }));
    const tiles = squarify(items, RECT);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(-1e-6);
      expect(t.y).toBeGreaterThanOrEqual(-1e-6);
      expect(t.x + t.w).toBeLessThanOrEqual(100 + 1e-6);
      expect(t.y + t.h).toBeLessThanOrEqual(100 + 1e-6);
    }
    const total = tiles.reduce((s, t) => s + t.w * t.h, 0);
    expect(total).toBeCloseTo(100 * 100, 3);
  });

  it("drops non-positive weights and handles empty/degenerate input", () => {
    expect(squarify([{ id: "z", weight: 0 }], RECT)).toEqual([]);
    expect(squarify([], RECT)).toEqual([]);
    expect(squarify([{ id: "a", weight: 1 }], { x: 0, y: 0, w: 0, h: 10 })).toEqual([]);
  });

  it("squarified tiles stay reasonably square", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, weight: 1 }));
    const tiles = squarify(items, RECT);
    const ratios = tiles.map((t) => Math.max(t.w / t.h, t.h / t.w));
    // a naive slice layout would give 20:1 strips; squarify keeps them low
    expect(Math.max(...ratios)).toBeLessThan(4);
  });
});
