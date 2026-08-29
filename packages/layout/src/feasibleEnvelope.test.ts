import { describe, expect, it } from "vitest";
import { selectFeasibleEnvelope } from "./feasibleEnvelope.ts";

type Candidate = {
  id: string;
  valid: boolean;
  constraint: number;
  cost: number;
  quality: number;
};

const candidate = (
  id: string,
  constraint: number,
  cost: number,
  overrides: Partial<Candidate> = {},
): Candidate => ({ id, valid: true, constraint, cost, quality: 0, ...overrides });

const select = (baseline: Candidate, candidates: readonly Candidate[], tolerance = 0) =>
  selectFeasibleEnvelope({
    baseline,
    candidates,
    tolerance,
    isValid: (value) => value.valid,
    constraintScore: (value) => value.constraint,
    selectionCost: (value) => value.cost,
    compareTieBreak: (left, right) =>
      left.quality - right.quality || left.id.localeCompare(right.id),
  });

describe("feasible-envelope candidate selection", () => {
  it("minimizes cost only inside the baseline-relative feasible set", () => {
    const baseline = candidate("baseline", 0.8, 0.7);
    const invalid = candidate("invalid", 1, 0.01, { valid: false });
    const belowFloor = candidate("below-floor", 0.79, 0.02);
    const eligible = candidate("eligible", 0.8, 0.3);

    const result = select(baseline, [baseline, invalid, belowFloor, eligible]);

    expect(result.minimumConstraint).toBe(0.8);
    expect(result.eligible).toEqual([baseline, eligible]);
    expect(result.selected).toBe(eligible);
    expect(result.usedFallback).toBe(false);
  });

  it("uses constraint, then caller tie-breaks, after equal selection cost", () => {
    const baseline = candidate("baseline", 0.8, 0.5);
    const lowerConstraint = candidate("lower", 0.8, 0.2);
    const higherQualityCost = candidate("z", 0.9, 0.2, { quality: 2 });
    const selected = candidate("a", 0.9, 0.2, { quality: 1 });

    expect(
      select(baseline, [baseline, lowerConstraint, higherQualityCost, selected]).selected,
    ).toBe(selected);
  });

  it("supports an explicit absolute constraint tolerance", () => {
    const baseline = candidate("baseline", 0.8, 0.5);
    const tolerated = candidate("tolerated", 0.75, 0.1);

    const result = select(baseline, [baseline, tolerated], 0.05);

    expect(result.minimumConstraint).toBeCloseTo(0.75);
    expect(result.selected).toBe(tolerated);
  });

  it("falls back to the declared baseline when no candidate is valid", () => {
    const baseline = candidate("baseline", 0.8, 0.5, { valid: false });
    const other = candidate("other", 1, 0.1, { valid: false });

    const result = select(baseline, [baseline, other]);

    expect(result.eligible).toEqual([]);
    expect(result.selected).toBe(baseline);
    expect(result.usedFallback).toBe(true);
  });

  it("checks the finite candidate-set contract", () => {
    const baseline = candidate("baseline", 0.8, 0.5);

    expect(() => select(baseline, [], 0)).toThrow("baseline must be included");
    expect(() => select(baseline, [baseline], -0.01)).toThrow("tolerance");
    expect(() => select(baseline, [baseline, candidate("bad", Number.NaN, 0.2)])).toThrow(
      "constraint score",
    );
  });

  it("satisfies the floor and minimum-cost invariant over finite combinations", () => {
    const baseline = candidate("baseline", 0.5, 3);
    const universe = [
      candidate("a", 0.4, 0),
      candidate("b", 0.5, 2),
      candidate("c", 0.7, 2),
      candidate("d", 0.8, 1, { valid: false }),
    ];

    for (let mask = 0; mask < 1 << universe.length; mask++) {
      const candidates = [baseline, ...universe.filter((_, index) => (mask & (1 << index)) !== 0)];
      const result = select(baseline, candidates);
      expect(result.selected.constraint + 1e-12).toBeGreaterThanOrEqual(result.minimumConstraint);
      expect(result.selected.valid).toBe(true);
      expect(result.selected.cost).toBe(Math.min(...result.eligible.map((value) => value.cost)));
    }
  });
});
