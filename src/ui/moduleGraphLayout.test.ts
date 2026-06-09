import { describe, expect, it } from "vitest";
import { layoutDependencyMap } from "./moduleGraphLayout.js";

const size = { width: 900, height: 600 };

function center(rect: { x0: number; y0: number; x1: number; y1: number }) {
  return {
    x: (rect.x0 + rect.x1) / 2,
    y: (rect.y0 + rect.y1) / 2,
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function overlapArea(a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) {
  const width = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const height = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return width * height;
}

describe("layoutDependencyMap", () => {
  it("keeps module rectangles inside bounds with minimum touch size", () => {
    const rects = layoutDependencyMap(
      [
        { id: "module:a", path: "packages/a", loc: 1000 },
        { id: "module:b", path: "packages/b", loc: 100 },
        { id: "module:c", path: "tests/c", loc: 20 },
      ],
      [],
      size,
    );

    expect(rects).toHaveLength(3);
    for (const rect of rects) {
      expect(rect.x0).toBeGreaterThanOrEqual(0);
      expect(rect.y0).toBeGreaterThanOrEqual(0);
      expect(rect.x1).toBeLessThanOrEqual(size.width);
      expect(rect.y1).toBeLessThanOrEqual(size.height);
      expect(rect.x1 - rect.x0).toBeGreaterThanOrEqual(44);
      expect(rect.y1 - rect.y0).toBeGreaterThanOrEqual(30);
    }
  });

  it("places strongly linked modules closer than unrelated modules", () => {
    const rects = layoutDependencyMap(
      [
        { id: "module:a", path: "packages/a", loc: 400 },
        { id: "module:b", path: "packages/b", loc: 400 },
        { id: "module:c", path: "packages/c", loc: 400 },
        { id: "module:d", path: "packages/d", loc: 400 },
      ],
      [{ from: "module:a", to: "module:b", importCount: 20 }],
      size,
    );
    const byId = new Map(rects.map((rect) => [rect.id, rect]));
    const a = center(byId.get("module:a")!);
    const b = center(byId.get("module:b")!);
    const d = center(byId.get("module:d")!);

    expect(distance(a, b)).toBeLessThan(distance(a, d));
  });

  it("gives larger modules visibly larger rectangles", () => {
    const rects = layoutDependencyMap(
      [
        { id: "module:large", path: "packages/large", loc: 2000 },
        { id: "module:small", path: "packages/small", loc: 50 },
      ],
      [],
      size,
    );
    const area = (id: string) => {
      const rect = rects.find((item) => item.id === id)!;
      return (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
    };

    expect(area("module:large")).toBeGreaterThan(area("module:small"));
  });

  it("keeps crowded dependency maps from overlapping", () => {
    const items = Array.from({ length: 42 }, (_, index) => ({
      id: `module:${index}`,
      path: index < 22 ? `packages/pkg-${index}` : `tests/area-${index}`,
      loc: Math.max(30, Math.round(32000 / (index + 1))),
    }));
    const dependencies = items.slice(1).map((item, index) => ({
      from: "module:0",
      to: item.id,
      importCount: index % 5 === 0 ? 20 : 3,
    }));
    const rects = layoutDependencyMap(items, dependencies, { width: 747, height: 794 });

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(overlapArea(rects[i]!, rects[j]!)).toBeLessThanOrEqual(1);
      }
    }
  });
});
