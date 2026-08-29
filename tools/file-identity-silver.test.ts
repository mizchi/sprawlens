import { describe, expect, it } from "vitest";
import { compareIdentityPairs, parseGitRenameStatus } from "./file-identity-silver.ts";

describe("parseGitRenameStatus", () => {
  it("parses rename records and ignores non-rename status lines", () => {
    expect(
      parseGitRenameStatus(
        "R100\tsrc/old.ts\tsrc/new.ts\nM\tsrc/stable.ts\nA\tsrc/added.ts\nR067\ta.ts\tb.ts\n",
      ),
    ).toEqual([
      { beforePath: "src/old.ts", afterPath: "src/new.ts", similarity: 100 },
      { beforePath: "a.ts", afterPath: "b.ts", similarity: 67 },
    ]);
  });

  it("parses unquoted NUL-delimited paths", () => {
    expect(parseGitRenameStatus("R100\0src/a file.ts\0src/b file.ts\0")).toEqual([
      { beforePath: "src/a file.ts", afterPath: "src/b file.ts", similarity: 100 },
    ]);
  });
});

describe("compareIdentityPairs", () => {
  it("counts exact pair agreement without treating Git as ground truth", () => {
    expect(
      compareIdentityPairs(
        [
          { beforePath: "a.ts", afterPath: "b.ts" },
          { beforePath: "c.ts", afterPath: "d.ts" },
        ],
        [
          { beforePath: "a.ts", afterPath: "b.ts" },
          { beforePath: "e.ts", afterPath: "f.ts" },
        ],
      ),
    ).toEqual({ agreements: 1, predictionOnly: 1, silverOnly: 1 });
  });
});
