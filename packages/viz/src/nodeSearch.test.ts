import { describe, expect, it } from "vitest";
import type { AtlasNodeKind } from "@sprawlens/schema";
import { searchNodesFuzzy, type SearchNode } from "./nodeSearch.ts";

const n = (id: string, label: string, kind: AtlasNodeKind = "file"): SearchNode => ({
  id,
  label,
  kind,
});

const ids = (rs: { id: string }[]) => rs.map((r) => r.id);

describe("searchNodesFuzzy", () => {
  it("returns nothing for an empty or whitespace query", () => {
    const nodes = [n("a", "App")];
    expect(searchNodesFuzzy("", nodes)).toEqual([]);
    expect(searchNodesFuzzy("   ", nodes)).toEqual([]);
  });

  it("drops nodes the query is not a subsequence of", () => {
    const nodes = [n("a", "App"), n("b", "Controls")];
    // "zzz" is a subsequence of neither label nor id
    expect(searchNodesFuzzy("zzz", nodes)).toEqual([]);
  });

  it("matches case-insensitively", () => {
    const nodes = [n("a", "App")];
    expect(ids(searchNodesFuzzy("app", nodes))).toEqual(["a"]);
    expect(ids(searchNodesFuzzy("APP", nodes))).toEqual(["a"]);
  });

  it("ranks exact > prefix > contiguous substring > gappy subsequence", () => {
    const nodes = [
      n("sub", "AjaxPopup"), // a..p..p gappy subsequence
      n("substr", "MyApp"), // contiguous "app", not at start
      n("prefix", "AppHeader"), // starts with "app"
      n("exact", "App"), // exact
    ];
    expect(ids(searchNodesFuzzy("app", nodes))).toEqual(["exact", "prefix", "substr", "sub"]);
  });

  it("ranks a label match above an id-only match", () => {
    const nodes = [
      n("app/Foo.tsx", "Foo"), // only the id contains "app"
      n("x/App.tsx", "App"), // label matches
    ];
    expect(ids(searchNodesFuzzy("app", nodes))[0]).toBe("x/App.tsx");
  });

  it("prefers the shorter label when match quality ties", () => {
    const nodes = [n("long", "ApplePieFactory"), n("short", "Apple")];
    expect(ids(searchNodesFuzzy("appl", nodes))).toEqual(["short", "long"]);
  });

  it("breaks a remaining tie by kind, leaves (symbol/file) before containers (module)", () => {
    const nodes = [n("m", "core", "module"), n("f", "core", "file")];
    expect(ids(searchNodesFuzzy("core", nodes))).toEqual(["f", "m"]);
  });

  it("rewards camelCase / word-boundary subsequence matches", () => {
    const nodes = [
      n("noise", "parametrize"), // r..m..s..v..g? not all; just a gappy distractor
      n("camel", "RingsMapSvg"), // R(ings)M(ap)S(vg) word boundaries
    ];
    // "rms" hits the capital-letter boundaries of RingsMapSvg
    expect(ids(searchNodesFuzzy("rms", nodes))[0]).toBe("camel");
  });

  it("respects the result limit", () => {
    const nodes = Array.from({ length: 30 }, (_, i) => n(`id${i}`, `App${i}`));
    expect(searchNodesFuzzy("app", nodes, 5)).toHaveLength(5);
  });

  it("carries kind and a numeric score on each result", () => {
    const results = searchNodesFuzzy("app", [n("a", "App", "symbol")]);
    expect(results[0]?.kind).toBe("symbol");
    expect(typeof results[0]?.score).toBe("number");
  });
});
