import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { snapshotMoonbitWorkingTree } from "./extract.js";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mbt-extract-"));
  await mkdir(join(dir, "lib"), { recursive: true });
  await writeFile(join(dir, "moon.mod.json"), `{"name":"demo"}`);
  await writeFile(join(dir, "lib/moon.pkg.json"), `{"import":["moonbitlang/core/builtin"]}`);
  await writeFile(
    join(dir, "lib/g.mbt"),
    `pub struct Greeter {\n  name : String\n}\npub fn Greeter::hello(self : Greeter) -> String {\n  self.name\n}\nenum Mode { On; Off }\nfn helper() -> Int { 42 }\npub let answer : Int = 42\n`,
  );
});
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
const commit = { hash: "WORKTREE", shortHash: "worktree", timestamp: "2020-01-01T00:00:00.000Z", authorName: "t", message: "t", aiIndicators: [] };

describe("snapshotMoonbitWorkingTree", () => {
  it("extracts decls (kind + pub) and package imports", async () => {
    const snap = await snapshotMoonbitWorkingTree(dir, commit, "demo");
    const file = snap.nodes.find((n) => n.type === "file" && n.path === "lib/g.mbt");
    const syms = file && file.type === "file" ? file.symbols ?? [] : [];
    const by = (n: string) => syms.find((s) => s.name === n);
    expect(by("Greeter")?.kind).toBe("class");
    expect(by("Greeter")?.exported).toBe(true);
    expect(syms.some((s) => s.parentClass === "Greeter" && s.name === "hello" && s.kind === "method")).toBe(true);
    expect(by("Mode")?.kind).toBe("enum");
    expect(by("helper")?.exported).toBe(false);
    expect(by("answer")?.kind).toBe("variable");
    const imports = snap.edges.filter((e) => e.type === "imports").map((e) => e.specifier);
    expect(imports).toContain("moonbitlang/core/builtin");
  });
});
