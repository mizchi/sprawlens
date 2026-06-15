import { describe, expect, it } from "vitest";
import type { CodeSymbol } from "@sprawlens/contracts";
import { enclosingSymbol, resolveSymbolReferences } from "./symbolRefs.js";

function sym(id: string, name: string, startLine: number, endLine: number): CodeSymbol {
  return { id, kind: "function", name, startLine, endLine, loc: endLine - startLine + 1, complexity: 1, exported: true };
}

describe("enclosingSymbol", () => {
  const symbols = [sym("a", "outer", 1, 20), sym("b", "inner", 5, 10)];
  it("returns the most specific symbol containing the line", () => {
    expect(enclosingSymbol(7, symbols)?.name).toBe("inner");
    expect(enclosingSymbol(15, symbols)?.name).toBe("outer");
  });
  it("returns null when no symbol contains the line", () => {
    expect(enclosingSymbol(99, symbols)).toBeNull();
  });
});

describe("resolveSymbolReferences", () => {
  const source = [sym("main", "main", 5, 9)];
  const targetExports = new Map([["NewServer", sym("api:NewServer", "NewServer", 3, 6)]]);

  it("links a used import to its target via the enclosing source symbol", () => {
    const refs = [{ line: 6, name: "NewServer" }];
    expect(resolveSymbolReferences(refs, source, targetExports)).toEqual([
      {
        imported: "NewServer",
        local: "NewServer",
        kind: "named",
        fromSymbolId: "main",
        fromSymbolName: "main",
        toSymbolId: "api:NewServer",
        toSymbolName: "NewServer",
      },
    ]);
  });

  it("drops names the target file does not export and dedupes pairs", () => {
    const refs = [
      { line: 6, name: "NewServer" },
      { line: 7, name: "NewServer" }, // same from->to, deduped
      { line: 6, name: "Unknown" }, // not in targetExports
    ];
    expect(resolveSymbolReferences(refs, source, targetExports)).toHaveLength(1);
  });
});
