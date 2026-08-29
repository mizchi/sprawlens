import { describe, expect, it } from "vitest";
import { solverLoopBudget } from "./useSolverLoop.ts";

describe("solverLoopBudget", () => {
  it("uses the available visible-frame time budget before repainting", () => {
    expect(solverLoopBudget(false)).toEqual({
      solverMs: 10,
      innerMs: 6,
      maxSteps: 16,
    });
  });

  it("keeps the larger hidden-tab catch-up budget", () => {
    expect(solverLoopBudget(true)).toEqual({
      solverMs: 150,
      innerMs: 60,
      maxSteps: 60,
    });
  });
});
