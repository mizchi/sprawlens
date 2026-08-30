import { describe, expect, it } from "vitest";
import { orientationDeterminant } from "./orientation.ts";

describe("orientationDeterminant", () => {
  const a = { x: 1, y: 2 };
  const b = { x: 5, y: 3 };
  const c = { x: 2, y: 7 };

  it("is positive for a strict left turn", () => {
    expect(orientationDeterminant(a, b, c)).toBe(19);
  });

  it("is translation invariant and scales quadratically", () => {
    const translate = ({ x, y }: typeof a) => ({ x: x + 10, y: y - 4 });
    expect(orientationDeterminant(translate(a), translate(b), translate(c))).toBe(19);
    const scale = ({ x, y }: typeof a) => ({ x: x * 3, y: y * 3 });
    expect(orientationDeterminant(scale(a), scale(b), scale(c))).toBe(171);
  });

  it("negates under endpoint reversal and vanishes for duplicate points", () => {
    expect(orientationDeterminant(a, c, b)).toBe(-19);
    expect(orientationDeterminant(a, a, c)).toBe(0);
    expect(orientationDeterminant(a, b, a)).toBe(0);
  });
});
