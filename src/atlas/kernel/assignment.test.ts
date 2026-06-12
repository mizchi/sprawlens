import { describe, expect, it } from "vitest";
import { minCostAssignment } from "./assignment.js";

describe("minCostAssignment", () => {
  it("solves a trivial 1x1 matrix", () => {
    expect(minCostAssignment([[5]])).toEqual([0]);
  });

  it("picks the obvious diagonal when it is cheapest", () => {
    const assignment = minCostAssignment([
      [1, 10, 10],
      [10, 1, 10],
      [10, 10, 1],
    ]);
    expect(assignment).toEqual([0, 1, 2]);
  });

  it("solves the classic 3x3 example optimally", () => {
    // optimal: 0→1 (2), 1→0 (3), 2→2 (2) = 7
    const cost = [
      [4, 2, 8],
      [3, 5, 7],
      [9, 6, 2],
    ];
    const assignment = minCostAssignment(cost);
    expect(assignment).toEqual([1, 0, 2]);
  });

  it("returns a permutation that achieves the brute-force optimum", () => {
    // deterministic pseudo-random 7x7, checked against exhaustive search
    const n = 7;
    const cost: number[][] = [];
    let state = 12345;
    const next = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    for (let i = 0; i < n; i++) {
      cost.push(Array.from({ length: n }, () => Math.round(next() * 100)));
    }
    const assignment = minCostAssignment(cost);
    // valid permutation
    expect([...assignment].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const total = assignment.reduce((s, j, i) => s + cost[i]![j]!, 0);

    let best = Infinity;
    const permute = (rows: number[], used: Set<number>, sum: number) => {
      if (rows.length === n) {
        best = Math.min(best, sum);
        return;
      }
      for (let j = 0; j < n; j++) {
        if (used.has(j)) continue;
        used.add(j);
        permute([...rows, j], used, sum + cost[rows.length]![j]!);
        used.delete(j);
      }
    };
    permute([], new Set(), 0);
    expect(total).toBe(best);
  });

  it("handles zero-size input", () => {
    expect(minCostAssignment([])).toEqual([]);
  });
});
