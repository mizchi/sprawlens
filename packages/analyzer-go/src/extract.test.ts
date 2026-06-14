import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { snapshotGoWorkingTree } from "./extract.js";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "go-extract-"));
  await mkdir(join(dir, "sub"), { recursive: true });
  await writeFile(join(dir, "go.mod"), "module demo\ngo 1.22\n");
  await writeFile(join(dir, "sub/sub.go"), "package sub\nfunc Default() string { return \"x\" }\n");
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
    expect(syms.get("main")?.exported).toBe(false);
    const sub = files.find((f) => f.path === "sub/sub.go")!;
    expect(
      (sub.symbols ?? []).find((s) => s.name === "Config")?.kind,
    ).toBe("interface");
    const imports = snap.edges.filter((e) => e.type === "imports");
    expect(imports.some((e) => e.specifier === "fmt" && !e.resolved)).toBe(true);
    // import of the local sub package resolves to its file
    expect(
      imports.some(
        (e) => e.from === "file:main.go" && e.to === "file:sub/sub.go" && e.resolved,
      ),
    ).toBe(true);
  });
});
