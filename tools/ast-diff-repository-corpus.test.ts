import { describe, expect, it } from "vitest";
import {
  parseAstDiffRepositoryChangedFiles,
  parseAstDiffRepositorySourceManifest,
} from "./ast-diff-repository-corpus.ts";

describe("parseAstDiffRepositorySourceManifest", () => {
  it("accepts the fixed development and performance-only manifests", () => {
    const manifest = {
      schemaVersion: 1,
      datasetId: "ast-diff-confirmatory-v1-phase1",
      cases: [
        {
          id: "case-a",
          repository: "owner/repo",
          repositoryPath: "../../../owner/repo",
          beforeRevision: "a".repeat(40),
          afterRevision: "b".repeat(40),
        },
      ],
    };
    expect(parseAstDiffRepositorySourceManifest(manifest)).toEqual(manifest);
    expect(
      parseAstDiffRepositorySourceManifest({
        ...manifest,
        datasetId: "ast-diff-adaptive-performance-holdout-v1",
      }),
    ).toEqual({
      ...manifest,
      datasetId: "ast-diff-adaptive-performance-holdout-v1",
    });
    expect(() =>
      parseAstDiffRepositorySourceManifest({
        ...manifest,
        datasetId: "ast-diff-confirmatory-v2-holdout",
      }),
    ).toThrow(/holdout/i);
  });
});

describe("parseAstDiffRepositoryChangedFiles", () => {
  it("preserves before/after paths for modified, added, deleted, and renamed source files", () => {
    expect(
      parseAstDiffRepositoryChangedFiles(
        [
          "M\tsrc/modified.ts",
          "A\tsrc/added.tsx",
          "D\tsrc/deleted.mts",
          "R087\tsrc/old.ts\tsrc/new.ts",
          "C100\tsrc/copied.js\tsrc/copied-again.js",
        ].join("\n"),
      ),
    ).toEqual([
      { status: "modified", beforePath: "src/modified.ts", afterPath: "src/modified.ts" },
      { status: "added", beforePath: null, afterPath: "src/added.tsx" },
      { status: "deleted", beforePath: "src/deleted.mts", afterPath: null },
      { status: "renamed", beforePath: "src/old.ts", afterPath: "src/new.ts" },
      {
        status: "copied",
        beforePath: "src/copied.js",
        afterPath: "src/copied-again.js",
      },
    ]);
  });

  it("matches analyzer exclusions and retains a source-side rename", () => {
    expect(
      parseAstDiffRepositoryChangedFiles(
        [
          "M\tsrc/api.d.ts",
          "M\tdist/bundle.js",
          "M\tnode_modules/pkg/index.ts",
          "M\tsrc/readme.md",
          "R100\tsrc/removed.ts\tdocs/removed.md",
          "R100\tdocs/added.md\tsrc/added.ts",
          "M\tsrc/kept.cts",
        ].join("\n"),
      ),
    ).toEqual([
      { status: "renamed", beforePath: "src/removed.ts", afterPath: "docs/removed.md" },
      { status: "renamed", beforePath: "docs/added.md", afterPath: "src/added.ts" },
      { status: "modified", beforePath: "src/kept.cts", afterPath: "src/kept.cts" },
    ]);
  });

  it("rejects unhandled historical statuses instead of silently changing the corpus", () => {
    expect(() => parseAstDiffRepositoryChangedFiles("U\tsrc/conflicted.ts\n")).toThrow(
      /unsupported/i,
    );
  });
});
