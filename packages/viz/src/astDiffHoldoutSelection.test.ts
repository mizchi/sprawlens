import { describe, expect, it } from "vitest";
import {
  parseGitCommitParents,
  parseGitNumstat,
  selectAstDiffHoldoutFiles,
} from "./astDiffHoldoutSelection.ts";

describe("selectAstDiffHoldoutFiles", () => {
  it("selects one metadata-only source-file case per commit in input order", () => {
    const result = selectAstDiffHoldoutFiles(
      [
        {
          revision: "after-1",
          parents: ["before-1"],
          files: [
            { path: "src/z.ts", added: 4, deleted: 2 },
            { path: "src/a.ts", added: 3, deleted: 1 },
          ],
        },
        {
          revision: "after-2",
          parents: ["before-2"],
          files: [{ path: "src/b.tsx", added: 8, deleted: 3 }],
        },
      ],
      { count: 2, minChangedLines: 2, maxChangedLines: 100 },
    );

    expect(result.cases).toEqual([
      {
        beforeRevision: "before-1",
        afterRevision: "after-1",
        file: "src/a.ts",
        addedLines: 3,
        deletedLines: 1,
      },
      {
        beforeRevision: "before-2",
        afterRevision: "after-2",
        file: "src/b.tsx",
        addedLines: 8,
        deletedLines: 3,
      },
    ]);
  });

  it("excludes merges, tests, generated files, repeated paths, prior cases, and size outliers", () => {
    const result = selectAstDiffHoldoutFiles(
      [
        {
          revision: "merge",
          parents: ["p1", "p2"],
          files: [{ path: "src/merge.ts", added: 3, deleted: 2 }],
        },
        {
          revision: "noise",
          parents: ["p"],
          files: [
            { path: "src/a.test.ts", added: 3, deleted: 2 },
            { path: "src/a.vitest.ts", added: 3, deleted: 2 },
            { path: "src/a.mock-setup.ts", added: 3, deleted: 2 },
            { path: "tsslint.config.ts", added: 3, deleted: 2 },
            { path: "src/generated/client.ts", added: 3, deleted: 2 },
            { path: "src/tiny.ts", added: 1, deleted: 0 },
            { path: "src/huge.ts", added: 101, deleted: 0 },
          ],
        },
        {
          revision: "used",
          parents: ["p"],
          files: [{ path: "src/used.ts", added: 3, deleted: 2 }],
        },
        {
          revision: "first",
          parents: ["p"],
          files: [{ path: "src/repeated.ts", added: 3, deleted: 2 }],
        },
        {
          revision: "second",
          parents: ["p"],
          files: [
            { path: "src/repeated.ts", added: 5, deleted: 2 },
            { path: "src/final.mts", added: 5, deleted: 2 },
          ],
        },
      ],
      {
        count: 2,
        minChangedLines: 2,
        maxChangedLines: 100,
        excludedCaseKeys: new Set(["used\0src/used.ts"]),
      },
    );

    expect(result.cases.map((item) => item.file)).toEqual(["src/repeated.ts", "src/final.mts"]);
    expect(result.audit).toMatchObject({
      commitsVisited: 5,
      mergeCommits: 1,
      excludedByPath: 5,
      excludedBySize: 2,
      excludedPriorCases: 1,
      excludedRepeatedFiles: 1,
    });
  });

  it("parses Git metadata without reading source contents", () => {
    expect(parseGitCommitParents("abc\tparent\ndef\tp1 p2\n")).toEqual([
      { revision: "abc", parents: ["parent"] },
      { revision: "def", parents: ["p1", "p2"] },
    ]);
    expect(parseGitNumstat("3\t2\tsrc/a.ts\n-\t-\tassets/logo.png\n1\t0\tsrc/b.tsx\n")).toEqual([
      { path: "src/a.ts", added: 3, deleted: 2 },
      { path: "src/b.tsx", added: 1, deleted: 0 },
    ]);
  });
});
