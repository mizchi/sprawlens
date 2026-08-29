import { describe, expect, it } from "vitest";
import type { CodeSymbol, FileNode } from "@sprawlens/contracts";
import { matchFileContinuity } from "./fileIdentity.ts";

function symbol(kind: CodeSymbol["kind"], name: string, fingerprint?: string): CodeSymbol {
  return {
    id: `symbol:${name}`,
    kind,
    name,
    startLine: 1,
    endLine: 2,
    loc: 2,
    complexity: 1,
    exported: true,
    fingerprint,
  };
}

function file(path: string, symbols: CodeSymbol[]): FileNode {
  return {
    id: `file:${path}`,
    type: "file",
    path,
    ext: ".ts",
    loc: 10,
    sizeBytes: 100,
    symbols,
  };
}

describe("matchFileContinuity", () => {
  it("matches a unique rename by complete structural fingerprints", () => {
    const before = [
      file("old.ts", [symbol("function", "alpha", "aa"), symbol("class", "Beta", "bb")]),
    ];
    const after = [
      file("new.ts", [symbol("class", "Beta", "bb"), symbol("function", "alpha", "aa")]),
    ];

    expect(matchFileContinuity(before, after).matches).toEqual([
      expect.objectContaining({
        beforePath: "old.ts",
        afterPath: "new.ts",
        evidence: "fingerprint",
        symbolCount: 2,
      }),
    ]);
  });

  it("does not report a path-stable file as a rename", () => {
    const stable = file("same.ts", [symbol("function", "alpha"), symbol("class", "Beta")]);
    expect(matchFileContinuity([stable], [stable])).toMatchObject({
      matches: [],
      unmatchedBeforePaths: [],
      unmatchedAfterPaths: [],
    });
  });

  it("falls back to an order-independent declaration signature", () => {
    const before = [file("old.ts", [symbol("function", "alpha"), symbol("class", "Beta")])];
    const after = [file("new.ts", [symbol("class", "Beta"), symbol("function", "alpha")])];

    expect(matchFileContinuity(before, after).matches[0]).toMatchObject({
      beforePath: "old.ts",
      afterPath: "new.ts",
      evidence: "declaration",
    });
  });

  it("abstains when either side has a duplicate signature", () => {
    const symbols = [symbol("function", "alpha"), symbol("class", "Beta")];
    const result = matchFileContinuity(
      [file("old-a.ts", symbols), file("old-b.ts", symbols)],
      [file("new.ts", symbols)],
    );

    expect(result.matches).toEqual([]);
    expect(result.ambiguous).toEqual([
      expect.objectContaining({
        evidence: "declaration",
        beforePaths: ["old-a.ts", "old-b.ts"],
        afterPaths: ["new.ts"],
      }),
    ]);
  });

  it("requires at least two symbols by default and exposes the threshold", () => {
    const before = [file("old.ts", [symbol("function", "alpha")])];
    const after = [file("new.ts", [symbol("function", "alpha")])];

    expect(matchFileContinuity(before, after).matches).toEqual([]);
    expect(matchFileContinuity(before, after, { minimumSymbolCount: 1 }).matches).toHaveLength(1);
  });

  it("keeps every accepted mapping one-to-one across evidence tiers", () => {
    const before = [
      file("strong-old.ts", [symbol("function", "a", "11"), symbol("function", "b", "22")]),
      file("weak-old.ts", [symbol("function", "c"), symbol("function", "d")]),
    ];
    const after = [
      file("weak-new.ts", [symbol("function", "d"), symbol("function", "c")]),
      file("strong-new.ts", [symbol("function", "b", "22"), symbol("function", "a", "11")]),
    ];
    const result = matchFileContinuity(before, after);

    expect(result.matches).toHaveLength(2);
    expect(new Set(result.matches.map((match) => match.beforePath)).size).toBe(2);
    expect(new Set(result.matches.map((match) => match.afterPath)).size).toBe(2);
  });

  it("exhaustively abstains from the small duplicate-signature state space", () => {
    const shared = [symbol("function", "alpha"), symbol("class", "Beta")];
    for (let beforeCount = 0; beforeCount <= 3; beforeCount += 1) {
      for (let afterCount = 0; afterCount <= 3; afterCount += 1) {
        const before = Array.from({ length: beforeCount }, (_, index) =>
          file(`old-${index}.ts`, shared),
        );
        const after = Array.from({ length: afterCount }, (_, index) =>
          file(`new-${index}.ts`, shared),
        );
        const result = matchFileContinuity(before, after);
        expect(result.matches.length).toBe(beforeCount === 1 && afterCount === 1 ? 1 : 0);
        expect(new Set(result.matches.map(({ beforePath }) => beforePath)).size).toBe(
          result.matches.length,
        );
        expect(new Set(result.matches.map(({ afterPath }) => afterPath)).size).toBe(
          result.matches.length,
        );
      }
    }
  });

  it("rejects an invalid evidence threshold", () => {
    expect(() => matchFileContinuity([], [], { minimumSymbolCount: 0 })).toThrow(RangeError);
  });

  it("rejects duplicate paths inside one snapshot", () => {
    const duplicate = file("same.ts", [symbol("function", "alpha"), symbol("class", "Beta")]);
    expect(() => matchFileContinuity([duplicate, duplicate], [])).toThrow(/duplicate before path/);
  });
});
