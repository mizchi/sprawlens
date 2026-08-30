import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selectVectorFeasibleEnvelope } from "./feasibleEnvelope.ts";

type ConstraintFixture = { name: string; tolerance: number; epsilon: number };
type CandidateFixture = {
  id: string;
  valid: boolean;
  scores: number[];
  cost: number;
  tieBreak: number;
};
type CaseFixture = {
  name: string;
  baselineId: string;
  constraints: ConstraintFixture[];
  candidates: CandidateFixture[];
  expected: { selectedId: string; eligibleIds: string[]; usedFallback: boolean };
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../formal/TestVectors/feasible-envelope.json", import.meta.url),
    "utf8",
  ),
) as { schemaVersion: number; cases: CaseFixture[] };

describe("Lean/TypeScript feasible-envelope conformance", () => {
  it("uses the versioned shared fixture", () => {
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it.each(fixture.cases)("matches $name", (testCase) => {
    const baseline = testCase.candidates.find(({ id }) => id === testCase.baselineId);
    if (!baseline) throw new Error(`${testCase.name}: missing baseline`);
    const result = selectVectorFeasibleEnvelope({
      baseline,
      candidates: testCase.candidates,
      constraints: testCase.constraints.map((constraint, index) => ({
        ...constraint,
        score: (candidate: CandidateFixture) => candidate.scores[index]!,
      })),
      isValid: (candidate) => candidate.valid,
      selectionCost: (candidate) => candidate.cost,
      compareTieBreak: (left, right) => left.tieBreak - right.tieBreak,
    });

    expect({
      selectedId: result.selected.id,
      eligibleIds: result.eligible.map(({ id }) => id),
      usedFallback: result.usedFallback,
    }).toEqual(testCase.expected);
  });
});
