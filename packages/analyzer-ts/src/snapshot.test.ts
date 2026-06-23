import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSnapshotFromWorkingTree } from "./snapshot.ts";

async function withFixture(files: Record<string, string>, fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "codesprawl-fixture-"));
  try {
    for (const [file, content] of Object.entries(files)) {
      const fullPath = path.join(root, file);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content);
    }
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("workspace package imports", () => {
  it("resolves a cross-package import to the target package's entry file", async () => {
    await withFixture(
      {
        "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
        "packages/schema/package.json": JSON.stringify({
          name: "@acme/schema",
          main: "./src/index.ts",
        }),
        "packages/schema/src/index.ts": "export type Foo = { x: number };\n",
        "packages/app/package.json": JSON.stringify({
          name: "@acme/app",
          main: "./src/index.ts",
        }),
        "packages/app/src/index.ts":
          "import type { Foo } from '@acme/schema';\nexport const f: Foo = { x: 1 };\n",
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "c",
          shortHash: "c",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "T",
          message: "m",
          aiIndicators: [],
        });
        const edge = snapshot.edges.find(
          (e) => e.type === "imports" && e.specifier === "@acme/schema",
        );
        // resolves to schema's entry file, not an external node
        expect(edge).toMatchObject({
          from: "file:packages/app/src/index.ts",
          to: "file:packages/schema/src/index.ts",
          resolved: true,
        });
        expect((edge as { external?: boolean }).external).toBeFalsy();
      },
    );
  });

  it("leaves a non-workspace bare import external", async () => {
    await withFixture(
      {
        "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
        "packages/app/package.json": JSON.stringify({ name: "@acme/app" }),
        "packages/app/src/index.ts": "import { x } from 'lodash';\nexport const y = x;\n",
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "c",
          shortHash: "c",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "T",
          message: "m",
          aiIndicators: [],
        });
        const edge = snapshot.edges.find((e) => e.type === "imports" && e.specifier === "lodash");
        expect(edge).toMatchObject({ to: "external:lodash", external: true });
      },
    );
  });
});

describe("createSnapshotFromWorkingTree", () => {
  it("creates file and directory nodes with contains edges", async () => {
    await withFixture(
      {
        "src/index.ts": "import { value } from './lib/value';\nconsole.log(value);\n",
        "src/lib/value.ts": "export const value = 1;\n",
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "abc123",
          shortHash: "abc123",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "Test",
          message: "fixture",
          aiIndicators: [],
        });

        expect(snapshot.nodes.find((node) => node.id === "file:src/index.ts")).toMatchObject({
          type: "file",
          loc: 2,
        });
        expect(snapshot.nodes.find((node) => node.id === "dir:src/lib")).toMatchObject({
          type: "dir",
          path: "src/lib",
        });
        expect(snapshot.edges).toContainEqual(
          expect.objectContaining({
            type: "contains",
            from: "dir:src",
            to: "dir:src/lib",
          }),
        );
      },
    );
  });

  it("extracts static relative imports and resolves extension fallbacks", async () => {
    await withFixture(
      {
        "src/index.ts": "import { value } from './lib/value';\nexport * from './lib/extra';\n",
        "src/lib/value.ts": "export const value = 1;\n",
        "src/lib/extra/index.ts": "export const extra = 2;\n",
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "abc123",
          shortHash: "abc123",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "Test",
          message: "fixture",
          aiIndicators: [],
        });

        const importTargets = snapshot.edges
          .filter((edge) => edge.type === "imports")
          .map((edge) => edge.to)
          .sort();

        expect(importTargets).toEqual(["file:src/lib/extra/index.ts", "file:src/lib/value.ts"]);
        expect(snapshot.metrics.importEdgeCount).toBe(2);
        expect(snapshot.metrics.unresolvedImportCount).toBe(0);
      },
    );
  });

  it("records named import bindings and symbol-level import usages", async () => {
    await withFixture(
      {
        "src/api.ts": "export function createPage() {\n  return {};\n}\n",
        "src/consumer.ts": [
          "import { createPage as makePage } from './api';",
          "",
          "export function render() {",
          "  return makePage();",
          "}",
          "",
          "export function idle() {",
          "  return 1;",
          "}",
        ].join("\n"),
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "abc123",
          shortHash: "abc123",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "Test",
          message: "fixture",
          aiIndicators: [],
        });

        const importEdge = snapshot.edges.find(
          (edge) => edge.type === "imports" && edge.from === "file:src/consumer.ts",
        );
        expect(importEdge).toMatchObject({
          type: "imports",
          bindings: [
            {
              imported: "createPage",
              local: "makePage",
              kind: "named",
            },
          ],
          symbolImports: [
            expect.objectContaining({
              imported: "createPage",
              local: "makePage",
              fromSymbolName: "render",
              toSymbolName: "createPage",
            }),
          ],
        });
        expect(
          importEdge?.type === "imports"
            ? importEdge.symbolImports?.some((usage) => usage.fromSymbolName === "idle")
            : false,
        ).toBe(false);
      },
    );
  });

  it("extracts top-level function and class symbols for file zoom detail", async () => {
    await withFixture(
      {
        "src/service.ts": [
          "export function createService() {",
          "  return new Service();",
          "}",
          "",
          "class Service {",
          "  run() {",
          "    return 1;",
          "  }",
          "}",
          "",
          "const helper = () => 2;",
        ].join("\n"),
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "abc123",
          shortHash: "abc123",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "Test",
          message: "fixture",
          aiIndicators: [],
        });

        const file = snapshot.nodes.find((node) => node.id === "file:src/service.ts");
        expect(file).toMatchObject({
          type: "file",
          symbols: [
            expect.objectContaining({
              name: "createService",
              kind: "function",
              startLine: 1,
              endLine: 3,
              exported: true,
            }),
            expect.objectContaining({
              name: "Service",
              kind: "class",
              startLine: 5,
              endLine: 9,
              exported: false,
            }),
            expect.objectContaining({
              name: "run",
              kind: "method",
              startLine: 6,
              parentClass: "symbol:src/service.ts:class:Service:5",
            }),
            expect.objectContaining({
              name: "helper",
              kind: "function",
              startLine: 11,
              endLine: 11,
              exported: false,
            }),
          ],
        });
      },
    );
  });

  it("distinguishes static members, instance members, and properties", async () => {
    await withFixture(
      {
        "src/widget.ts": [
          "export class Widget {",
          "  static create() { return new Widget(); }",
          "  count = 0;",
          "  render() { return this.count; }",
          "  static label = 'w';",
          "}",
        ].join("\n"),
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "h",
          shortHash: "h",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "Test",
          message: "fixture",
          aiIndicators: [],
        });
        const file = snapshot.nodes.find((n) => n.id === "file:src/widget.ts");
        const kinds = new Map(
          (file?.type === "file" ? (file.symbols ?? []) : []).map((s) => [s.name, s.kind]),
        );
        expect(kinds.get("create")).toBe("static-method");
        expect(kinds.get("render")).toBe("method");
        expect(kinds.get("count")).toBe("property");
        expect(kinds.get("label")).toBe("static-property");
      },
    );
  });

  it("captures package imports as external edges, separate from unresolved relative imports", async () => {
    await withFixture(
      {
        "src/index.ts":
          "import React from 'react';\nimport missing from './missing';\nconsole.log(React, missing);\n",
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "abc123",
          shortHash: "abc123",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "Test",
          message: "fixture",
          aiIndicators: [],
        });

        const imports = snapshot.edges.filter((edge) => edge.type === "imports");
        expect(imports).toHaveLength(2);
        const external = imports.find((e) => e.type === "imports" && e.external);
        expect(external).toMatchObject({
          specifier: "react",
          to: "external:react",
          resolved: true,
          external: true,
        });
        const missing = imports.find((e) => e.type === "imports" && e.specifier === "./missing");
        expect(missing).toMatchObject({ resolved: false });
        // external imports never count as unresolved (broken) imports
        expect(snapshot.metrics.unresolvedImportCount).toBe(1);
      },
    );
  });

  it("excludes dependency, fixture, and test asset code from source snapshots", async () => {
    await withFixture(
      {
        "src/index.ts": "export const app = 1;\n",
        "node_modules/pkg/index.js": "module.exports = 1;\n",
        "tests/assets/reading-list/react-dom_18.1.0.js": "/* vendored fixture */\n".repeat(100),
        "fixtures/generated.js": "export const generated = 1;\n",
        "vendor/library.js": "export const vendored = 1;\n",
      },
      async (root) => {
        const snapshot = await createSnapshotFromWorkingTree(root, {
          hash: "abc123",
          shortHash: "abc123",
          timestamp: "2026-06-09T00:00:00.000Z",
          authorName: "Test",
          message: "fixture",
          aiIndicators: [],
        });

        const filePaths = snapshot.nodes
          .filter((node) => node.type === "file")
          .map((node) => node.path);
        expect(filePaths).toEqual(["src/index.ts"]);
      },
    );
  });
});
