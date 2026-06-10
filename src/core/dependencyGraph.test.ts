import { describe, expect, it } from "vitest";
import { buildDependencyGraphFrame } from "./dependencyGraph.js";
import type { CodeSymbolImport, Snapshot } from "./types.js";

function snapshot(
  hash: string,
  files: Array<{ path: string; loc: number; exported?: string[] }>,
  imports: Array<[string, string, string, CodeSymbolImport[]?]>,
): Snapshot {
  return {
    schemaVersion: 1,
    repoPath: "/repo",
    commit: {
      hash,
      shortHash: hash,
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
        symbols: file.exported?.map((name, index) => ({
          id: `symbol:${file.path}:${name}`,
          kind: "function" as const,
          name,
          startLine: index + 1,
          endLine: index + 4,
          loc: 4,
          exported: true,
        })),
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

describe("dependency graph model", () => {
  it("builds module nodes and aggregates file imports between modules", () => {
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
        [
          { path: "packages/app/src/index.ts", loc: 120 },
          { path: "packages/core/src/api.ts", loc: 80 },
        ],
        [["packages/app/src/index.ts", "packages/core/src/api.ts", "@repo/core"]],
      ),
    );

    expect(frame.nodes.filter((node) => node.kind === "module").map((node) => [node.id, node.kind])).toEqual([
      ["module:packages/app", "module"],
      ["module:packages/core", "module"],
    ]);
    expect(frame.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "port:out:module:packages/app->module:packages/core",
          kind: "port",
          parentId: "module:packages/app",
          peerModuleId: "module:packages/core",
          portDirection: "out",
        }),
        expect.objectContaining({
          id: "port:in:module:packages/core->module:packages/app",
          kind: "port",
          parentId: "module:packages/core",
          peerModuleId: "module:packages/app",
          portDirection: "in",
        }),
      ]),
    );
    expect(frame.edges).toEqual([
      expect.objectContaining({
        from: "port:out:module:packages/app->module:packages/core",
        to: "port:in:module:packages/core->module:packages/app",
        fromModuleId: "module:packages/app",
        toModuleId: "module:packages/core",
        importCount: 1,
      }),
    ]);

    const app = frame.nodes.find((node) => node.id === "module:packages/app")!;
    const appPort = frame.nodes.find((node) => node.id === "port:out:module:packages/app->module:packages/core")!;
    expect(Math.abs(Math.hypot(appPort.x - app.x, appPort.y - app.y) - app.r)).toBeLessThan(0.01);
  });

  it("expands the focused module into API nodes and exported symbol nodes", () => {
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
        [
          { path: "packages/app/src/index.ts", loc: 120, exported: ["start"] },
          { path: "packages/app/src/router.ts", loc: 90, exported: ["createRouter"] },
          { path: "packages/core/src/api.ts", loc: 80, exported: ["request"] },
        ],
        [
          ["packages/app/src/index.ts", "packages/app/src/router.ts", "./router"],
          ["packages/app/src/router.ts", "packages/core/src/api.ts", "@repo/core"],
        ],
      ),
      { focusModuleId: "module:packages/app", focusFilePath: "packages/app/src/router.ts" },
    );

    expect(frame.nodes.find((node) => node.id === "api:packages/app/src/router.ts")).toMatchObject({
      kind: "api",
      parentId: "module:packages/app",
      path: "packages/app/src/router.ts",
    });
    expect(frame.nodes.find((node) => node.id === "symbol:packages/app/src/router.ts:createRouter")).toMatchObject({
      kind: "symbol",
      parentId: "api:packages/app/src/router.ts",
      exported: true,
    });
    expect(frame.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "api:packages/app/src/index.ts",
          to: "api:packages/app/src/router.ts",
          scope: "detail",
        }),
        expect.objectContaining({
          from: "port:out:module:packages/app->module:packages/core",
          to: "port:in:module:packages/core->module:packages/app",
          fromModuleId: "module:packages/app",
          toModuleId: "module:packages/core",
          scope: "module",
        }),
      ]),
    );
    expect(frame.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "api:packages/app/src/router.ts",
          to: "module:packages/core",
          scope: "detail",
        }),
      ]),
    );
  });

  it("prefers symbol-level detail routes over file-level routes when import usages are available", () => {
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
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

    expect(frame.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "symbol:packages/app/src/index.ts:start", kind: "symbol" }),
        expect.objectContaining({ id: "symbol:packages/app/src/router.ts:createRouter", kind: "symbol" }),
      ]),
    );
    expect(frame.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "symbol:packages/app/src/index.ts:start",
          to: "symbol:packages/app/src/router.ts:createRouter",
          scope: "detail",
          importCount: 1,
        }),
      ]),
    );
    expect(frame.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "api:packages/app/src/index.ts",
          to: "api:packages/app/src/router.ts",
          scope: "detail",
        }),
      ]),
    );
  });

  it("keeps module-to-module routes when a module is expanded into API nodes", () => {
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
        [
          { path: "packages/app/src/index.ts", loc: 120, exported: ["start"] },
          { path: "packages/core/src/api.ts", loc: 80, exported: ["request"] },
          { path: "packages/core/src/internal.ts", loc: 70, exported: ["helper"] },
        ],
        [
          ["packages/app/src/index.ts", "packages/core/src/api.ts", "@repo/core"],
          ["packages/core/src/api.ts", "packages/core/src/internal.ts", "./internal"],
        ],
      ),
      { focusModuleId: "module:packages/core" },
    );

    expect(frame.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "port:out:module:packages/app->module:packages/core",
          to: "port:in:module:packages/core->module:packages/app",
          fromModuleId: "module:packages/app",
          toModuleId: "module:packages/core",
          scope: "module",
          importCount: 1,
        }),
        expect.objectContaining({
          from: "api:packages/core/src/api.ts",
          to: "api:packages/core/src/internal.ts",
          scope: "detail",
          importCount: 1,
        }),
      ]),
    );
    expect(frame.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "module:packages/app",
          to: "api:packages/core/src/api.ts",
          scope: "detail",
        }),
      ]),
    );
  });

  it("keeps an internal file preview for collapsed modules", () => {
    const testFiles = Array.from({ length: 18 }, (_, index) => ({
      path: `packages/playwright-test/src/test${index}.ts`,
      loc: 60 + index * 3,
      exported: [`test${index}`],
    }));
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
        [
          ...testFiles,
          { path: "packages/playwright-core/src/api.ts", loc: 180, exported: ["request"] },
          { path: "packages/playwright/src/index.ts", loc: 120, exported: ["playwright"] },
        ],
        [
          ["packages/playwright/src/index.ts", "packages/playwright-test/src/test0.ts", "@repo/test"],
          ["packages/playwright-test/src/test1.ts", "packages/playwright-core/src/api.ts", "@repo/core"],
          ...testFiles.slice(2).map((file, index): [string, string, string] => [file.path, "packages/playwright-test/src/test0.ts", `./test0-${index}`]),
        ],
      ),
      { focusModuleId: "module:packages/playwright-core" },
    );

    const testModule = frame.nodes.find((node) => node.id === "module:packages/playwright-test");
    expect(testModule?.expanded).toBe(false);
    expect(testModule?.previewNodes.length).toBeGreaterThan(6);
    for (const preview of testModule!.previewNodes) {
      expect(preview.path.startsWith("packages/playwright-test/")).toBe(true);
      expect(Math.hypot(preview.x, preview.y) + preview.r).toBeLessThanOrEqual(0.78);
    }
  });

  it("can drill into a non-core module such as playwright-test", () => {
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
        [
          { path: "packages/playwright-core/src/api.ts", loc: 180, exported: ["request"] },
          { path: "packages/playwright-test/src/index.ts", loc: 120, exported: ["run"] },
          { path: "packages/playwright-test/src/fixtures.ts", loc: 90, exported: ["fixtures"] },
          { path: "packages/playwright/src/index.ts", loc: 80, exported: ["playwright"] },
        ],
        [
          ["packages/playwright/src/index.ts", "packages/playwright-test/src/index.ts", "@repo/test"],
          ["packages/playwright-test/src/index.ts", "packages/playwright-test/src/fixtures.ts", "./fixtures"],
          ["packages/playwright-test/src/fixtures.ts", "packages/playwright-core/src/api.ts", "@repo/core"],
        ],
      ),
      { focusModuleId: "module:packages/playwright-test" },
    );

    expect(frame.nodes.find((node) => node.id === "module:packages/playwright-test")).toMatchObject({
      expanded: true,
      previewNodes: [],
    });
    expect(frame.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api:packages/playwright-test/src/index.ts",
          parentId: "module:packages/playwright-test",
          kind: "api",
        }),
        expect.objectContaining({
          id: "api:packages/playwright-test/src/fixtures.ts",
          parentId: "module:packages/playwright-test",
          kind: "api",
        }),
      ]),
    );
  });

  it("places focused module API nodes inside the expanded module boundary", () => {
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
        [
          { path: "packages/app/src/index.ts", loc: 120, exported: ["start"] },
          { path: "packages/app/src/router.ts", loc: 90, exported: ["createRouter"] },
          { path: "packages/app/src/page.ts", loc: 80, exported: ["Page"] },
          { path: "packages/core/src/api.ts", loc: 80, exported: ["request"] },
        ],
        [
          ["packages/app/src/index.ts", "packages/app/src/router.ts", "./router"],
          ["packages/app/src/router.ts", "packages/app/src/page.ts", "./page"],
          ["packages/app/src/router.ts", "packages/core/src/api.ts", "@repo/core"],
        ],
      ),
      { focusModuleId: "module:packages/app" },
    );

    const parent = frame.nodes.find((node) => node.id === "module:packages/app");
    expect(parent).toMatchObject({ expanded: true });
    const apiNodes = frame.nodes.filter((node) => node.kind === "api" && node.parentId === "module:packages/app");
    expect(apiNodes.length).toBeGreaterThan(1);
    for (const node of apiNodes) {
      const distance = Math.hypot(node.x - parent!.x, node.y - parent!.y);
      expect(distance + node.r).toBeLessThan(parent!.r);
    }
  });

  it("keeps focused module detail compact enough to preserve surrounding module context", () => {
    const coreFiles = Array.from({ length: 48 }, (_, index) => ({
      path: `packages/core/src/api${index}.ts`,
      loc: 80 + index,
      exported: [`api${index}`],
    }));
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
        [
          ...coreFiles,
          { path: "packages/app/src/index.ts", loc: 180, exported: ["start"] },
          { path: "packages/web/src/index.ts", loc: 160, exported: ["render"] },
          { path: "packages/test/src/index.ts", loc: 140, exported: ["test"] },
        ],
        [
          ["packages/app/src/index.ts", "packages/core/src/api0.ts", "@repo/core"],
          ["packages/web/src/index.ts", "packages/core/src/api1.ts", "@repo/core"],
          ["packages/test/src/index.ts", "packages/core/src/api2.ts", "@repo/core"],
          ...coreFiles.slice(1).map((file, index): [string, string, string] => [file.path, "packages/core/src/api0.ts", `./api0-${index}`]),
        ],
      ),
      { focusModuleId: "module:packages/core" },
    );

    const parent = frame.nodes.find((node) => node.id === "module:packages/core");
    const apiNodes = frame.nodes.filter((node) => node.kind === "api" && node.parentId === "module:packages/core");
    const contextModules = frame.nodes.filter((node) => node.kind === "module" && node.id !== "module:packages/core");

    expect(parent?.r).toBeLessThanOrEqual(240);
    expect(apiNodes).toHaveLength(20);
    expect(contextModules).toHaveLength(3);
  });

  it("keeps file-level import breakdowns for the focused module and API nodes", () => {
    const frame = buildDependencyGraphFrame(
      snapshot(
        "abc",
        [
          { path: "packages/app/src/index.ts", loc: 120, exported: ["start"] },
          { path: "packages/app/src/router.ts", loc: 90, exported: ["createRouter"] },
          { path: "packages/core/src/api.ts", loc: 80, exported: ["request"] },
        ],
        [
          ["packages/app/src/index.ts", "packages/app/src/router.ts", "./router"],
          ["packages/app/src/router.ts", "packages/core/src/api.ts", "@repo/core"],
        ],
      ),
      { focusModuleId: "module:packages/app", focusFilePath: "packages/app/src/router.ts" },
    );

    expect(frame.breakdowns["module:packages/app"]?.outgoing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromPath: "packages/app/src/index.ts",
          toPath: "packages/app/src/router.ts",
          internal: true,
        }),
        expect.objectContaining({
          fromPath: "packages/app/src/router.ts",
          toPath: "packages/core/src/api.ts",
          toModuleId: "module:packages/core",
          internal: false,
        }),
      ]),
    );
    expect(frame.breakdowns["api:packages/app/src/router.ts"]?.incoming).toEqual([
      expect.objectContaining({
        fromPath: "packages/app/src/index.ts",
        toPath: "packages/app/src/router.ts",
      }),
    ]);
  });
});
