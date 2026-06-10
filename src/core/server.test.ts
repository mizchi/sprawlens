import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RunningServer } from "./server.js";
import { startServer } from "./server.js";

async function withFixture(files: Record<string, string>, fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "codesprawl-server-"));
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

describe("startServer", () => {
  let running: RunningServer | undefined;

  afterEach(async () => {
    if (!running) {
      return;
    }
    await new Promise<void>((resolve) => running?.server.close(() => resolve()));
    running = undefined;
  });

  it("serves symbol dependency exploration through JSON-RPC", async () => {
    await withFixture(
      {
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
          },
          include: ["src/**/*.ts"],
        }),
        "src/api.ts": ["export function createPage() {", "  return 1;", "}"].join("\n"),
        "src/consumer.ts": ["import { createPage } from './api';", "", "export function render() {", "  return createPage();", "}"].join("\n"),
      },
      async (root) => {
        running = await startServer(root, { port: 0 });

        const response = await fetch(`${running.url}/api/rpc`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "call-1",
            method: "symbolDependencies",
            params: {
              symbolId: "symbol:src/api.ts:function:createPage:1",
            },
          }),
        });

        expect(response.status).toBe(200);
        const payload = (await response.json()) as { id: string; result: { edges: Array<{ fromSymbolId: string; toSymbolId: string }> } };
        expect(payload.id).toBe("call-1");
        expect(payload.result.edges).toContainEqual(
          expect.objectContaining({
            fromSymbolId: "symbol:src/consumer.ts:function:render:3",
            toSymbolId: "symbol:src/api.ts:function:createPage:1",
          }),
        );
      },
    );
  });
});
