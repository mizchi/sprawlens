import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSprawlensConfig } from "./config.js";

let dir: string;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function withToml(toml: string): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), "sprawlens-cfg-"));
  await writeFile(join(dir, "sprawlens.toml"), toml);
  return dir;
}

describe("readSprawlensConfig", () => {
  it("returns null when no sprawlens.toml exists", async () => {
    dir = await mkdtemp(join(tmpdir(), "sprawlens-cfg-"));
    expect(await readSprawlensConfig(dir)).toBeNull();
  });

  it("parses lang, ignore, and [[layer]] tables", async () => {
    const root = await withToml(
      [
        `lang = "typescript"`,
        `ignore = ["**/generated/**"]`,
        ``,
        `[[layer]]`,
        `name = "test"`,
        `match = ["spec/**"]`,
        ``,
        `[[layer]]`,
        `name = "deps"`,
        `match = ["vendor/**"]`,
        `include_external = true`,
        `layout = "rings"`,
      ].join("\n"),
    );
    const config = await readSprawlensConfig(root);
    expect(config).toEqual({
      lang: "typescript",
      ignore: ["**/generated/**"],
      layers: [
        { name: "test", match: ["spec/**"] },
        { name: "deps", match: ["vendor/**"], layout: "rings", includeExternal: true },
      ],
    });
  });

  it("accepts camelCase includeExternal too", async () => {
    const root = await withToml(
      [`[[layer]]`, `name = "deps"`, `includeExternal = true`].join("\n"),
    );
    const config = await readSprawlensConfig(root);
    expect(config?.layers?.[0]?.includeExternal).toBe(true);
  });

  it("drops layer entries without a name", async () => {
    const root = await withToml([`[[layer]]`, `match = ["x/**"]`].join("\n"));
    const config = await readSprawlensConfig(root);
    expect(config?.layers).toBeUndefined();
  });
});
