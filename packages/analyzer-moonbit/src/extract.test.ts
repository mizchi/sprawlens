import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { snapshotMoonbitWorkingTree } from "./extract.ts";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mbt-extract-"));
  await mkdir(join(dir, "lib"), { recursive: true });
  await writeFile(join(dir, "moon.mod.json"), `{"name":"demo"}`);
  await mkdir(join(dir, "util"), { recursive: true });
  await writeFile(
    join(dir, "util/u.mbt"),
    `pub fn id() -> Int { 1 }\npub struct Counter {\n  v : Int\n}\npub fn Counter::make() -> Counter {\n  { v: 0 }\n}\n`,
  );
  await writeFile(join(dir, "util/moon.pkg.json"), `{}`);
  await writeFile(
    join(dir, "lib/moon.pkg.json"),
    `{"import":["moonbitlang/core/builtin","demo/util"]}`,
  );
  await writeFile(
    join(dir, "lib/g.mbt"),
    `pub struct Greeter {\n  name : String\n}\npub fn Greeter::hello(self : Greeter) -> String {\n  self.name\n}\nenum Mode { On; Off }\nfn helper() -> Int { let _ = @util.Counter::make(); @util.id() }\npub let answer : Int = 42\n`,
  );
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
const commit = {
  hash: "WORKTREE",
  shortHash: "worktree",
  timestamp: "2020-01-01T00:00:00.000Z",
  authorName: "t",
  message: "t",
  aiIndicators: [],
};

describe("snapshotMoonbitWorkingTree", () => {
  it("extracts decls (kind + pub) and package imports", async () => {
    const snap = await snapshotMoonbitWorkingTree(dir, commit, "demo");
    const file = snap.nodes.find((n) => n.type === "file" && n.path === "lib/g.mbt");
    const syms = file && file.type === "file" ? (file.symbols ?? []) : [];
    const by = (n: string) => syms.find((s) => s.name === n);
    expect(by("Greeter")?.kind).toBe("class");
    expect(by("Greeter")?.exported).toBe(true);
    expect(
      syms.some((s) => s.parentClass === "Greeter" && s.name === "hello" && s.kind === "method"),
    ).toBe(true);
    expect(by("Mode")?.kind).toBe("enum");
    expect(by("helper")?.exported).toBe(false);
    expect(by("answer")?.kind).toBe("variable");
    const imports = snap.edges.filter((e) => e.type === "imports");
    expect(imports.some((e) => e.specifier === "moonbitlang/core/builtin" && !e.resolved)).toBe(
      true,
    );
    // import of the local demo/util package resolves to its file
    expect(imports.some((e) => e.to === "file:util/u.mbt" && e.resolved)).toBe(true);
    // `@util.id()` usage in helper() becomes a symbol reference to util's id
    const utilEdge = imports.find((e) => e.to === "file:util/u.mbt");
    expect(
      utilEdge?.type === "imports"
        ? utilEdge.symbolImports?.some(
            (s) => s.fromSymbolName === "helper" && s.toSymbolName === "id",
          )
        : false,
    ).toBe(true);
    // `@util.Counter::make()` resolves to the make method of Counter
    expect(
      utilEdge?.type === "imports"
        ? utilEdge.symbolImports?.some(
            (s) => s.fromSymbolName === "helper" && s.toSymbolName === "make",
          )
        : false,
    ).toBe(true);
  });
});

// moonbitlang/core and other current modules use the newer manifest spelling:
// moon.mod (TOML) + moon.pkg (DSL `import { … }`) instead of the JSON forms.
describe("snapshotMoonbitWorkingTree (moon.mod / moon.pkg DSL format)", () => {
  let dir2: string;
  beforeAll(async () => {
    dir2 = await mkdtemp(join(tmpdir(), "mbt-dsl-"));
    await mkdir(join(dir2, "lib"), { recursive: true });
    await mkdir(join(dir2, "util"), { recursive: true });
    // TOML module manifest (no .json)
    await writeFile(join(dir2, "moon.mod"), `name = "demo"\nversion = "0.1.0"\n`);
    // DSL package manifests (no .json): main import + a test-scoped block
    await writeFile(
      join(dir2, "lib/moon.pkg"),
      `import {\n  "demo/util",\n}\n\nimport {\n  "demo/util",\n} for "test"\n`,
    );
    await writeFile(join(dir2, "util/moon.pkg"), `import {\n}\n`);
    await writeFile(join(dir2, "util/u.mbt"), `pub fn id() -> Int { 1 }\n`);
    await writeFile(join(dir2, "lib/g.mbt"), `pub fn run() -> Int { @util.id() }\n`);
  });
  afterAll(async () => {
    await rm(dir2, { recursive: true, force: true });
  });

  it("reads the TOML module name and DSL imports, resolving local deps", async () => {
    const snap = await snapshotMoonbitWorkingTree(dir2, commit, "demo");
    const imports = snap.edges.filter((e) => e.type === "imports");
    // demo/util resolves to its file via the TOML module name
    const utilEdge = imports.find((e) => e.to === "file:util/u.mbt" && e.resolved);
    expect(utilEdge).toBeTruthy();
    // `@util.id()` in run() becomes a symbol reference to util's exported id
    expect(
      utilEdge?.type === "imports"
        ? utilEdge.symbolImports?.some((s) => s.fromSymbolName === "run" && s.toSymbolName === "id")
        : false,
    ).toBe(true);
  });
});
