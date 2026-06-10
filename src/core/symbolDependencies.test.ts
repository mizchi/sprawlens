import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSymbolDependencies } from "./symbolDependencies.js";

async function withFixture(files: Record<string, string>, fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "codesprawl-symbol-deps-"));
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

describe("resolveSymbolDependencies", () => {
  it("resolves incoming and outgoing calls for a selected top-level symbol", async () => {
    await withFixture(
      {
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            strict: true,
          },
          include: ["src/**/*.ts"],
        }),
        "src/api.ts": [
          "export function createPage() {",
          "  return helper();",
          "}",
          "",
          "function helper() {",
          "  return 1;",
          "}",
        ].join("\n"),
        "src/consumer.ts": ["import { createPage } from './api';", "", "export function render() {", "  return createPage();", "}"].join("\n"),
      },
      async (root) => {
        const result = await resolveSymbolDependencies(root, {
          symbolId: "symbol:src/api.ts:function:createPage:1",
          maxIncoming: 8,
          maxOutgoing: 8,
        });

        expect(result.source).toBe("typescript-language-service");
        expect(result.nodes.map((node) => node.name).sort()).toEqual(["createPage", "helper", "render"]);
        expect(result.edges).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: "call",
              direction: "outgoing",
              fromSymbolId: "symbol:src/api.ts:function:createPage:1",
              toSymbolId: "symbol:src/api.ts:function:helper:5",
            }),
            expect.objectContaining({
              kind: "call",
              direction: "incoming",
              fromSymbolId: "symbol:src/consumer.ts:function:render:3",
              toSymbolId: "symbol:src/api.ts:function:createPage:1",
            }),
          ]),
        );
      },
    );
  });
});
