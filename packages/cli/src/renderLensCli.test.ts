import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const exec = promisify(execFile);
const CLI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("render --format lens", () => {
  it("renders a SeeRepo-style Agent Lens SVG for a target", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "sprawlens-lens-"));
    await mkdir(resolve(root, "src"), { recursive: true });
    await writeFile(resolve(root, "src/main.ts"), 'import { lib } from "./lib";\nlib();\n');
    await writeFile(resolve(root, "src/lib.ts"), "export function lib() {}\n");

    const { stdout } = await exec(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/index.ts",
        "render",
        root,
        "--lang",
        "typescript",
        "--format",
        "lens",
        "--target",
        "src/lib.ts",
        "--output",
        "-",
      ],
      { cwd: CLI_DIR, maxBuffer: 2 * 1024 * 1024 },
    );

    expect(stdout).toContain("<svg");
    expect(stdout).toContain("Agent Lens");
    expect(stdout).toContain("src/lib.ts");
    await rm(root, { recursive: true, force: true });
  });

  it("requires a target", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "sprawlens-lens-"));
    await mkdir(resolve(root, "src"), { recursive: true });
    await writeFile(resolve(root, "src/lib.ts"), "export function lib() {}\n");

    await expect(
      exec(
        process.execPath,
        [
          "--import",
          "tsx",
          "src/index.ts",
          "render",
          root,
          "--lang",
          "typescript",
          "--format",
          "lens",
          "--output",
          "-",
        ],
        { cwd: CLI_DIR, maxBuffer: 2 * 1024 * 1024 },
      ),
    ).rejects.toMatchObject({ stderr: expect.stringContaining("--format lens requires --target") });
    await rm(root, { recursive: true, force: true });
  });
});
