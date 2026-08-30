import { describe, expect, it } from "vitest";
import { signedTwiceArea } from "./polygon.ts";

describe("signedTwiceArea", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  it("is positive for CCW and negative for reversed winding", () => {
    expect(signedTwiceArea(square)).toBe(2);
    expect(signedTwiceArea([...square].reverse())).toBe(-2);
  });

  it("is invariant under translation and scales quadratically", () => {
    expect(signedTwiceArea(square.map(({ x, y }) => ({ x: x + 10, y: y - 7 })))).toBe(2);
    expect(signedTwiceArea(square.map(({ x, y }) => ({ x: x * 3, y: y * 3 })))).toBe(18);
  });

  it("agrees with orientation for a triangle", () => {
    expect(
      signedTwiceArea([
        { x: 1, y: 2 },
        { x: 5, y: 3 },
        { x: 2, y: 7 },
      ]),
    ).toBe(19);
  });

  it("returns zero below three vertices", () => {
    expect(signedTwiceArea([])).toBe(0);
    expect(signedTwiceArea([{ x: 1, y: 1 }])).toBe(0);
    expect(signedTwiceArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });
});
