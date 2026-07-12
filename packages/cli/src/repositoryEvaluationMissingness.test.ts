import { describe, expect, it } from "vitest";
import { summarizeMissingnessSensitivity } from "./repositoryEvaluationMissingness.ts";

describe("post-hoc missingness sensitivity", () => {
  it("adds recovered repository means without replacing the primary estimate", () => {
    const result = summarizeMissingnessSensitivity(
      [
        {
          repository: "owner/a",
          adjacencyGain: 0,
          edgeLengthReduction: 0.01,
          displacementReduction: 0.1,
          objectiveReduction: 0.05,
          stepReduction: -10,
        },
        {
          repository: "owner/b",
          adjacencyGain: 0.01,
          edgeLengthReduction: 0.02,
          displacementReduction: 0.2,
          objectiveReduction: 0.1,
          stepReduction: -20,
        },
      ],
      [
        {
          repository: "owner/recovered",
          adjacencyGain: 0.02,
          edgeLengthReduction: 0.03,
          displacementReduction: 0.3,
          objectiveReduction: 0.15,
          stepReduction: -30,
        },
      ],
    );

    expect(result).toMatchObject({
      status: "post-hoc missingness sensitivity; primary estimate unchanged",
      primaryRepositories: 2,
      recoveredRepositories: 1,
      combinedRepositories: 3,
      contrasts: {
        adjacencyGain: { n: 3, mean: 0.01 },
        displacementReduction: { n: 3 },
        stepReduction: { n: 3, mean: -20 },
      },
    });
    expect(result.contrasts.displacementReduction.mean).toBeCloseTo(0.2);
    expect(result.repositories.map(({ repository }) => repository)).toEqual([
      "owner/a",
      "owner/b",
      "owner/recovered",
    ]);
  });

  it("rejects duplicate repositories across primary and recovered inputs", () => {
    const effect = {
      repository: "owner/a",
      adjacencyGain: 0,
      edgeLengthReduction: 0,
      displacementReduction: 0,
      objectiveReduction: 0,
      stepReduction: 0,
    };
    expect(() => summarizeMissingnessSensitivity([effect], [effect])).toThrow(/duplicate/);
  });
});
