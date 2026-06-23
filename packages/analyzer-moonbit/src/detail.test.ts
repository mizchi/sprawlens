import { describe, expect, it } from "vitest";
import { parseReferences } from "./detail.ts";

// `moon ide find-references` output: the resolved definition followed by the
// reference locations, each as a `path:line:col-line:col:` header with code
// context lines in between.
const SAMPLE = [
  "Found 2 references for symbol 'when':",
  "/repo/option/deprecated.mbt:18:11-18:15:",
  "   |",
  "18 | pub fn[T] when(condition : Bool, value : () -> T) -> T? {",
  "   |           ^^^^",
  "/repo/app/main.mbt:42:3-42:7:",
  "   |",
  "42 |   when(true, fn() { 1 })",
  "   |   ^^^^",
].join("\n");

describe("parseReferences", () => {
  it("drops the definition and returns repo-relative incoming refs", () => {
    const refs = parseReferences(SAMPLE, "/repo", "when");
    expect(refs).toEqual([{ file: "app/main.mbt", name: "when", line: 42 }]);
  });

  it("returns nothing when only the definition is present", () => {
    const only = ["Found 1 references for symbol 'x':", "/repo/lib/x.mbt:3:1-5:2:"].join("\n");
    expect(parseReferences(only, "/repo", "x")).toEqual([]);
  });

  it("ignores non-location lines and empty output", () => {
    expect(parseReferences("no references found", "/repo", "y")).toEqual([]);
    expect(parseReferences("", "/repo", "y")).toEqual([]);
  });
});
