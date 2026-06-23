import { bench, describe } from "vitest";
import { minCostAssignment } from "./assignment.js";
import { createRng } from "./rng.js";

/** Random n×n cost matrices at the slot-assignment cap (subdivision uses ≤128). */
function costMatrix(n: number, seed = 1): number[][] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => Array.from({ length: n }, () => Math.round(rng() * 1000)));
}

describe("minCostAssignment", () => {
  for (const n of [32, 64, 128]) {
    const cost = costMatrix(n);
    bench(`n=${n}`, () => {
      minCostAssignment(cost);
    });
  }
});
