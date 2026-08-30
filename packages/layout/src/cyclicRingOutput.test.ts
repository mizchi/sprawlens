import { describe, expect, it } from "vitest";
import {
  appendDistinctPoint,
  appendDistinctPoints,
  removeCyclicDuplicate,
} from "./cyclicRingOutput.ts";

describe("appendDistinctPoint", () => {
  it("appends the first and each changed point", () => {
    const output: Array<{ x: number; y: number }> = [];
    appendDistinctPoint(output, { x: 0, y: 0 });
    appendDistinctPoint(output, { x: 1, y: 0 });
    expect(output).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it("suppresses only adjacent duplicates", () => {
    const output = [{ x: 0, y: 0 }];
    appendDistinctPoint(output, { x: 0, y: 0 });
    appendDistinctPoint(output, { x: 1, y: 0 });
    appendDistinctPoint(output, { x: 0, y: 0 });
    expect(output).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]);
  });
});

describe("appendDistinctPoints", () => {
  it("removes duplicates across chunk boundaries", () => {
    const output = [{ x: -2, y: 0 }];
    appendDistinctPoints(output, [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: -1, y: 0 },
    ]);
    expect(output.map((point) => point.x)).toEqual([-2, 0, -1]);
  });
});

describe("removeCyclicDuplicate", () => {
  it("removes a repeated closing point", () => {
    const output = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ];
    removeCyclicDuplicate(output);
    expect(output).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it("leaves empty, singleton, and open output unchanged", () => {
    const empty: Array<{ x: number; y: number }> = [];
    const singleton = [{ x: 0, y: 0 }];
    const open = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    removeCyclicDuplicate(empty);
    removeCyclicDuplicate(singleton);
    removeCyclicDuplicate(open);
    expect(empty).toEqual([]);
    expect(singleton).toEqual([{ x: 0, y: 0 }]);
    expect(open).toHaveLength(2);
  });
});
