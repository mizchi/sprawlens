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
    `mod util;\nuse std::fmt;\nuse crate::util::Thing;\nmacro_rules! greet { () => { "hi" }; }\npub struct Greeter { pub name: String }\npub trait Hello { fn hello(&self) -> String; }\nimpl Greeter { pub fn new() -> Self { Greeter { name: String::new() } } fn secret(&self) -> u32 { 1 } }\npub enum Mode { On, Off }\nfn helper() -> i32 { 42 }\n`,
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
    expect(by("greet")?.kind).toBe("macro");
    expect(by("helper")?.exported).toBe(false);
    expect(syms.some((s) => s.parentClass === "Greeter" && s.name === "new" && s.kind === "method")).toBe(true);
    const imports = snap.edges.filter((e) => e.type === "imports");
    const stdEdge = imports.find((e) => e.specifier === "std" && !e.resolved);
    expect(stdEdge).toBeTruthy();
    // std/core/alloc are the standard library, tagged so the deps view hides them
    expect(stdEdge?.type === "imports" ? stdEdge.stdlib : undefined).toBe(true);
    // use crate::util resolves to the module file
    expect(
      imports.some(
        (e) => e.from === "file:src/lib.rs" && e.to === "file:src/util.rs" && e.resolved,
      ),
    ).toBe(true);
  });
});

describe("qualified-path references (tree-sitter only)", () => {
  let qp: string;
  beforeAll(async () => {
    qp = await mkdtemp(join(tmpdir(), "rust-qp-"));
    await mkdir(join(qp, "src"), { recursive: true });
    await writeFile(join(qp, "src/lib.rs"), `mod math;\nmod app;\n`);
    await writeFile(
      join(qp, "src/math.rs"),
      `pub fn add(a: i32, b: i32) -> i32 { a + b }\npub struct Calc { pub n: i32 }\nimpl Calc { pub fn new() -> Self { Calc { n: 0 } } }\n`,
    );
    await writeFile(
      join(qp, "src/app.rs"),
      `use crate::math::Calc;\npub fn run() -> i32 { crate::math::add(1, 2) }\npub fn make() -> Calc { Calc::new() }\n`,
    );
  });
  afterAll(async () => { await rm(qp, { recursive: true, force: true }); });

  it("resolves a fully-qualified call with no `use` into an import edge + symbol ref", async () => {
    const snap = await snapshotRustWorkingTree(qp, commit, "demo");
    const imports = snap.edges.filter((e) => e.type === "imports");
    // crate::math::add(...) has no `use`, yet the app→math dependency appears
    const edge = imports.find(
      (e) => e.from === "file:src/app.rs" && e.to === "file:src/math.rs",
    );
    expect(edge?.resolved).toBe(true);
    expect(
      edge?.type === "imports"
        ? edge.symbolImports?.some(
            (s) => s.fromSymbolName === "run" && s.toSymbolName === "add",
          )
        : false,
    ).toBe(true);
  });

  it("links a Type::method() associated call to the method symbol", async () => {
    const snap = await snapshotRustWorkingTree(qp, commit, "demo");
    const imports = snap.edges.filter((e) => e.type === "imports");
    const edge = imports.find(
      (e) => e.from === "file:src/app.rs" && e.to === "file:src/math.rs",
    );
    // Calc::new() resolves to the `new` method of Calc, not just the Calc type
    expect(
      edge?.type === "imports"
        ? edge.symbolImports?.some(
            (s) =>
              s.fromSymbolName === "make" && s.toSymbolName === "new",
          )
        : false,
    ).toBe(true);
  });

  it("does not invent edges for std associated calls (String::new)", async () => {
    const snap = await snapshotRustWorkingTree(qp, commit, "demo");
    const imports = snap.edges.filter((e) => e.type === "imports");
    // String::new() inside Calc::new must not fabricate a resolved edge
    expect(
      imports.some((e) => e.resolved && e.to === "file:src/String.rs"),
    ).toBe(false);
  });
});

describe("cargo workspace cross-crate resolution", () => {
  let ws: string;
  beforeAll(async () => {
    ws = await mkdtemp(join(tmpdir(), "rust-ws-"));
    await writeFile(
      join(ws, "Cargo.toml"),
      `[workspace]\nmembers = ["crates/*"]\n`,
    );
    await mkdir(join(ws, "crates/mylib/src"), { recursive: true });
    await writeFile(
      join(ws, "crates/mylib/Cargo.toml"),
      `[package]\nname = "mylib"\nversion = "0.1.0"\n`,
    );
    await writeFile(
      join(ws, "crates/mylib/src/lib.rs"),
      `pub struct Widget { pub id: u32 }\n`,
    );
    await mkdir(join(ws, "crates/app/src"), { recursive: true });
    await writeFile(
      join(ws, "crates/app/Cargo.toml"),
      `[package]\nname = "app"\nversion = "0.1.0"\n`,
    );
    await writeFile(
      join(ws, "crates/app/src/lib.rs"),
      `use mylib::Widget;\nuse serde::Deserialize;\npub fn run() -> Widget { Widget { id: 1 } }\n`,
    );
  });
  afterAll(async () => { await rm(ws, { recursive: true, force: true }); });

  it("resolves a sibling-crate use to that crate's source, keeps externals external", async () => {
    const snap = await snapshotRustWorkingTree(ws, commit, "demo");
    const imports = snap.edges.filter((e) => e.type === "imports");
    // mylib::Widget resolves to the mylib crate's lib.rs
    expect(
      imports.some(
        (e) =>
          e.from === "file:crates/app/src/lib.rs" &&
          e.to === "file:crates/mylib/src/lib.rs" &&
          e.resolved,
      ),
    ).toBe(true);
    // a real external crate stays external
    expect(
      imports.some((e) => e.specifier?.startsWith("serde") && e.external),
    ).toBe(true);
    // `Widget` usage in run() becomes a symbol reference to mylib's Widget
    const crossEdge = imports.find(
      (e) =>
        e.from === "file:crates/app/src/lib.rs" &&
        e.to === "file:crates/mylib/src/lib.rs",
    );
    expect(
      crossEdge?.type === "imports"
        ? crossEdge.symbolImports?.some(
            (s) => s.fromSymbolName === "run" && s.toSymbolName === "Widget",
          )
        : false,
    ).toBe(true);
  });
});
