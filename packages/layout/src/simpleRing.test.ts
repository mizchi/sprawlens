import { describe, expect, it } from "vitest";
import { isSimpleOpenRing } from "./simpleRing.ts";

describe("isSimpleOpenRing", () => {
  it("accepts convex, concave, and clockwise simple rings", () => {
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ]),
    ).toBe(true);
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 2, y: 2 },
        { x: 0, y: 4 },
      ]),
    ).toBe(true);
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: 0, y: 3 },
        { x: 4, y: 3 },
        { x: 4, y: 0 },
      ]),
    ).toBe(true);
  });

  it("rejects proper crossing, T-junction, and collinear overlap", () => {
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
        { x: 4, y: 0 },
      ]),
    ).toBe(false);
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 2, y: 0 },
        { x: 0, y: 4 },
      ]),
    ).toBe(false);
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 1, y: 0 },
        { x: 3, y: 0 },
        { x: 0, y: 2 },
      ]),
    ).toBe(false);
  });

  it("rejects duplicate vertices, too few vertices, and non-finite coordinates", () => {
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 0 },
      ]),
    ).toBe(false);
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toBe(false);
    expect(
      isSimpleOpenRing([
        { x: 0, y: 0 },
        { x: Number.NaN, y: 1 },
        { x: 1, y: 0 },
      ]),
    ).toBe(false);
  });
});
