import { describe, expect, it } from "vitest";
import { repositoryEvaluationVariant } from "./repositoryEvaluationVariants.ts";

describe("registered repository evaluation variants", () => {
  it("keeps primary and sensitivity parameters separate", () => {
    expect(repositoryEvaluationVariant("primary")).toEqual({
      name: "primary",
      evidence: "primary",
      grouping: "module",
      stableSwapPasses: [8],
    });
    expect(repositoryEvaluationVariant("directory-depth-2")).toMatchObject({
      evidence: "sensitivity",
      grouping: "directory",
      directoryDepth: 2,
      stableSwapPasses: [8],
    });
    expect(repositoryEvaluationVariant("repository-grouping")).toMatchObject({
      evidence: "sensitivity",
      grouping: "repository",
      stableSwapPasses: [8],
    });
    expect(repositoryEvaluationVariant("bounded-swap")).toMatchObject({
      evidence: "sensitivity",
      grouping: "module",
      stableSwapPasses: [0, 1, 8],
    });
  });

  it("rejects an unregistered post-hoc variant", () => {
    expect(() => repositoryEvaluationVariant("try-until-significant")).toThrow(/not registered/);
  });
});
