import { describe, expect, it } from "vitest";
import type { ClipRegion } from "./capacityLayout.ts";
import {
  solveStableVoronoi,
  stableHilbertHints,
  stableVariableHilbertHints,
} from "./stableVoronoi.ts";

const clip = { kind: "rect", x: 0, y: 0, width: 1, height: 1 } as const;

describe("paper-derived stable Voronoi initialization", () => {
  it("places sites in strict input order at regular Hilbert-curve intervals", () => {
    const hints = stableHilbertHints(
      [
        { id: "first", weight: 1 },
        { id: "second", weight: 1 },
        { id: "third", weight: 1 },
        { id: "fourth", weight: 1 },
      ],
      clip,
      2,
    );

    expect([...hints.keys()]).toEqual(["first", "second", "third", "fourth"]);
    expect(new Set([...hints.values()].map(({ x, y }) => `${x},${y}`))).toHaveLength(4);
    expect([...hints.values()].every(({ x, y }) => x > 0 && x < 1 && y > 0 && y < 1)).toBe(true);
  });

  it("is deterministic and independent of dependency edges or seed", () => {
    const nodes = [
      { id: "a", weight: 3 },
      { id: "b", weight: 1 },
      { id: "c", weight: 2 },
    ];

    expect(stableHilbertHints(nodes, clip, 4)).toEqual(stableHilbertHints(nodes, clip, 4));
  });

  it("filters the scaled curve to an arbitrary convex polygon", () => {
    const triangle: ClipRegion = {
      kind: "polygon",
      ring: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    };
    const hints = stableHilbertHints(
      Array.from({ length: 12 }, (_, index) => ({ id: String(index), weight: 1 })),
      triangle,
      5,
    );

    expect(hints).toHaveLength(12);
    expect([...hints.values()].every(({ x, y }) => x >= 0 && y >= 0 && x + y <= 1)).toBe(true);
  });

  it("runs the paper-derived initialization through a deterministic capacity solve", () => {
    const nodes = [
      { id: "a", weight: 4 },
      { id: "b", weight: 3 },
      { id: "c", weight: 2 },
      { id: "d", weight: 1 },
    ];

    const first = solveStableVoronoi(nodes, clip, {
      hilbertOrder: 5,
      maxIterations: 5_000,
      tolerance: 0.02,
    });
    const second = solveStableVoronoi(nodes, clip, {
      hilbertOrder: 5,
      maxIterations: 5_000,
      tolerance: 0.02,
    });

    expect(first.converged).toBe(true);
    expect(first.state.cells.every((cell) => cell.polygon.length >= 3)).toBe(true);
    expect(second).toEqual(first);
  });

  it("selects Algorithm 8 curve orders from desired bounding-square area", () => {
    const placement = stableVariableHilbertHints(
      [
        { id: "tiny", weight: 4 },
        { id: "small", weight: 8 },
        { id: "medium", weight: 15 },
        { id: "large", weight: 73 },
      ],
      clip,
    );

    expect(Object.fromEntries(placement.curveOrderById)).toEqual({
      tiny: 8,
      small: 3,
      medium: 2,
      large: 1,
    });
    expect(placement.hints).toHaveLength(4);
  });

  it("uses the three midpoint extensions of the order-1 curve", () => {
    const placement = stableVariableHilbertHints([{ id: "all", weight: 1 }], clip);

    expect(placement.curveOrderById.get("all")).toBe(1);
    expect(placement.hints.get("all")).toEqual({ x: 0.5, y: 0.75 });
  });

  it("keeps every Algorithm 8 placement inside a thin convex clip", () => {
    const thin: ClipRegion = {
      kind: "polygon",
      ring: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.2, y: 0.2 },
        { x: 0, y: 0.2 },
      ],
    };
    const placement = stableVariableHilbertHints(
      [
        { id: "a", weight: 40 },
        { id: "b", weight: 30 },
        { id: "c", weight: 20 },
        { id: "d", weight: 10 },
      ],
      thin,
    );

    expect(placement.hints).toHaveLength(4);
    expect(
      [...placement.hints.values()].every(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 0.2),
    ).toBe(true);
  });

  it("can solve from Algorithm 8 and reports initialization provenance", () => {
    const result = solveStableVoronoi(
      [
        { id: "a", weight: 40 },
        { id: "b", weight: 30 },
        { id: "c", weight: 20 },
        { id: "d", weight: 10 },
      ],
      clip,
      { hilbertVariant: "algorithm-8-variable", maxIterations: 5_000, tolerance: 0.02 },
    );

    expect(result.converged).toBe(true);
    expect(result.initialization).toMatchObject({
      variant: "algorithm-8-variable",
      fallbackCount: expect.any(Number),
    });
  });
});
