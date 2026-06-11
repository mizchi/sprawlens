import { describe, expect, it } from "vitest";
import { parseGitStatus } from "./workingDiff.js";

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
