import { describe, expect, it } from "vitest";
import { parseChangedAfterLines } from "./astDiffRepresentation.ts";

describe("parseChangedAfterLines", () => {
  it("expands replacement and addition hunks while excluding deletion-only hunks", () => {
    expect(
      parseChangedAfterLines(
        ["@@ -2 +2 @@", "@@ -10,2 +10,3 @@", "@@ -20,4 +21,0 @@", "@@ -30,0 +28,2 @@"].join("\n"),
      ),
    ).toEqual([2, 10, 11, 12, 28, 29]);
  });
});
