import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { callHierarchy } from "./callHierarchyProvider.js";
import { LspClient } from "./lspClient.js";

// integration test against the real typescript-language-server on this repo
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

let client: LspClient;

beforeAll(async () => {
  const cli = createRequire(import.meta.url)
    .resolve("typescript-language-server/package.json")
    .replace(/package\.json$/, "lib/cli.mjs");
  client = await LspClient.start(repoRoot, process.execPath, [cli, "--stdio"]);
}, 30_000);

afterAll(() => {
  client?.dispose();
});

describe("callHierarchy (integration)", () => {
  it("finds incoming and outgoing calls across files in a package", async () => {
    // cross-file callers resolve only within one tsconfig project. After the
    // packages/ split each package is its own project, so we exercise a
    // within-package edge: collect.ts calls createSnapshotFromWorkingTree
    // (snapshot.ts), both in @sprawlens/analyzer-ts. (Cross-package call
    // hierarchy needs TS project references — a later phase.)
    const result = await callHierarchy(
      client,
      repoRoot,
      "packages/analyzer-ts/src/snapshot.ts",
      "createSnapshotFromWorkingTree",
      "typescript",
    );
    expect(result.incoming.some((ref) => ref.file === "packages/analyzer-ts/src/collect.ts")).toBe(
      true,
    );
    expect(result.outgoing.length).toBeGreaterThan(0);
    for (const ref of [...result.incoming, ...result.outgoing]) {
      expect(ref.line).toBeGreaterThan(0);
      expect(ref.file.startsWith("/")).toBe(false); // repo-relative
    }
  }, 30_000);

  it("returns empty results for an unknown symbol without throwing", async () => {
    const result = await callHierarchy(
      client,
      repoRoot,
      "packages/analyzer-ts/src/collect.ts",
      "doesNotExist",
      "typescript",
    );
    expect(result.incoming).toEqual([]);
    expect(result.outgoing).toEqual([]);
  }, 30_000);
});
