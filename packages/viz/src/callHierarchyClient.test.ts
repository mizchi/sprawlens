import { describe, expect, it } from "vitest";
import type { AtlasNode } from "@sprawlens/schema";
import { refsToEdges, resolveRef } from "./callHierarchyClient.js";

const symbolsByFile = new Map<string, AtlasNode[]>([
  [
    "src/a.ts",
    [
      {
        id: "symbol:src/a.ts:function:foo:10",
        kind: "symbol",
        label: "foo",
        metrics: { loc: 20 },
      },
      {
        id: "symbol:src/a.ts:class:Bar:40",
        kind: "symbol",
        label: "Bar",
        metrics: { loc: 30 },
      },
    ],
  ],
]);
const fileIds = new Set(["src/a.ts", "src/b.ts"]);

describe("resolveRef", () => {
  it("maps a reference to the symbol containing its line", () => {
    expect(
      resolveRef({ file: "src/a.ts", name: "x", line: 15 }, symbolsByFile, fileIds),
    ).toBe("symbol:src/a.ts:function:foo:10");
    // method of class Bar resolves to the class symbol by containment
    expect(
      resolveRef({ file: "src/a.ts", name: "method", line: 55 }, symbolsByFile, fileIds),
    ).toBe("symbol:src/a.ts:class:Bar:40");
  });

  it("falls back to name match, then to the file id", () => {
    expect(
      resolveRef({ file: "src/a.ts", name: "Bar", line: 999 }, symbolsByFile, fileIds),
    ).toBe("symbol:src/a.ts:class:Bar:40");
    expect(
      resolveRef({ file: "src/b.ts", name: "zzz", line: 1 }, symbolsByFile, fileIds),
    ).toBe("src/b.ts");
    expect(
      resolveRef({ file: "unknown.ts", name: "z", line: 1 }, symbolsByFile, fileIds),
    ).toBe(null);
  });
});

describe("refsToEdges", () => {
  it("builds direction-correct edges and skips unresolved or self refs", () => {
    const edges = refsToEdges(
      "symbol:src/a.ts:function:foo:10",
      {
        incoming: [
          { file: "src/a.ts", name: "Bar", line: 45 },
          { file: "unknown.ts", name: "x", line: 1 },
        ],
        outgoing: [
          { file: "src/b.ts", name: "helper", line: 3 },
          { file: "src/a.ts", name: "foo", line: 12 }, // self
        ],
      },
      symbolsByFile,
      fileIds,
    );
    expect(edges).toEqual([
      {
        source: "symbol:src/a.ts:class:Bar:40",
        target: "symbol:src/a.ts:function:foo:10",
      },
      { source: "symbol:src/a.ts:function:foo:10", target: "src/b.ts" },
    ]);
  });
});
