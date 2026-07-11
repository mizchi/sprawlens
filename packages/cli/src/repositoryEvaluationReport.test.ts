import { describe, expect, it } from "vitest";
import type { RepositoryEvaluationManifest } from "./repositoryEvaluationManifest.ts";
import {
  decideRepositoryEvaluationClaim,
  summarizeRepositoryEvaluation,
} from "./repositoryEvaluationReport.ts";

const sample = (mean: number, low: number, high: number, n = 12) => ({
  n,
  mean,
  sd: 0.1,
  ci95: [low, high] as const,
});

describe("repository evaluation report", () => {
  it("applies the preregistered two-part decision rule", () => {
    expect(
      decideRepositoryEvaluationClaim({
        includedRepositories: 12,
        displacementReduction: sample(0.2, 0.01, 0.39),
        adjacencyGain: sample(0, -0.005, 0.005),
      }),
    ).toEqual({
      minimumEligibleRepositories: 10,
      adjacencyNonInferiorityMargin: -0.01,
      eligibleForPrimaryInference: true,
      displacementSuperiority: true,
      adjacencyNonInferiority: true,
      status: "primary-supported",
    });
    expect(
      decideRepositoryEvaluationClaim({
        includedRepositories: 12,
        displacementReduction: sample(0.01, -0.02, 0.04),
        adjacencyGain: sample(0, -0.005, 0.005),
      }).status,
    ).toBe("partial-support");
    expect(
      decideRepositoryEvaluationClaim({
        includedRepositories: 12,
        displacementReduction: sample(0.01, -0.02, 0.04),
        adjacencyGain: sample(-0.02, -0.03, -0.01),
      }).status,
    ).toBe("not-supported");
    expect(
      decideRepositoryEvaluationClaim({
        includedRepositories: 9,
        displacementReduction: sample(0.2, 0.01, 0.39, 9),
        adjacencyGain: sample(0, -0.005, 0.005, 9),
      }).status,
    ).toBe("pilot-only");
  });

  it("keeps collection failures and zero-case repositories in the registered flow", () => {
    const repositories = [
      ["owner/analyzed-a", "TypeScript", "small"],
      ["owner/analyzed-b", "Go", "small"],
      ["owner/zero", "Rust", "medium"],
      ["owner/failed", "MoonBit", "large"],
    ].map(([fullName, language, sizeBand], index) => ({
      fullName: fullName!,
      language: language!,
      sizeBand: sizeBand!,
      sizeKb: 100 + index,
      stars: 1,
      defaultBranch: "main",
      head: String(index).padStart(40, "0"),
      committedAt: "2026-01-01T00:00:00Z",
      license: "MIT",
    })) as RepositoryEvaluationManifest["repositories"];
    const manifest = { repositories } as RepositoryEvaluationManifest;
    const contrast = {
      adjacencyGain: sample(0, 0, 0, 2),
      displacementReduction: sample(0.1, -0.1, 0.3, 2),
      stepReduction: sample(-10, -20, 0, 2),
    };
    const trial = (adjacencyGain: number, displacementReduction: number) => ({
      conditions: {
        stableNeighborhood: {
          adjacency: 0.5 + adjacencyGain,
          displacement: 0.2 - displacementReduction,
          converged: true,
        },
        neighborhoodSwap: { adjacency: 0.5, displacement: 0.2, converged: true },
      },
    });
    const benchmark = (
      trials: ReturnType<typeof trial>[],
      adjacencyGain: number,
      displacementReduction: number,
      stepReduction: number,
    ) => ({
      scenarios: [{ trials }],
      aggregate: {
        contrasts: {
          stableNeighborhoodVsNeighborhoodSwap: {
            adjacencyGain: sample(adjacencyGain, adjacencyGain, adjacencyGain),
            displacementReduction: sample(
              displacementReduction,
              displacementReduction,
              displacementReduction,
            ),
            stepReduction: sample(stepReduction, stepReduction, stepReduction),
          },
        },
      },
    });
    const batch = {
      repositories: [
        {
          dataset: { repository: "owner/analyzed-a", selection: { included: 3 } },
          benchmark: benchmark([trial(0, 0.1), trial(0, 0), trial(0, 0.2)], 0, 0.1, -10),
          exclusion: null,
        },
        {
          dataset: { repository: "owner/analyzed-b", selection: { included: 2 } },
          benchmark: benchmark([trial(0.01, 0.1), trial(0.01, 0.1)], 0.01, 0.1, -20),
          exclusion: null,
        },
        {
          dataset: { repository: "owner/zero", selection: { included: 0 } },
          benchmark: null,
          exclusion: { code: "mixed-selection-exclusions" },
        },
      ],
      repositorySummary: {
        includedRepositories: 2,
        excludedRepositories: 1,
        contrasts: { stableNeighborhoodVsNeighborhoodSwap: contrast },
      },
    };

    const summary = summarizeRepositoryEvaluation({
      manifest,
      collectionEntries: [
        { fullName: "owner/analyzed-a", status: "collected" },
        { fullName: "owner/analyzed-b", status: "collected" },
        { fullName: "owner/zero", status: "collected" },
        { fullName: "owner/failed", status: "failed", error: "analyzer aborted" },
      ],
      batch,
    });

    expect(summary.flow).toMatchObject({
      registeredRepositories: 4,
      collectedRepositories: 3,
      collectionFailedRepositories: 1,
      benchmarkExcludedRepositories: 1,
      analyzedRepositories: 2,
      cases: 5,
      trials: 5,
    });
    expect(summary.repositories).toEqual([
      expect.objectContaining({ fullName: "owner/analyzed-a", status: "analyzed", cases: 3 }),
      expect.objectContaining({ fullName: "owner/analyzed-b", status: "analyzed", cases: 2 }),
      expect.objectContaining({
        fullName: "owner/zero",
        status: "benchmark-excluded",
        reason: "mixed-selection-exclusions",
      }),
      expect.objectContaining({
        fullName: "owner/failed",
        status: "collection-failed",
        reason: "analyzer aborted",
      }),
    ]);
    expect(summary.byLanguage.TypeScript).toMatchObject({ registered: 1, analyzed: 1, cases: 3 });
    expect(summary.byLanguage.MoonBit).toMatchObject({
      registered: 1,
      collectionFailed: 1,
      analyzed: 0,
    });
    expect(summary.contractAudit).toEqual({
      trials: 5,
      adjacencyDominanceViolations: 0,
      displacementDominanceViolations: 0,
      stableNonconvergedTrials: 0,
      baselineNonconvergedTrials: 0,
      passed: true,
    });
    expect(summary.effectsByLanguage.TypeScript).toMatchObject({
      repositories: 1,
      adjacencyGain: { mean: 0 },
      displacementReduction: { mean: 0.1 },
      stepReduction: { mean: -10 },
    });
    expect(summary.effectsBySizeBand.small).toMatchObject({
      repositories: 2,
      adjacencyGain: { mean: 0.005 },
      displacementReduction: { mean: 0.1 },
      stepReduction: { mean: -15 },
    });
    expect(summary.decision.status).toBe("pilot-only");
  });
});
