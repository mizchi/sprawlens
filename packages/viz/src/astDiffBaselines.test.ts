import { describe, expect, it } from "vitest";
import type { AstDiffGoldCase } from "./astSymbolDiffEvaluation.ts";
import { predictAstDiffBaseline } from "./astDiffBaselines.ts";

const symbol = (
  id: string,
  name: string,
  kind: string,
  startLine: number,
  fingerprint: string,
  parentClass?: string,
) => ({
  id,
  name,
  kind,
  startLine,
  endLine: startLine + 2,
  loc: 3,
  complexity: 1,
  fingerprint,
  ...(parentClass ? { parentClass } : {}),
});

const beforeClass = symbol("before:A", "A", "class", 1, "class-a");
const afterClass = symbol("after:A", "A", "class", 1, "class-a");
const beforeRun = symbol("before:A.run", "run", "method", 5, "old", beforeClass.id);
const afterRun = symbol("after:A.run", "run", "method", 5, "new", afterClass.id);
const added = symbol("after:added", "added", "function", 20, "added");

const testCase: AstDiffGoldCase = {
  id: "baseline",
  language: "typescript",
  repository: "example/repo",
  beforeRevision: "before",
  afterRevision: "after",
  file: "src/a.ts",
  changeKinds: ["body-edit", "addition"],
  before: [beforeClass, beforeRun],
  after: [afterClass, afterRun, added],
  expected: [],
};

describe("predictAstDiffBaseline", () => {
  it("projects file-level highlighting onto every visible after symbol", () => {
    expect([...predictAstDiffBaseline("file-all-symbols", testCase, [5]).entries()]).toEqual([
      ["after:A", "modified"],
      ["after:A.run", "modified"],
      ["after:added", "added"],
    ]);
  });

  it("limits the range baseline to symbols overlapping changed after-lines", () => {
    expect([...predictAstDiffBaseline("range-overlap", testCase, [5, 20]).entries()]).toEqual([
      ["after:A.run", "modified"],
      ["after:added", "added"],
    ]);
  });

  it("separates flat structural matching from parent propagation", () => {
    expect([...predictAstDiffBaseline("structural-flat", testCase, [5]).entries()]).toEqual([
      ["after:A.run", "modified"],
      ["after:added", "added"],
    ]);
    expect([...predictAstDiffBaseline("parent-aware", testCase, [5]).entries()]).toEqual([
      ["after:A.run", "modified"],
      ["after:added", "added"],
      ["after:A", "modified"],
    ]);
  });
});
