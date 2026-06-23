import { describe, expect, it } from "vitest";
import type { Snapshot } from "@sprawlens/contracts";
import { callHierarchyFromSnapshot } from "./callHierarchy.ts";

const commit = {
  hash: "W",
  shortHash: "w",
  timestamp: "2020-01-01T00:00:00.000Z",
  authorName: "t",
  message: "t",
  aiIndicators: [],
};

// main.go's `main` calls api's `NewServer`; api's `NewServer` calls store's `New`.
function snap(): Snapshot {
  return {
    schemaVersion: 1,
    repoPath: "/x",
    commit,
    nodes: [],
    edges: [
      {
        id: "e1",
        type: "imports",
        from: "file:main.go",
        to: "file:api/server.go",
        specifier: "demo/api",
        resolved: true,
        symbolImports: [
          {
            imported: "NewServer",
            local: "NewServer",
            kind: "named",
            fromSymbolId: "symbol:main.go:function:main:9",
            fromSymbolName: "main",
            toSymbolId: "symbol:api/server.go:function:NewServer:3",
            toSymbolName: "NewServer",
          },
        ],
      },
      {
        id: "e2",
        type: "imports",
        from: "file:api/server.go",
        to: "file:store/store.go",
        specifier: "demo/store",
        resolved: true,
        symbolImports: [
          {
            imported: "New",
            local: "New",
            kind: "named",
            fromSymbolId: "symbol:api/server.go:function:NewServer:3",
            fromSymbolName: "NewServer",
            toSymbolId: "symbol:store/store.go:function:New:1",
            toSymbolName: "New",
          },
        ],
      },
    ],
    metrics: { loc: 0 } as Snapshot["metrics"],
  };
}

describe("callHierarchyFromSnapshot", () => {
  it("finds incoming callers and outgoing callees of a symbol", () => {
    const r = callHierarchyFromSnapshot(snap(), "api/server.go", "NewServer");
    expect(r.incoming).toEqual([{ file: "main.go", name: "main", line: 9 }]);
    expect(r.outgoing).toEqual([{ file: "store/store.go", name: "New", line: 1 }]);
  });

  it("returns only incoming for a leaf and only outgoing for a root", () => {
    const leaf = callHierarchyFromSnapshot(snap(), "store/store.go", "New");
    expect(leaf.incoming).toEqual([{ file: "api/server.go", name: "NewServer", line: 3 }]);
    expect(leaf.outgoing).toEqual([]);

    const root = callHierarchyFromSnapshot(snap(), "main.go", "main");
    expect(root.incoming).toEqual([]);
    expect(root.outgoing).toEqual([{ file: "api/server.go", name: "NewServer", line: 3 }]);
  });

  it("scopes by file so same-named symbols elsewhere don't match", () => {
    const r = callHierarchyFromSnapshot(snap(), "other.go", "NewServer");
    expect(r.incoming).toEqual([]);
    expect(r.outgoing).toEqual([]);
  });
});
