import { describe, expect, it } from "vitest";
import { add, distance, dot, lengthOf, scale, sub } from "./vec.js";

describe("vec", () => {
  it("adds and subtracts component-wise", () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: -1 })).toEqual({ x: 4, y: 1 });
    expect(sub({ x: 1, y: 2 }, { x: 3, y: -1 })).toEqual({ x: -2, y: 3 });
  });

  it("scales by a scalar", () => {
    expect(scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 });
  });

  it("computes dot product, length and distance", () => {
    expect(dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
    expect(lengthOf({ x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
  });
});
