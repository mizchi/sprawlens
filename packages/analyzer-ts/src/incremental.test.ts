import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tsProvider } from "./provider.js";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "ts-incremental-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function write(rel: string, content: string) {
  const full = path.join(root, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
}

function fileNode(snap: { nodes: { type: string; path?: string }[] }, p: string) {
  return snap.nodes.find((n) => n.type === "file" && n.path === p);
}

describe("tsProvider incremental analyzer", () => {
  it("re-parses only changed files and reflects new symbols", async () => {
    await write("src/a.ts", "export function alpha() { return 1; }\n");
    await write("src/b.ts", "export function beta() { return 2; }\n");
    const analyzer = tsProvider.createIncrementalAnalyzer!(root);

    const s1 = await analyzer.analyze();
    const a1 = fileNode(s1, "src/a.ts") as { symbols?: { name: string }[] };
    const b1 = fileNode(s1, "src/b.ts");
    expect(a1?.symbols?.map((s) => s.name)).toEqual(["alpha"]);

    // change a.ts (different length → cache miss), leave b.ts untouched
    await write(
      "src/a.ts",
      "export function alpha() { return 1; }\nexport function gamma() { return 3; }\n",
    );

    const s2 = await analyzer.analyze();
    const a2 = fileNode(s2, "src/a.ts") as { symbols?: { name: string }[] };
    const b2 = fileNode(s2, "src/b.ts");

    // the changed file is re-parsed: its new symbol shows up
    expect(a2?.symbols?.map((s) => s.name).sort()).toEqual(["alpha", "gamma"]);
    // the unchanged file is served from cache: same node object identity
    expect(b2).toBe(b1);
  });

  it("drops deleted files on the next analyze", async () => {
    await write("src/a.ts", "export const a = 1;\n");
    await write("src/b.ts", "export const b = 2;\n");
    const analyzer = tsProvider.createIncrementalAnalyzer!(root);
    await analyzer.analyze();
    await rm(path.join(root, "src/b.ts"));
    const s2 = await analyzer.analyze();
    expect(fileNode(s2, "src/b.ts")).toBeUndefined();
    expect(fileNode(s2, "src/a.ts")).toBeDefined();
  });
});
