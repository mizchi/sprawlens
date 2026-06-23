import { describe, expect, it } from "vitest";
import {
  apply,
  compose,
  IDENTITY,
  invert,
  layerTransform,
  rotate,
  skewX,
  squashY,
  toMatrixString,
  translate,
  uprightAt,
} from "./affine.js";

const closeTo = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 10);
  expect(a.y).toBeCloseTo(b.y, 10);
};

describe("apply", () => {
  it("leaves points unchanged under identity", () => {
    closeTo(apply(IDENTITY, { x: 3, y: -7 }), { x: 3, y: -7 });
  });

  it("matches the SVG matrix(a,b,c,d,e,f) convention", () => {
    const m = { a: 2, b: 3, c: 4, d: 5, e: 6, f: 7 };
    closeTo(apply(m, { x: 1, y: 1 }), { x: 2 + 4 + 6, y: 3 + 5 + 7 });
  });
});

describe("translate", () => {
  it("shifts points", () => {
    closeTo(apply(translate(10, -5), { x: 1, y: 2 }), { x: 11, y: -3 });
  });
});

describe("rotate", () => {
  it("rotates 90deg about the origin", () => {
    closeTo(apply(rotate(Math.PI / 2), { x: 1, y: 0 }), { x: 0, y: 1 });
  });

  it("keeps the center fixed", () => {
    const c = { x: 4, y: -2 };
    closeTo(apply(rotate(1.23, c), c), c);
  });

  it("preserves distance from the center", () => {
    const c = { x: 5, y: 5 };
    const p = { x: 8, y: 9 };
    const r = apply(rotate(0.7, c), p);
    expect(Math.hypot(r.x - c.x, r.y - c.y)).toBeCloseTo(Math.hypot(p.x - c.x, p.y - c.y), 10);
  });
});

describe("squashY", () => {
  it("scales y about cy and leaves x alone", () => {
    closeTo(apply(squashY(0.5, 10), { x: 4, y: 20 }), { x: 4, y: 15 });
  });

  it("is identity at s=1", () => {
    closeTo(apply(squashY(1, 99), { x: 3, y: 7 }), { x: 3, y: 7 });
  });
});

describe("skewX", () => {
  it("shears x by k*(y-cy) and leaves y alone", () => {
    closeTo(apply(skewX(0.5, 10), { x: 4, y: 14 }), { x: 4 + 0.5 * 4, y: 14 });
  });

  it("fixes the row at y=cy", () => {
    closeTo(apply(skewX(0.9, 10), { x: 7, y: 10 }), { x: 7, y: 10 });
  });

  it("pushes points above cy in the opposite x direction (right lean)", () => {
    // negative k pushes the top (smaller y) to the right
    const above = apply(skewX(-0.4, 50), { x: 0, y: 10 });
    expect(above.x).toBeGreaterThan(0);
  });
});

describe("uprightAt", () => {
  it("is a plain translate when there is no transform", () => {
    expect(uprightAt(undefined, { x: 3, y: 8 })).toBe("translate(3,8)");
  });

  it("lands a local-origin element on the projected anchor", () => {
    const m = layerTransform({
      theta: 0.4,
      squash: 0.5,
      skew: -0.3,
      gap: 0,
      index: 0,
      center: { x: 50, y: 50 },
    });
    const anchor = { x: 80, y: 20 };
    // m · uprightAt(m, anchor) applied to local (0,0) must equal m·anchor
    const c = uprightAt(m, anchor);
    const nums = c.slice(7, -1).split(",").map(Number);
    const cMat = {
      a: nums[0]!,
      b: nums[1]!,
      c: nums[2]!,
      d: nums[3]!,
      e: nums[4]!,
      f: nums[5]!,
    };
    const composed = compose(m, cMat);
    closeTo(apply(composed, { x: 0, y: 0 }), apply(m, anchor));
  });

  it("cancels the linear distortion so glyphs stay upright", () => {
    const m = layerTransform({
      theta: 0.6,
      squash: 0.4,
      skew: -0.5,
      gap: 0,
      index: 0,
      center: { x: 50, y: 50 },
    });
    const c = uprightAt(m, { x: 10, y: 90 });
    const nums = c.slice(7, -1).split(",").map(Number);
    const cMat = {
      a: nums[0]!,
      b: nums[1]!,
      c: nums[2]!,
      d: nums[3]!,
      e: nums[4]!,
      f: nums[5]!,
    };
    const composed = compose(m, cMat);
    // linear part of m·uprightAt is the identity
    expect(composed.a).toBeCloseTo(1, 10);
    expect(composed.b).toBeCloseTo(0, 10);
    expect(composed.c).toBeCloseTo(0, 10);
    expect(composed.d).toBeCloseTo(1, 10);
  });
});

describe("compose", () => {
  it("applies the right matrix first", () => {
    const m = translate(1, 0);
    const n = rotate(Math.PI / 2);
    // compose(m, n) rotates then translates
    closeTo(apply(compose(m, n), { x: 1, y: 0 }), { x: 1, y: 1 });
  });

  it("is associative on points", () => {
    const m = rotate(0.3);
    const n = squashY(0.6);
    const o = translate(2, 3);
    const p = { x: 7, y: -4 };
    closeTo(apply(compose(compose(m, n), o), p), apply(m, apply(n, apply(o, p))));
  });
});

describe("invert", () => {
  it("round-trips a composed transform", () => {
    const m = compose(translate(3, 5), compose(rotate(0.9), squashY(0.4)));
    const p = { x: 12, y: -6 };
    closeTo(apply(invert(m), apply(m, p)), p);
  });

  it("throws on a singular matrix", () => {
    expect(() => invert(squashY(0))).toThrow();
  });
});

describe("toMatrixString", () => {
  it("emits the SVG matrix() form", () => {
    expect(toMatrixString({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })).toBe("matrix(1,2,3,4,5,6)");
  });
});

describe("layerTransform", () => {
  const center = { x: 50, y: 50 };

  it("is identity for the top layer with no tilt", () => {
    const m = layerTransform({
      theta: 0,
      squash: 1,
      gap: 40,
      index: 0,
      center,
    });
    closeTo(apply(m, { x: 17, y: 88 }), { x: 17, y: 88 });
  });

  it("drops lower layers by index*gap in screen-y", () => {
    const opts = { theta: 0, squash: 1, gap: 40, center };
    const top = apply(layerTransform({ ...opts, index: 0 }), center);
    const below = apply(layerTransform({ ...opts, index: 1 }), center);
    closeTo(below, { x: top.x, y: top.y + 40 });
  });

  it("keeps the layout center on its plane under rotation+squash", () => {
    const m = layerTransform({
      theta: 0.6,
      squash: 0.5,
      gap: 30,
      index: 2,
      center,
    });
    // center is the rotation+squash fixed point, so it only gets the layer drop
    closeTo(apply(m, center), { x: center.x, y: center.y + 60 });
  });
});
