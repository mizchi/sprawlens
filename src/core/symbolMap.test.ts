import { describe, expect, it } from "vitest";
import { buildSymbolMapFrame } from "./symbolMap.js";
import type { CodeSymbolImport, Snapshot } from "./types.js";

function snapshot(
  files: Array<{ path: string; loc: number; exported?: string[]; internal?: string[] }>,
  imports: Array<[string, string, string, CodeSymbolImport[]?]>,
): Snapshot {
  return {
    schemaVersion: 1,
    repoPath: "/repo",
    commit: {
      hash: "abc",
      shortHash: "abc",
      timestamp: "2026-06-09T00:00:00.000Z",
      authorName: "Test",
      message: "fixture",
      aiIndicators: [],
    },
    nodes: [
      { id: "repo", type: "repo", name: "repo" },
      ...files.map((file) => ({
        id: `file:${file.path}`,
        type: "file" as const,
        path: file.path,
        ext: ".ts",
        loc: file.loc,
        sizeBytes: file.loc,
        symbols: [
          ...(file.exported ?? []).map((name, index) => ({
            id: `symbol:${file.path}:${name}`,
            kind: "function" as const,
            name,
            startLine: index + 1,
            endLine: index + 4,
            loc: 4,
            exported: true,
          })),
          ...(file.internal ?? []).map((name, index) => ({
            id: `symbol:${file.path}:${name}`,
            kind: "function" as const,
            name,
            startLine: index + 20,
            endLine: index + 24,
            loc: 5,
            exported: false,
          })),
        ],
      })),
    ],
    edges: imports.map(([from, to, specifier, symbolImports]) => ({
      id: `imports:file:${from}->file:${to}:${specifier}`,
      type: "imports" as const,
      from: `file:${from}`,
      to: `file:${to}`,
      specifier,
      resolved: true,
      symbolImports,
    })),
    metrics: {
      loc: files.reduce((sum, file) => sum + file.loc, 0),
      fileCount: files.length,
      dirCount: 0,
      importEdgeCount: imports.length,
      unresolvedImportCount: 0,
      cycleCount: 0,
      largestComponentSize: 0,
      maxFanIn: 0,
      maxFanOut: 0,
    },
  };
}

describe("symbol map model", () => {
  it("sizes file boxes by LOC while symbols remain graph nodes", () => {
    const frame = buildSymbolMapFrame(
      snapshot(
        [
          { path: "packages/app/src/big.ts", loc: 400, exported: ["start"] },
          { path: "packages/app/src/small.ts", loc: 100, exported: ["helper"] },
        ],
        [],
      ),
      { focusModuleId: "module:packages/app" },
    );

    const big = frame.nodes.find((node) => node.id === "file:packages/app/src/big.ts");
    const small = frame.nodes.find((node) => node.id === "file:packages/app/src/small.ts");
    const start = frame.nodes.find((node) => node.id === "symbol:packages/app/src/big.ts:start");

    expect(big).toMatchObject({ kind: "file", loc: 400 });
    expect(small).toMatchObject({ kind: "file", loc: 100 });
    expect((big!.w ?? 0) * (big!.h ?? 0)).toBeGreaterThan((small!.w ?? 0) * (small!.h ?? 0));
    expect(start).toMatchObject({ kind: "symbol", parentId: "file:packages/app/src/big.ts" });
  });

  it("uses symbol-to-symbol routes instead of file routes", () => {
    const frame = buildSymbolMapFrame(
      snapshot(
        [
          { path: "packages/app/src/index.ts", loc: 120, exported: ["start"] },
          { path: "packages/app/src/router.ts", loc: 90, exported: ["createRouter"] },
        ],
        [
          [
            "packages/app/src/index.ts",
            "packages/app/src/router.ts",
            "./router",
            [
              {
                imported: "createRouter",
                local: "createRouter",
                kind: "named",
                fromSymbolId: "symbol:packages/app/src/index.ts:start",
                fromSymbolName: "start",
                toSymbolId: "symbol:packages/app/src/router.ts:createRouter",
                toSymbolName: "createRouter",
              },
            ],
          ],
        ],
      ),
      { focusModuleId: "module:packages/app" },
    );

    expect(frame.edges).toEqual([
      expect.objectContaining({
        from: "symbol:packages/app/src/index.ts:start",
        to: "symbol:packages/app/src/router.ts:createRouter",
        scope: "symbol",
      }),
    ]);
  });

  it("marks cross-module target symbols as public surface nodes visible at low zoom", () => {
    const frame = buildSymbolMapFrame(
      snapshot(
        [
          { path: "packages/app/src/index.ts", loc: 120, exported: ["start"] },
          { path: "packages/core/src/api.ts", loc: 90, exported: ["request"], internal: ["parse"] },
        ],
        [
          [
            "packages/app/src/index.ts",
            "packages/core/src/api.ts",
            "../core/api",
            [
              {
                imported: "request",
                local: "request",
                kind: "named",
                fromSymbolId: "symbol:packages/app/src/index.ts:start",
                fromSymbolName: "start",
                toSymbolId: "symbol:packages/core/src/api.ts:request",
                toSymbolName: "request",
              },
            ],
          ],
        ],
      ),
      { focusModuleId: "module:packages/core" },
    );

    const request = frame.nodes.find((node) => node.id === "symbol:packages/core/src/api.ts:request");
    const parse = frame.nodes.find((node) => node.id === "symbol:packages/core/src/api.ts:parse");
    const crossModule = frame.edges.find((edge) => edge.to === request?.id);

    expect(request).toMatchObject({ kind: "symbol", surface: "public" });
    expect(request!.visibleAtZoom).toBeLessThan(1);
    expect(parse?.surface).toBe("internal");
    expect(crossModule).toMatchObject({
      crossModule: true,
      toModuleId: "module:packages/core",
    });
  });
});
