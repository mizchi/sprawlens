import { describe, expect, it } from "vitest";
import {
  isIgnoredPath,
  isSafeRef,
  parseGitStatus,
  parseNameStatus,
} from "./workingDiff.js";

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
