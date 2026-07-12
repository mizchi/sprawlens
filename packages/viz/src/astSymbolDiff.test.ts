import { describe, expect, it } from "vitest";
import { diffAstSymbols } from "./astSymbolDiff.ts";

const symbol = (
  id: string,
  name: string,
  kind: string,
  startLine: number,
  endLine: number,
  options: { parentClass?: string; loc?: number; complexity?: number; fingerprint?: string } = {},
) => ({
  id,
  name,
  kind,
  startLine,
  endLine,
  loc: options.loc ?? endLine - startLine + 1,
  complexity: options.complexity ?? 1,
  ...(options.fingerprint ? { fingerprint: options.fingerprint } : {}),
  ...(options.parentClass ? { parentClass: options.parentClass } : {}),
});

describe("diffAstSymbols", () => {
  it("disambiguates same-name members by their parent and propagates changes to that parent", () => {
    const beforeA = "symbol:a.ts:class:A:1";
    const beforeB = "symbol:a.ts:class:B:20";
    const afterA = "symbol:a.ts:class:A:3";
    const afterB = "symbol:a.ts:class:B:22";
    const before = [
      symbol(beforeA, "A", "class", 1, 10, { loc: 4 }),
      symbol("symbol:a.ts:method:A.run:3", "run", "method", 3, 6, {
        parentClass: beforeA,
        complexity: 1,
      }),
      symbol(beforeB, "B", "class", 20, 30, { loc: 4 }),
      symbol("symbol:a.ts:method:B.run:22", "run", "method", 22, 25, {
        parentClass: beforeB,
      }),
    ];
    const after = [
      symbol(afterA, "A", "class", 3, 12, { loc: 4 }),
      symbol("symbol:a.ts:method:A.run:5", "run", "method", 5, 8, {
        parentClass: afterA,
        complexity: 2,
      }),
      symbol(afterB, "B", "class", 22, 32, { loc: 4 }),
      symbol("symbol:a.ts:method:B.run:24", "run", "method", 24, 27, {
        parentClass: afterB,
      }),
    ];

    const diff = diffAstSymbols(before, after);
    expect(diff.get("symbol:a.ts:method:A.run:5")).toBe("modified");
    expect(diff.get(afterA)).toBe("modified");
    expect(diff.has("symbol:a.ts:method:B.run:24")).toBe(false);
    expect(diff.has(afterB)).toBe(false);
  });

  it("marks an added child and its existing parent without treating line shifts as edits", () => {
    const beforeClass = "symbol:a.ts:class:A:1";
    const afterClass = "symbol:a.ts:class:A:4";
    const diff = diffAstSymbols(
      [symbol(beforeClass, "A", "class", 1, 8, { loc: 3 })],
      [
        symbol(afterClass, "A", "class", 4, 11, { loc: 3 }),
        symbol("symbol:a.ts:method:A.next:7", "next", "method", 7, 9, {
          parentClass: afterClass,
        }),
      ],
    );

    expect(diff.get("symbol:a.ts:method:A.next:7")).toBe("added");
    expect(diff.get(afterClass)).toBe("modified");
  });

  it("recovers class membership from legacy qualified member ids", () => {
    const diff = diffAstSymbols(
      [
        symbol("symbol:a.ts:class:Service:1", "Service", "class", 1, 10, { loc: 4 }),
        symbol("symbol:a.ts:method:Service.run:3", "run", "method", 3, 6),
      ],
      [
        symbol("symbol:a.ts:class:Service:4", "Service", "class", 4, 13, { loc: 4 }),
        symbol("symbol:a.ts:method:Service.run:6", "run", "method", 6, 10),
      ],
    );

    expect(diff.get("symbol:a.ts:method:Service.run:6")).toBe("modified");
    expect(diff.get("symbol:a.ts:class:Service:4")).toBe("modified");
  });

  it("detects same-size body edits when AST fingerprints are available", () => {
    const before = symbol("symbol:a.ts:function:run:1", "run", "function", 1, 4, {
      fingerprint: "old",
    });
    const after = symbol("symbol:a.ts:function:run:3", "run", "function", 3, 6, {
      fingerprint: "new",
    });
    expect(diffAstSymbols([before], [after]).get(after.id)).toBe("modified");
  });
});
