import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSTRAINT_EPSILON,
  selectFeasibleEnvelope,
  selectVectorFeasibleEnvelope,
} from "./feasibleEnvelope.ts";

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

  it("cannot hide one discrete edge loss below the documented epsilon denominator bound", () => {
    const eligibleEdges = 1_000_000_000_000 - 1;
    const baseline = candidate("baseline", 1 / eligibleEdges, 1);
    const losesOneEdge = candidate("loses-one", 0, 0);

    expect(select(baseline, [baseline, losesOneEdge]).selected).toBe(baseline);

    const boundaryBaseline = candidate("boundary", DEFAULT_CONSTRAINT_EPSILON, 1);
    expect(select(boundaryBaseline, [boundaryBaseline, losesOneEdge]).selected).toBe(losesOneEdge);
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
      expect(result.selected.constraint + DEFAULT_CONSTRAINT_EPSILON).toBeGreaterThanOrEqual(
        result.minimumConstraint,
      );
      expect(result.selected.valid).toBe(true);
      expect(result.selected.cost).toBe(Math.min(...result.eligible.map((value) => value.cost)));
    }
  });
});

describe("vector feasible-envelope candidate selection", () => {
  it("intersects independent baseline-relative constraints", () => {
    const baseline = candidate("baseline", 0.8, 0.8, { quality: 0.1 });
    const losesAdjacency = candidate("loses-adjacency", 0.79, 0.1, { quality: 0.2 });
    const losesTopology = candidate("loses-topology", 0.9, 0.1, { quality: 0.09 });
    const feasible = candidate("feasible", 0.82, 0.3, { quality: 0.11 });

    const result = selectVectorFeasibleEnvelope({
      baseline,
      candidates: [baseline, losesAdjacency, losesTopology, feasible],
      constraints: [
        { name: "adjacency", score: (value) => value.constraint },
        { name: "topology", score: (value) => value.quality },
      ],
      isValid: (value) => value.valid,
      selectionCost: (value) => value.cost,
    });

    expect(result.minimumConstraints).toEqual({ adjacency: 0.8, topology: 0.1 });
    expect(result.eligible).toEqual([baseline, feasible]);
    expect(result.selected).toBe(feasible);
  });

  it("validates vector constraint names, scores, and tolerances", () => {
    const baseline = candidate("baseline", 0.8, 0.5);
    const common = {
      baseline,
      candidates: [baseline],
      isValid: (value: Candidate) => value.valid,
      selectionCost: (value: Candidate) => value.cost,
    };

    expect(() => selectVectorFeasibleEnvelope({ ...common, constraints: [] })).toThrow(
      "at least one constraint",
    );
    expect(() =>
      selectVectorFeasibleEnvelope({
        ...common,
        constraints: [
          { name: "same", score: (value) => value.constraint },
          { name: "same", score: (value) => value.quality },
        ],
      }),
    ).toThrow("unique");
    expect(() =>
      selectVectorFeasibleEnvelope({
        ...common,
        constraints: [{ name: "bad", score: () => Number.NaN }],
      }),
    ).toThrow("score must be finite");
    expect(() =>
      selectVectorFeasibleEnvelope({
        ...common,
        constraints: [{ name: "bad", score: (value) => value.constraint, tolerance: -1 }],
      }),
    ).toThrow("tolerance");
  });

  it("satisfies every floor over finite two-constraint combinations", () => {
    const baseline = candidate("baseline", 0.5, 3, { quality: 0.5 });
    const universe = [
      candidate("a", 0.4, 0, { quality: 0.7 }),
      candidate("b", 0.7, 2, { quality: 0.4 }),
      candidate("c", 0.6, 1, { quality: 0.6 }),
      candidate("d", 0.8, 0, { quality: 0.8, valid: false }),
    ];

    for (let mask = 0; mask < 1 << universe.length; mask++) {
      const candidates = [baseline, ...universe.filter((_, index) => (mask & (1 << index)) !== 0)];
      const result = selectVectorFeasibleEnvelope({
        baseline,
        candidates,
        constraints: [
          { name: "adjacency", score: (value) => value.constraint },
          { name: "topology", score: (value) => value.quality },
        ],
        isValid: (value) => value.valid,
        selectionCost: (value) => value.cost,
      });
      expect(result.selected.constraint + DEFAULT_CONSTRAINT_EPSILON).toBeGreaterThanOrEqual(0.5);
      expect(result.selected.quality + DEFAULT_CONSTRAINT_EPSILON).toBeGreaterThanOrEqual(0.5);
      expect(result.selected.cost).toBe(Math.min(...result.eligible.map((value) => value.cost)));
    }
  });
});
