import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { snapshotRustWorkingTree } from "./extract.js";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "rust-extract-"));
  await mkdir(join(dir, "src"), { recursive: true });
  await writeFile(
    join(dir, "src/lib.rs"),
    `mod util;\nuse std::fmt;\nuse crate::util::Thing;\npub struct Greeter { pub name: String }\npub trait Hello { fn hello(&self) -> String; }\nimpl Greeter { pub fn new() -> Self { Greeter { name: String::new() } } fn secret(&self) -> u32 { 1 } }\npub enum Mode { On, Off }\nfn helper() -> i32 { 42 }\n`,
  );
  await writeFile(join(dir, "src/util.rs"), `pub struct Thing { v: i32 }\n`);
});
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
const commit = { hash: "WORKTREE", shortHash: "worktree", timestamp: "2020-01-01T00:00:00.000Z", authorName: "t", message: "t", aiIndicators: [] };

describe("snapshotRustWorkingTree", () => {
  it("extracts struct/trait/enum/impl-method symbols + pub visibility + use deps", async () => {
    const snap = await snapshotRustWorkingTree(dir, commit, "demo");
    const file = snap.nodes.find((n) => n.type === "file" && n.path === "src/lib.rs");
    const syms = (file && file.type === "file" ? file.symbols ?? [] : []);
    const by = (n: string) => syms.find((s) => s.name === n && !s.parentClass);
    expect(by("Greeter")?.kind).toBe("class");
    expect(by("Greeter")?.exported).toBe(true);
    expect(by("Hello")?.kind).toBe("interface");
    expect(by("Mode")?.kind).toBe("enum");
    expect(by("helper")?.exported).toBe(false);
    expect(syms.some((s) => s.parentClass === "Greeter" && s.name === "new" && s.kind === "method")).toBe(true);
    const imports = snap.edges.filter((e) => e.type === "imports");
    expect(imports.some((e) => e.specifier === "std" && !e.resolved)).toBe(true);
    // use crate::util resolves to the module file
    expect(
      imports.some(
        (e) => e.from === "file:src/lib.rs" && e.to === "file:src/util.rs" && e.resolved,
      ),
    ).toBe(true);
  });
});
