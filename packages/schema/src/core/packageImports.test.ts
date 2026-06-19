import { describe, expect, it } from "vitest";
import type { CodeSymbol } from "@sprawlens/contracts";
import { resolvePackageImports } from "./packageImports.js";

function sym(id: string, name: string, parentClass?: string): CodeSymbol {
  return {
    id, name, kind: parentClass ? "method" : "function",
    startLine: 1, endLine: 9, loc: 9, complexity: 1, exported: true,
    ...(parentClass ? { parentClass } : {}),
  };
}

const exported: Record<string, CodeSymbol[]> = {
  "pkg/a.mbt": [sym("a:Make", "make", "Counter"), sym("a:other", "other")],
  "pkg/b.mbt": [sym("b:id", "id")],
};
const exportedSymbolsOf = (rel: string) => exported[rel] ?? [];

describe("resolvePackageImports", () => {
  it("links a qualified use to the package file that exports it", () => {
    const edges = resolvePackageImports({
      fileId: "file:main.mbt",
      rel: "main.mbt",
      imports: [{ spec: "demo/pkg", alias: "pkg" }],
      uses: [{ line: 5, alias: "pkg", name: "id" }],
      symbols: [sym("main:run", "run")],
      exportedSymbolsOf,
      resolveImport: () => ({ local: ["pkg/a.mbt", "pkg/b.mbt"] }),
    });
    const toB = edges.find((e) => e.to === "file:pkg/b.mbt");
    expect(toB?.type === "imports" ? toB.symbolImports?.[0]?.toSymbolName : null).toBe("id");
    // the file that does not export `id` gets a resolved edge with no symbol ref
    const toA = edges.find((e) => e.to === "file:pkg/a.mbt");
    expect(toA?.type === "imports" ? toA.symbolImports : "x").toBeUndefined();
  });

  it("resolves a Type::method use to the method of the matching class", () => {
    const edges = resolvePackageImports({
      fileId: "file:main.mbt",
      rel: "main.mbt",
      imports: [{ spec: "demo/pkg", alias: "pkg" }],
      uses: [{ line: 5, alias: "pkg", name: "make", preferClass: "Counter" }],
      symbols: [sym("main:run", "run")],
      exportedSymbolsOf,
      resolveImport: () => ({ local: ["pkg/a.mbt"] }),
    });
    const toA = edges.find((e) => e.to === "file:pkg/a.mbt");
    expect(toA?.type === "imports" ? toA.symbolImports?.[0]?.toSymbolId : null).toBe("a:Make");
  });

  it("emits a deduped external edge and tags stdlib", () => {
    const edges = resolvePackageImports({
      fileId: "file:main.go",
      rel: "main.go",
      imports: [
        { spec: "github.com/x/y/sub", alias: "sub" },
        { spec: "github.com/x/y/other", alias: "other" },
        { spec: "fmt", alias: "fmt" },
      ],
      uses: [],
      symbols: [],
      exportedSymbolsOf,
      resolveImport: (spec) =>
        spec === "fmt"
          ? { external: "fmt", stdlib: true }
          : { external: "github.com/x/y" }, // both sub-packages group to one
    });
    const ext = edges.flatMap((e) => (e.type === "imports" && e.external ? [e] : []));
    expect(ext.map((e) => e.specifier).sort()).toEqual(["fmt", "github.com/x/y"]);
    expect(ext.find((e) => e.specifier === "fmt")?.stdlib).toBe(true);
  });

  it("never links a file to itself", () => {
    const edges = resolvePackageImports({
      fileId: "file:pkg/a.mbt",
      rel: "pkg/a.mbt",
      imports: [{ spec: "demo/pkg", alias: "pkg" }],
      uses: [],
      symbols: [],
      exportedSymbolsOf,
      resolveImport: () => ({ local: ["pkg/a.mbt", "pkg/b.mbt"] }),
    });
    expect(edges.some((e) => e.to === "file:pkg/a.mbt")).toBe(false);
    expect(edges.some((e) => e.to === "file:pkg/b.mbt")).toBe(true);
  });
});
