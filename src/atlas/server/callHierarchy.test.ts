import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { callHierarchy } from "./callHierarchyProvider.js";
import { LspClient } from "./lspClient.js";

// integration test against the real typescript-language-server on this repo
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

let client: LspClient;

beforeAll(async () => {
  client = await LspClient.start(repoRoot);
}, 30_000);

afterAll(() => {
  client?.dispose();
});

describe("callHierarchy (integration)", () => {
  it(
    "finds incoming and outgoing calls of collectRepository",
    async () => {
      // note: the target file must be part of a tsconfig project for
      // cross-file callers to resolve (src/atlas is excluded from the root
      // tsconfig, so we exercise src/core instead)
      const result = await callHierarchy(
        client,
        repoRoot,
        "src/core/collect.ts",
        "collectRepository",
      );
      expect(
        result.incoming.some((ref) => ref.file === "src/cli/index.ts"),
      ).toBe(true);
      expect(result.outgoing.length).toBeGreaterThan(0);
      for (const ref of [...result.incoming, ...result.outgoing]) {
        expect(ref.line).toBeGreaterThan(0);
        expect(ref.file.startsWith("/")).toBe(false); // repo-relative
      }
    },
    30_000,
  );

  it(
    "returns empty results for an unknown symbol without throwing",
    async () => {
      const result = await callHierarchy(
        client,
        repoRoot,
        "src/core/collect.ts",
        "doesNotExist",
      );
      expect(result.incoming).toEqual([]);
      expect(result.outgoing).toEqual([]);
    },
    30_000,
  );
});
