import { describe, expect, it } from "vitest";
import {
  clampInto,
  clipCenter,
  clipToRing,
  randomPointIn,
  type ClipRegion,
} from "./clip.js";
import { createRng } from "./rng.js";

const triangle: ClipRegion = {
  kind: "polygon",
  ring: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 4 },
  ],
};

function insideTriangle(p: { x: number; y: number }, eps = 1e-9): boolean {
  return (
    p.x >= -eps && p.y >= -eps && p.x + p.y <= 4 + eps
  );
}

describe("polygon clip", () => {
  it("returns the ring itself from clipToRing", () => {
    expect(clipToRing(triangle, 64)).toEqual(
      (triangle as { ring: unknown }).ring,
    );
  });

  it("samples random points inside the polygon", () => {
    const rng = createRng(2);
    for (let i = 0; i < 500; i++) {
      expect(insideTriangle(randomPointIn(triangle, rng))).toBe(true);
    }
  });

  it("keeps inside points unchanged and pulls outside points in", () => {
    const inside = { x: 1, y: 1 };
    expect(clampInto(triangle, inside)).toEqual(inside);
    const out = clampInto(triangle, { x: 5, y: 5 });
    expect(insideTriangle(out)).toBe(true);
  });

  it("clamps to (near) the nearest boundary point, not the centroid ray", () => {
    // directly right of the hypotenuse midpoint: nearest point is (2,2);
    // a centroid-ray pull would land far from it
    const out = clampInto(triangle, { x: 3, y: 3 });
    expect(out.x).toBeCloseTo(2, 1);
    expect(out.y).toBeCloseTo(2, 1);
    expect(insideTriangle(out)).toBe(true);
  });

  it("uses the polygon centroid as center", () => {
    const c = clipCenter(triangle);
    expect(c.x).toBeCloseTo(4 / 3, 9);
    expect(c.y).toBeCloseTo(4 / 3, 9);
  });
});
