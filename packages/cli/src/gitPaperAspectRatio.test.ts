import { describe, expect, it } from "vitest";
import {
  GIT_PAPER_ASPECT_RATIO_ABSOLUTE_TOLERANCE,
  assessGitPaperAspectRatio,
  meanGitRectangleAspectRatio,
  meanOfGitRevisionAspectRatioMeans,
  publishedGitAspectRatio,
} from "./gitPaperAspectRatio.ts";

describe("GIT paper aspect-ratio reproduction gate", () => {
  it("reads the GIT value for a named dataset from the published table", () => {
    const table = [
      ",AudioKit,standard,uws",
      "ApproximationTreeMap,0.6,0.7,0.8",
      "git,0.4,0.37739429985505796,0.3",
    ].join("\n");

    expect(publishedGitAspectRatio(table, "standard")).toBe(0.37739429985505796);
  });

  it("averages every active leaf-revision rectangle as one observation", () => {
    const result = meanGitRectangleAspectRatio(["a 0 0 20 10\nb 20 0 10 10\n", "c 0 0 40 10\n"]);

    expect(result).toEqual({
      observationCount: 3,
      revisionCount: 2,
      meanAspectRatio: (0.5 + 1 + 0.25) / 3,
    });
  });

  it("keeps the equal-revision aggregation as a non-gating diagnostic", () => {
    expect(
      meanOfGitRevisionAspectRatioMeans(["a 0 0 20 10\nb 20 0 10 10\n", "c 0 0 40 10\n"]),
    ).toBe(((0.5 + 1) / 2 + 0.25) / 2);
  });

  it("uses a predeclared absolute tolerance of 1e-9", () => {
    expect(GIT_PAPER_ASPECT_RATIO_ABSOLUTE_TOLERANCE).toBe(1e-9);
    expect(assessGitPaperAspectRatio(0.5 + 0.5e-9, 0.5).passed).toBe(true);
    expect(assessGitPaperAspectRatio(0.5 + 2e-9, 0.5).passed).toBe(false);
  });
});
