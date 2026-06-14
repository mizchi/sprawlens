import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "./graph.js";
import { defaultLayerOf, matchTestTargets, splitByLayer } from "./layers.js";

function fileNode(id: string, loc = 10) {
  return { id, kind: "file" as const, label: id, metrics: { loc } };
}

describe("defaultLayerOf", () => {
  it("classifies test files by suffix and directory conventions", () => {
    expect(defaultLayerOf("src/core/foo.test.ts")).toBe("test");
    expect(defaultLayerOf("src/core/foo.spec.tsx")).toBe("test");
    expect(defaultLayerOf("src/__tests__/bar.ts")).toBe("test");
    expect(defaultLayerOf("tests/e2e.ts")).toBe("test");
  });

  it("classifies test files in other languages by their conventions", () => {
    expect(defaultLayerOf("pkg/store/store_test.go")).toBe("test"); // Go
    expect(defaultLayerOf("src/lexer/token_test.mbt")).toBe("test"); // MoonBit blackbox
    expect(defaultLayerOf("src/lexer/token_wbtest.mbt")).toBe("test"); // MoonBit whitebox
    expect(defaultLayerOf("tests/integration.rs")).toBe("test"); // Rust integration dir
  });

  it("classifies everything else as source", () => {
    expect(defaultLayerOf("src/core/foo.ts")).toBe("source");
    expect(defaultLayerOf("src/testing-utils.ts")).toBe("source");
    expect(defaultLayerOf("contest/entry.ts")).toBe("source");
    expect(defaultLayerOf("pkg/store/store.go")).toBe("source"); // not _test.go
    expect(defaultLayerOf("src/protest/main.go")).toBe("source"); // 'test' inside a word
  });
});

describe("splitByLayer", () => {
  it("partitions nodes and keeps only intra-source edges in the source graph", () => {
    const graph: AtlasGraph = {
      nodes: [
        fileNode("src/a.ts"),
        fileNode("src/a.test.ts"),
        fileNode("src/b.ts"),
      ],
      edges: [
        { source: "src/a.test.ts", target: "src/a.ts" },
        { source: "src/a.ts", target: "src/b.ts" },
      ],
    };
    const { source, test } = splitByLayer(graph);
    expect(source.nodes.map((n) => n.id)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(source.edges).toEqual([{ source: "src/a.ts", target: "src/b.ts" }]);
    expect(test.map((n) => n.id)).toEqual(["src/a.test.ts"]);
  });
});

describe("matchTestTargets", () => {
  const graph: AtlasGraph = {
    nodes: [
      fileNode("src/core/foo.ts"),
      fileNode("src/core/foo.test.ts"),
      fileNode("src/core/bar.ts"),
      fileNode("src/core/integration.test.ts"),
      fileNode("src/core/orphan.test.ts"),
    ],
    edges: [
      // name match exists for foo.test.ts, but also an import to bar
      { source: "src/core/foo.test.ts", target: "src/core/bar.ts" },
      // integration.test.ts has no name match; imports bar twice, foo once
      { source: "src/core/integration.test.ts", target: "src/core/bar.ts" },
      { source: "src/core/integration.test.ts", target: "src/core/bar.ts" },
      { source: "src/core/integration.test.ts", target: "src/core/foo.ts" },
    ],
  };

  it("prefers the name-matched source file", () => {
    const targets = matchTestTargets(graph);
    expect(targets.get("src/core/foo.test.ts")).toBe("src/core/foo.ts");
  });

  it("falls back to the most-imported source file", () => {
    const targets = matchTestTargets(graph);
    expect(targets.get("src/core/integration.test.ts")).toBe("src/core/bar.ts");
  });

  it("leaves unmatchable tests out", () => {
    const targets = matchTestTargets(graph);
    expect(targets.has("src/core/orphan.test.ts")).toBe(false);
  });

  it("name-matches other languages' test conventions to their subject", () => {
    const multi: AtlasGraph = {
      nodes: [
        fileNode("pkg/store/store.go"),
        fileNode("pkg/store/store_test.go"),
        fileNode("src/lexer/token.mbt"),
        fileNode("src/lexer/token_test.mbt"),
        fileNode("src/lexer/parser.mbt"),
        fileNode("src/lexer/parser_wbtest.mbt"),
      ],
      edges: [],
    };
    const targets = matchTestTargets(multi);
    expect(targets.get("pkg/store/store_test.go")).toBe("pkg/store/store.go");
    expect(targets.get("src/lexer/token_test.mbt")).toBe("src/lexer/token.mbt");
    expect(targets.get("src/lexer/parser_wbtest.mbt")).toBe("src/lexer/parser.mbt");
  });
});
