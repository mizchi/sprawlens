import { describe, expect, it } from "vitest";
import type { CodeSymbol, CodeSymbolImport } from "@sprawlens/contracts";
import {
  enclosingSymbol,
  mergeSymbolImports,
  pickExported,
  resolveSymbolReferences,
  symbolImportOf,
} from "./symbolRefs.ts";

function sym(id: string, name: string, startLine: number, endLine: number): CodeSymbol {
  return {
    id,
    kind: "function",
    name,
    startLine,
    endLine,
    loc: endLine - startLine + 1,
    complexity: 1,
    exported: true,
  };
}

function method(id: string, name: string, parentClass: string): CodeSymbol {
  return {
    id,
    kind: "method",
    name,
    startLine: 1,
    endLine: 2,
    loc: 2,
    complexity: 1,
    exported: true,
    parentClass,
  };
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

describe("pickExported", () => {
  const symbols = [
    method("new#A", "new", "Alpha"),
    method("new#B", "new", "Beta"),
    sym("free", "free", 1, 2),
  ];
  it("prefers the symbol whose parentClass matches the qualifier", () => {
    expect(pickExported(symbols, "new", "Beta")?.id).toBe("new#B");
  });
  it("falls back to the first name match when no class matches", () => {
    expect(pickExported(symbols, "new", "Gamma")?.id).toBe("new#A");
    expect(pickExported(symbols, "new", undefined)?.id).toBe("new#A");
  });
  it("returns null when no symbol has the name", () => {
    expect(pickExported(symbols, "missing", undefined)).toBeNull();
  });
});

describe("mergeSymbolImports", () => {
  const a: CodeSymbolImport = {
    imported: "x",
    local: "x",
    kind: "named",
    fromSymbolId: "f1",
    toSymbolId: "t1",
  };
  const dupOfA: CodeSymbolImport = { ...a, imported: "x2" }; // same from->to
  const b: CodeSymbolImport = { ...a, fromSymbolId: "f2" };
  it("appends only pairs not already present (deduped by from->to)", () => {
    const into: CodeSymbolImport[] = [a];
    mergeSymbolImports(into, [dupOfA, b]);
    expect(into.map((s) => `${s.fromSymbolId}->${s.toSymbolId}`)).toEqual(["f1->t1", "f2->t1"]);
  });
});

describe("symbolImportOf", () => {
  const sourceSymbols = [sym("make", "make", 5, 9)];
  const targetSymbols = [method("new#C", "new", "Calc"), method("new#D", "new", "Other")];
  it("resolves a Type::method ref to the method symbol of the matching class", () => {
    const si = symbolImportOf(
      { line: 6, name: "new", preferClass: "Calc" },
      sourceSymbols,
      targetSymbols,
    );
    expect(si).toEqual({
      imported: "new",
      local: "new",
      kind: "named",
      fromSymbolId: "make",
      fromSymbolName: "make",
      toSymbolId: "new#C",
      toSymbolName: "new",
    });
  });
  it("returns null when the target has no such symbol", () => {
    expect(symbolImportOf({ line: 6, name: "ghost" }, sourceSymbols, targetSymbols)).toBeNull();
  });
});
