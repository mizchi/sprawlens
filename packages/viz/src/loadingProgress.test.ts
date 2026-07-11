import { describe, expect, it } from "vitest";
import { estimateSnapshotProgress, snapshotLoadingUi } from "./loadingProgress.ts";

describe("estimateSnapshotProgress", () => {
  it("starts visible, grows with elapsed time, and caps before completion", () => {
    expect(estimateSnapshotProgress(0)).toBe(8);
    expect(estimateSnapshotProgress(4_000)).toBeGreaterThan(estimateSnapshotProgress(500));
    expect(estimateSnapshotProgress(120_000)).toBe(94);
  });
});

describe("snapshotLoadingUi", () => {
  it("returns an indeterminate progress model for a loading remote repository", () => {
    expect(
      snapshotLoadingUi({ status: "loading", repo: "mizchi/sprawlens", elapsedMs: 2_000 }),
    ).toMatchObject({
      visible: true,
      tone: "loading",
      label: "Loading mizchi/sprawlens",
    });
  });

  it("shows completion and error states explicitly", () => {
    expect(snapshotLoadingUi({ status: "ready", repo: "mizchi/sprawlens" })).toMatchObject({
      visible: true,
      tone: "ready",
      percent: 100,
    });
    expect(
      snapshotLoadingUi({
        status: "error",
        repo: "mizchi/sprawlens",
        error: "GitHub API 403",
      }),
    ).toMatchObject({
      visible: true,
      tone: "error",
      label: "Failed to load mizchi/sprawlens: GitHub API 403",
    });
  });
});
