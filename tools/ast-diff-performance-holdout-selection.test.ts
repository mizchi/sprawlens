import { describe, expect, it } from "vitest";
import { selectAstDiffPerformanceQuantiles } from "./ast-diff-performance-holdout-selection.ts";

describe("selectAstDiffPerformanceQuantiles", () => {
  it("selects deterministic change-size quantiles without timing outcomes", () => {
    const candidates = Array.from({ length: 9 }, (_, index) => ({
      beforeRevision: `${index}`.repeat(40),
      afterRevision: `${index + 1}`.repeat(40),
      changedSourceFiles: (index % 3) + 1,
      changedLines: (index + 1) * 10,
    })).reverse();

    expect(selectAstDiffPerformanceQuantiles(candidates)).toEqual([
      expect.objectContaining({ label: "min", changedLines: 10, candidateRank: 1 }),
      expect.objectContaining({ label: "q1", changedLines: 30, candidateRank: 3 }),
      expect.objectContaining({ label: "median", changedLines: 50, candidateRank: 5 }),
      expect.objectContaining({ label: "q3", changedLines: 70, candidateRank: 7 }),
      expect.objectContaining({ label: "max", changedLines: 90, candidateRank: 9 }),
    ]);
    expect(
      selectAstDiffPerformanceQuantiles(candidates).map((item) => item.candidateCount),
    ).toEqual([9, 9, 9, 9, 9]);
  });

  it("rejects insufficient and duplicate candidate revisions", () => {
    const candidate = {
      beforeRevision: "a".repeat(40),
      afterRevision: "b".repeat(40),
      changedSourceFiles: 1,
      changedLines: 10,
    };
    expect(() => selectAstDiffPerformanceQuantiles([candidate])).toThrow(/at least 5/i);
    expect(() =>
      selectAstDiffPerformanceQuantiles(Array.from({ length: 5 }, () => candidate)),
    ).toThrow(/duplicate/i);
  });
});
