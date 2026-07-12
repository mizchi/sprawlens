import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deriveModuleIdOf, deriveModules, snapshotToAtlasGraph } from "@sprawlens/schema";
import { snapshotGoWorkingTree, withParsedTree } from "./extract.ts";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "go-extract-"));
  await mkdir(join(dir, "sub"), { recursive: true });
  await writeFile(join(dir, "go.mod"), "module demo\ngo 1.22\n");
  await writeFile(join(dir, "sub/sub.go"), 'package sub\nfunc Default() string { return "x" }\n');
  await writeFile(
    join(dir, "main.go"),
    `package main\nimport ("fmt"; "demo/sub")\nvar _ = sub.Default\ntype Greeter struct{ Name string }\nfunc (g Greeter) Hello() string { if g.Name=="" { return "hi" }; return g.Name }\nfunc main() { fmt.Println("x") }\n`,
  );
  await writeFile(
    join(dir, "sub/sub.go"),
    `package sub\nfunc Default() string { return "world" }\ntype Config interface{ Get(k string) string }\n`,
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

describe("snapshotGoWorkingTree", () => {
  it("extracts files, symbols (kind + exported), and import deps", async () => {
    const snap = await snapshotGoWorkingTree(dir, commit, "demo");
    const files = snap.nodes.filter((n) => n.type === "file");
    expect(files.map((f) => f.path).sort()).toEqual(["main.go", "sub/sub.go"]);
    const main = files.find((f) => f.path === "main.go")!;
    const syms = new Map((main.symbols ?? []).map((s) => [s.name, s]));
    expect(syms.get("Greeter")?.kind).toBe("class");
    expect(syms.get("Greeter")?.exported).toBe(true);
    expect(syms.get("Hello")?.kind).toBe("method");
    // a method is attributed to its receiver type, like Rust impl / MoonBit ::
    expect(syms.get("Hello")?.parentClass).toBe("Greeter");
    expect(syms.get("main")?.exported).toBe(false);
    const sub = files.find((f) => f.path === "sub/sub.go")!;
    expect((sub.symbols ?? []).find((s) => s.name === "Config")?.kind).toBe("interface");
    const imports = snap.edges.filter((e) => e.type === "imports");
    expect(imports.some((e) => e.specifier === "fmt" && !e.resolved)).toBe(true);
    // import of the local sub package resolves to its file
    expect(
      imports.some((e) => e.from === "file:main.go" && e.to === "file:sub/sub.go" && e.resolved),
    ).toBe(true);
    // `sub.Default` usage becomes a symbol reference to sub's exported Default
    const subEdge = imports.find((e) => e.from === "file:main.go" && e.to === "file:sub/sub.go");
    expect(
      subEdge?.type === "imports"
        ? subEdge.symbolImports?.some((s) => s.toSymbolName === "Default")
        : false,
    ).toBe(true);
  });
});

describe("tree-sitter lifecycle", () => {
  it("deletes each WASM tree after extracting serializable data", () => {
    let deletes = 0;
    const parser = {
      parse: () => ({ rootNode: { type: "source_file" }, delete: () => deletes++ }),
    };

    expect(withParsedTree(parser, "package main", (root) => root.type)).toBe("source_file");
    expect(deletes).toBe(1);
  });

  it("deletes the WASM tree when extraction throws", () => {
    let deletes = 0;
    const parser = {
      parse: () => ({ rootNode: { type: "source_file" }, delete: () => deletes++ }),
    };

    expect(() =>
      withParsedTree(parser, "package main", () => {
        throw new Error("extract failed");
      }),
    ).toThrow("extract failed");
    expect(deletes).toBe(1);
  });
});

describe("Go external dependency classification", () => {
  let dir2: string;
  beforeAll(async () => {
    dir2 = await mkdtemp(join(tmpdir(), "go-deps-"));
    await writeFile(
      join(dir2, "go.mod"),
      "module demo\ngo 1.22\n\nrequire github.com/foo/bar v1.2.3\n\nrequire (\n\tgithub.com/baz/qux/v2 v2.0.0 // indirect\n)\n",
    );
    await writeFile(
      join(dir2, "main.go"),
      `package main\nimport (\n\t"fmt"\n\t"path/filepath"\n\t"github.com/foo/bar/sub"\n\t"github.com/foo/bar/other"\n\t"github.com/baz/qux/v2/deep"\n)\nvar _ = fmt.Println\nvar _ = filepath.Join\nvar _ = sub.X\nvar _ = other.Y\nvar _ = deep.Z\nfunc main() {}\n`,
    );
  });
  afterAll(async () => {
    await rm(dir2, { recursive: true, force: true });
  });

  it("tags stdlib, groups sub-packages to the go.mod module, dedupes", async () => {
    const snap = await snapshotGoWorkingTree(dir2, commit, "demo");
    const ext = snap.edges.flatMap((e) => (e.type === "imports" && e.external ? [e] : []));
    const bySpec = new Map(ext.map((e) => [e.specifier, e]));
    // stdlib imports are tagged
    expect(bySpec.get("fmt")?.stdlib).toBe(true);
    expect(bySpec.get("path/filepath")?.stdlib).toBe(true);
    // two sub-packages of github.com/foo/bar collapse to one module edge, not stdlib
    const bar = ext.filter((e) => e.specifier === "github.com/foo/bar");
    expect(bar.length).toBe(1);
    expect(bar[0]?.stdlib).toBeUndefined();
    // the /v2 module keeps its version suffix
    expect(bySpec.has("github.com/baz/qux/v2")).toBe(true);
    // no raw sub-paths leak into the deps
    expect(ext.some((e) => e.specifier === "github.com/foo/bar/sub")).toBe(false);
  });
});

describe("Go workspace module imports", () => {
  let ws: string;
  beforeAll(async () => {
    ws = await mkdtemp(join(tmpdir(), "go-work-"));
    await writeFile(join(ws, "go.work"), "go 1.22\n\nuse (\n\t./services/app\n\t./libs/core\n)\n");
    await mkdir(join(ws, "services/app"), { recursive: true });
    await writeFile(
      join(ws, "services/app/go.mod"),
      "module example.com/app\n\ngo 1.22\n\nrequire example.com/core v0.0.0\n\nreplace example.com/core => ../../libs/core\n",
    );
    await writeFile(
      join(ws, "services/app/main.go"),
      'package main\n\nimport "example.com/core"\n\nfunc main() { _ = core.Name() }\n',
    );
    await mkdir(join(ws, "libs/core"), { recursive: true });
    await writeFile(join(ws, "libs/core/go.mod"), "module example.com/core\n\ngo 1.22\n");
    await writeFile(
      join(ws, "libs/core/core.go"),
      'package core\n\nfunc Name() string { return "core" }\n',
    );
  });
  afterAll(async () => {
    await rm(ws, { recursive: true, force: true });
  });

  it("resolves sibling go.mod modules so ring macro edges can lift them", async () => {
    const snap = await snapshotGoWorkingTree(ws, commit, "demo");
    const imports = snap.edges.filter((e) => e.type === "imports");
    expect(
      imports.some(
        (e) =>
          e.from === "file:services/app/main.go" && e.to === "file:libs/core/core.go" && e.resolved,
      ),
    ).toBe(true);

    const graph = snapshotToAtlasGraph(snap as Parameters<typeof snapshotToAtlasGraph>[0]);
    const moduleIdOf = deriveModuleIdOf(graph.nodes.map((node) => node.id));
    expect(deriveModules(graph, moduleIdOf).moduleEdges).toContainEqual({
      source: "services/app",
      target: "libs/core",
      weight: 1,
    });
  });
});
