import { describe, expect, it } from "vitest";
import {
  assertAstDiffMixedRegimeRepositoryPins,
  summarizeAstDiffMixedRegimeFeasibility,
  type AstDiffMixedRegimeRepositoryScan,
} from "./ast-diff-mixed-regime-feasibility.ts";

describe("summarizeAstDiffMixedRegimeFeasibility", () => {
  it("passes only when both pure regimes satisfy the fixed case, repository, and owner gates", () => {
    const scans = [
      repository("alpha/one", [...cases("naive", 5), ...cases("indexed", 5)]),
      repository("beta/two", [...cases("naive", 5), ...cases("indexed", 5)]),
      repository("gamma/three", [...cases("naive", 5), ...cases("indexed", 5)]),
    ];

    expect(summarizeAstDiffMixedRegimeFeasibility(scans, 4.6917628829515525)).toMatchObject({
      feasible: true,
      threshold: 4.6917628829515525,
      totals: { candidates: 30, pureNaive: 15, pureIndexed: 15, mixed: 0 },
      gates: {
        pureNaive: {
          passed: true,
          cases: 15,
          eligibleRepositories: 3,
          eligibleOwners: 3,
        },
        pureIndexed: {
          passed: true,
          cases: 15,
          eligibleRepositories: 3,
          eligibleOwners: 3,
        },
      },
      reasons: [],
    });
  });

  it("fails transparently when indexed cases come from too few repositories", () => {
    const scans = [
      repository("alpha/one", [...cases("naive", 5), ...cases("indexed", 15)]),
      repository("beta/two", cases("naive", 5)),
      repository("gamma/three", cases("naive", 5)),
    ];
    const result = summarizeAstDiffMixedRegimeFeasibility(scans, 4.6917628829515525);

    expect(result.feasible).toBe(false);
    expect(result.gates.pureIndexed).toMatchObject({
      passed: false,
      cases: 15,
      eligibleRepositories: 1,
      eligibleOwners: 1,
    });
    expect(result.reasons).toContain(
      "pure-indexed requires >=15 cases and >=3 repositories from >=3 owners with >=3 cases each",
    );
  });

  it("keeps the threshold boundary in the naive branch", () => {
    const boundary = repository("alpha/one", [
      {
        afterRevision: "boundary",
        files: [{ symbolCount: 10, hunkCount: 10, workRatio: 4.6917628829515525 }],
      },
    ]);

    expect(
      summarizeAstDiffMixedRegimeFeasibility([boundary], 4.6917628829515525).repositories[0],
    ).toMatchObject({ pureNaive: 1, pureIndexed: 0, mixed: 0 });
  });

  it("rejects a mistyped commit pin before a repository scan starts", () => {
    expect(() =>
      assertAstDiffMixedRegimeRepositoryPins([
        { repository: "alpha/one", pinnedHead: "a".repeat(41) },
      ]),
    ).toThrow(/full commit SHA/i);
  });
});

function repository(
  repository: string,
  candidates: AstDiffMixedRegimeRepositoryScan["candidates"],
): AstDiffMixedRegimeRepositoryScan {
  return { repository, owner: repository.split("/")[0]!, pinnedHead: "a".repeat(40), candidates };
}

function cases(strategy: "naive" | "indexed", count: number) {
  const workRatio = strategy === "naive" ? 1 : 10;
  return Array.from({ length: count }, (_, index) => ({
    afterRevision: `${strategy}-${index}`,
    files: [{ symbolCount: 100, hunkCount: 10, workRatio }],
  }));
}
