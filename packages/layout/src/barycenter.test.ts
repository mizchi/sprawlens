import { describe, expect, it } from "vitest";
import { affineBarycenter, weightedBarycenter } from "./barycenter.ts";

const closeTo = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
};

describe("weightedBarycenter", () => {
  const samples = [
    { point: { x: 0, y: 3 }, weight: 1 },
    { point: { x: 6, y: 0 }, weight: 2 },
    { point: { x: 3, y: 6 }, weight: 3 },
  ];

  it("computes the normalized non-negative weighted sum", () => {
    closeTo(weightedBarycenter(samples)!, { x: 3.5, y: 3.5 });
  });

  it("is translation, uniform-scale, and input-order invariant up to floating tolerance", () => {
    const base = weightedBarycenter(samples)!;
    const translated = weightedBarycenter(
      samples.map(({ point, weight }) => ({
        point: { x: point.x + 11, y: point.y - 7 },
        weight,
      })),
    )!;
    closeTo(translated, { x: base.x + 11, y: base.y - 7 });

    const scaled = weightedBarycenter(
      samples.map(({ point, weight }) => ({
        point: { x: point.x * 4, y: point.y * 4 },
        weight,
      })),
    )!;
    closeTo(scaled, { x: base.x * 4, y: base.y * 4 });
    closeTo(weightedBarycenter([...samples].reverse())!, base);
  });

  it("returns undefined for zero total weight and rejects invalid inputs", () => {
    expect(weightedBarycenter([{ point: { x: 1, y: 2 }, weight: 0 }])).toBeUndefined();
    expect(() =>
      weightedBarycenter([{ point: { x: 1, y: 2 }, weight: -1 }]),
    ).toThrow(/non-negative/);
    expect(() =>
      weightedBarycenter([{ point: { x: Number.NaN, y: 2 }, weight: 1 }]),
    ).toThrow(/finite/);
  });
});

describe("affineBarycenter", () => {
  it("matches the stable layout current/previous interpolation", () => {
    closeTo(affineBarycenter({ x: 0, y: 10 }, { x: 20, y: 0 }, 0.25), { x: 5, y: 7.5 });
  });

  it("rejects a history mix outside the convex interval", () => {
    expect(() => affineBarycenter({ x: 0, y: 0 }, { x: 1, y: 1 }, 1.1)).toThrow(/0\.\.1/);
  });
});
