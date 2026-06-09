import { describe, expect, it } from "vitest";
import { buildModuleMapFrame, classifyCodeLayer, moduleIdForFilePath, modulePathForFile } from "./moduleMap.js";
import type { Snapshot } from "./types.js";

function snapshot(files: Array<{ path: string; loc: number }>, imports: Array<[string, string, string]>): Snapshot {
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
      })),
    ],
    edges: imports.map(([from, to, specifier]) => ({
      id: `imports:file:${from}->file:${to}:${specifier}`,
      type: "imports" as const,
      from: `file:${from}`,
      to: `file:${to}`,
      specifier,
      resolved: true,
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

describe("module map model", () => {
  it("classifies files into review layers and module paths", () => {
    expect(modulePathForFile("packages/playwright-core/src/server/page.ts")).toBe("packages/playwright-core");
    expect(modulePathForFile("tests/page/page-basic.spec.ts")).toBe("tests/page");
    expect(classifyCodeLayer("packages/playwright-core/src/server/page.ts")).toBe("runtime");
    expect(classifyCodeLayer("packages/playwright-core/src/server/page.spec.ts")).toBe("test");
    expect(classifyCodeLayer("scripts/release.ts")).toBe("tooling");
  });

  it("groups files into parcels and aggregates module dependencies", () => {
    const frame = buildModuleMapFrame(
      snapshot(
        [
          { path: "packages/app/src/index.ts", loc: 80 },
          { path: "packages/app/src/index.test.ts", loc: 30 },
          { path: "packages/lib/src/value.ts", loc: 60 },
          { path: "tests/app/basic.spec.ts", loc: 40 },
        ],
        [
          ["packages/app/src/index.ts", "packages/lib/src/value.ts", "@repo/lib"],
          ["tests/app/basic.spec.ts", "packages/app/src/index.ts", "../packages/app"],
          ["packages/app/src/index.test.ts", "packages/app/src/index.ts", "./index"],
        ],
      ),
    );

    expect(frame.modules.map((module) => module.id).sort()).toEqual([
      "module:packages/app",
      "module:packages/lib",
      "module:tests/app",
    ]);
    expect(frame.modules.find((module) => module.id === "module:packages/app")).toMatchObject({
      loc: 110,
      layerCounts: {
        runtime: 1,
        test: 1,
        tooling: 0,
        asset: 0,
      },
    });
    expect(frame.dependencies.map((edge) => [edge.from, edge.to, edge.importCount])).toContainEqual([
      "module:packages/app",
      "module:packages/lib",
      1,
    ]);
    expect(frame.dependencies.map((edge) => [edge.from, edge.to, edge.importCount])).toContainEqual([
      "module:tests/app",
      "module:packages/app",
      1,
    ]);
  });

  it("marks changed modules and module edges from graph diff", () => {
    const frame = buildModuleMapFrame(
      snapshot(
        [
          { path: "packages/app/src/index.ts", loc: 80 },
          { path: "packages/lib/src/value.ts", loc: 60 },
        ],
        [["packages/app/src/index.ts", "packages/lib/src/value.ts", "@repo/lib"]],
      ),
      {
        diff: {
          addedNodes: [],
          addedEdges: ["imports:file:packages/app/src/index.ts->file:packages/lib/src/value.ts:@repo/lib"],
          changedFiles: [{ path: "packages/app/src/index.ts", locDelta: 12 }],
          hotspots: [{ path: "packages/app/src/index.ts", score: 10, reasons: ["fan-out-increased"] }],
        },
      },
    );

    expect(frame.modules.find((module) => module.id === moduleIdForFilePath("packages/app/src/index.ts"))).toMatchObject({
      status: "hotspot",
      hotspotScore: 10,
    });
    expect(frame.dependencies[0]).toMatchObject({
      addedCount: 1,
      changed: true,
    });
  });

  it("carries file symbols into module files for deep zoom rendering", () => {
    const frame = buildModuleMapFrame({
      ...snapshot([{ path: "packages/app/src/index.ts", loc: 40 }], []),
      nodes: [
        { id: "repo", type: "repo", name: "repo" },
        {
          id: "file:packages/app/src/index.ts",
          type: "file",
          path: "packages/app/src/index.ts",
          ext: ".ts",
          loc: 40,
          sizeBytes: 40,
          symbols: [
            { id: "symbol:packages/app/src/index.ts:function:main:1", kind: "function", name: "main", startLine: 1, endLine: 12, loc: 12, exported: true },
            { id: "symbol:packages/app/src/index.ts:class:App:14", kind: "class", name: "App", startLine: 14, endLine: 32, loc: 19, exported: false },
          ],
        },
      ],
    });

    expect(frame.modules[0]?.files[0]?.symbols.map((symbol) => [symbol.kind, symbol.name, symbol.loc])).toEqual([
      ["class", "App", 19],
      ["function", "main", 12],
    ]);
  });
});
