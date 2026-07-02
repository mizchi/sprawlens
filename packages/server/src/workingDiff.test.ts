import { describe, expect, it } from "vitest";
import {
  countLines,
  isIgnoredPath,
  isSafeRef,
  parseGitStatus,
  parseNameStatus,
  parseNumstat,
  parseUnifiedDiffHunks,
  touchCountFromHunks,
} from "./workingDiff.ts";

describe("countLines", () => {
  it("counts a trailing-newline file by its lines, not its breaks", () => {
    expect(countLines("a\nb\nc\n")).toBe(3);
  });
  it("counts a file with no trailing newline", () => {
    expect(countLines("a\nb\nc")).toBe(3);
  });
  it("treats empty content as zero", () => {
    expect(countLines("")).toBe(0);
  });
  it("counts a single non-empty line", () => {
    expect(countLines("solo")).toBe(1);
  });
});

describe("parseGitStatus", () => {
  it("maps porcelain codes to the history-diff shape", () => {
    const out = parseGitStatus(
      [
        " M src/core/scan.ts",
        "M  src/ui/App.tsx",
        "MM src/cli/main.ts",
        "?? src/new/file.ts",
        "A  src/staged/new.ts",
        " D src/gone/old.ts",
        "R  src/before.ts -> src/after.ts",
        "",
      ].join("\n"),
    );
    expect(out.changed).toEqual({
      "src/core/scan.ts": "modified",
      "src/ui/App.tsx": "modified",
      "src/cli/main.ts": "modified",
      "src/new/file.ts": "added",
      "src/staged/new.ts": "added",
      "src/after.ts": "added",
    });
    expect(out.removed.sort()).toEqual(["src/before.ts", "src/gone/old.ts"]);
  });

  it("returns empty maps for a clean tree", () => {
    const out = parseGitStatus("");
    expect(out.changed).toEqual({});
    expect(out.removed).toEqual([]);
  });
});

describe("parseNameStatus", () => {
  it("maps git diff --name-status lines", () => {
    const out = parseNameStatus(
      [
        "M\tsrc/core/scan.ts",
        "A\tsrc/new/file.ts",
        "D\tsrc/gone/old.ts",
        "R087\tsrc/before.ts\tsrc/after.ts",
        "T\tsrc/core/link.ts",
        "",
      ].join("\n"),
    );
    expect(out.changed).toEqual({
      "src/core/scan.ts": "modified",
      "src/new/file.ts": "added",
      "src/after.ts": "added",
      "src/core/link.ts": "modified",
    });
    expect(out.removed.sort()).toEqual(["src/before.ts", "src/gone/old.ts"]);
  });
});

describe("parseNumstat", () => {
  it("maps added and deleted line counts by path", () => {
    expect(
      parseNumstat(["12\t3\tsrc/a.ts", "0\t8\tsrc/b.ts", "-\t-\tassets/logo.png", ""].join("\n")),
    ).toEqual({
      "src/a.ts": { added: 12, deleted: 3 },
      "src/b.ts": { added: 0, deleted: 8 },
    });
  });
});

describe("parseUnifiedDiffHunks", () => {
  it("keeps zero-context hunk ranges under their new path", () => {
    const hunks = parseUnifiedDiffHunks(
      [
        "diff --git a/src/a.ts b/src/a.ts",
        "index 111..222 100644",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -10,2 +10,4 @@ function a()",
        "@@ -30 +32,0 @@ function gone()",
        "diff --git a/src/old.ts b/src/new.ts",
        "similarity index 80%",
        "rename from src/old.ts",
        "rename to src/new.ts",
        "--- a/src/old.ts",
        "+++ b/src/new.ts",
        "@@ -1 +1 @@",
        "",
      ].join("\n"),
    );
    expect(hunks).toEqual({
      "src/a.ts": [
        { oldStart: 10, oldLines: 2, newStart: 10, newLines: 4 },
        { oldStart: 30, oldLines: 1, newStart: 32, newLines: 0 },
      ],
      "src/new.ts": [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1 }],
    });
  });
});

describe("touchCountFromHunks", () => {
  it("counts replacement hunks once and deletion hunks by removed lines", () => {
    expect(
      touchCountFromHunks([
        { oldStart: 10, oldLines: 1, newStart: 10, newLines: 1 },
        { oldStart: 20, oldLines: 2, newStart: 20, newLines: 0 },
        { oldStart: 30, oldLines: 0, newStart: 28, newLines: 4 },
      ]),
    ).toBe(7);
  });
});

describe("isSafeRef", () => {
  it("accepts normal refs and rejects option-like or empty input", () => {
    expect(isSafeRef("HEAD~3")).toBe(true);
    expect(isSafeRef("main")).toBe(true);
    expect(isSafeRef("origin/main")).toBe(true);
    expect(isSafeRef("v1.2.0")).toBe(true);
    expect(isSafeRef("a1b2c3d")).toBe(true);
    expect(isSafeRef("HEAD@{1}")).toBe(true);
    expect(isSafeRef("--output=/tmp/x")).toBe(false);
    expect(isSafeRef("-p")).toBe(false);
    expect(isSafeRef("")).toBe(false);
    expect(isSafeRef("main; rm -rf /")).toBe(false);
  });
});

describe("isIgnoredPath", () => {
  it("filters watcher noise but keeps source paths", () => {
    expect(isIgnoredPath(".git/index")).toBe(true);
    expect(isIgnoredPath("node_modules/x/y.js")).toBe(true);
    expect(isIgnoredPath("dist/atlas/app.js")).toBe(true);
    expect(isIgnoredPath(".codesprawl/snapshots/a.json")).toBe(true);
    expect(isIgnoredPath("src/core/scan.ts")).toBe(false);
    expect(isIgnoredPath("src/distribution/x.ts")).toBe(false);
    expect(isIgnoredPath("atlas.html")).toBe(false);
  });
});
