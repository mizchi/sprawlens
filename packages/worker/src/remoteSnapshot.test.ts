import { describe, expect, it } from "vitest";
import { normalizeGitHubRepo, parseTarEntries, snapshotFromRemoteFiles } from "./remoteSnapshot.ts";

function tarEntry(name: string, body: string): Uint8Array {
  const data = new TextEncoder().encode(body);
  const size = Math.ceil(data.length / 512) * 512;
  const out = new Uint8Array(512 + size);
  const text = new TextEncoder();
  out.set(text.encode(name), 0);
  out.set(text.encode("0000644\0"), 100);
  out.set(text.encode("0000000\0"), 108);
  out.set(text.encode("0000000\0"), 116);
  out.set(text.encode(data.length.toString(8).padStart(11, "0") + "\0"), 124);
  out.set(text.encode("00000000000\0"), 136);
  out.fill(0x20, 148, 156);
  out[156] = "0".charCodeAt(0);
  out.set(text.encode("ustar\0"), 257);
  let sum = 0;
  for (const byte of out.slice(0, 512)) sum += byte;
  out.set(text.encode(sum.toString(8).padStart(6, "0") + "\0 "), 148);
  out.set(data, 512);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

describe("normalizeGitHubRepo", () => {
  it("accepts owner/repo and GitHub URLs", () => {
    expect(normalizeGitHubRepo("mizchi/sprawlens")).toEqual({ owner: "mizchi", repo: "sprawlens" });
    expect(normalizeGitHubRepo("https://github.com/mizchi/sprawlens")).toEqual({
      owner: "mizchi",
      repo: "sprawlens",
    });
  });

  it("rejects traversal and non-GitHub hosts", () => {
    expect(normalizeGitHubRepo("../x")).toBeNull();
    expect(normalizeGitHubRepo("https://example.com/mizchi/sprawlens")).toBeNull();
  });
});

describe("parseTarEntries", () => {
  it("strips the archive root directory and returns file contents", () => {
    const tar = concat([
      tarEntry("sprawlens-main/src/index.ts", "export const value = 1;\n"),
      tarEntry("sprawlens-main/README.md", "# demo\n"),
      new Uint8Array(1024),
    ]);
    expect(parseTarEntries(tar)).toEqual([
      { path: "src/index.ts", content: "export const value = 1;\n", sizeBytes: 24 },
      { path: "README.md", content: "# demo\n", sizeBytes: 7 },
    ]);
  });
});

describe("snapshotFromRemoteFiles", () => {
  it("builds resolved import edges for TS and Go files", () => {
    const snapshot = snapshotFromRemoteFiles(
      [
        {
          path: "package.json",
          content: '{"name":"demo","workspaces":["packages/*"]}',
          sizeBytes: 43,
        },
        {
          path: "packages/app/src/index.ts",
          content: 'import { value } from "@demo/core";\nexport function run() { return value; }\n',
          sizeBytes: 74,
        },
        {
          path: "packages/core/package.json",
          content: '{"name":"@demo/core","exports":"./src/index.ts"}',
          sizeBytes: 48,
        },
        {
          path: "packages/core/src/index.ts",
          content: "export const value = 1;\n",
          sizeBytes: 24,
        },
        {
          path: "go.mod",
          content: "module example.com/demo\n\ngo 1.22\n",
          sizeBytes: 31,
        },
        {
          path: "cmd/app/main.go",
          content:
            'package main\n\nimport "example.com/demo/pkg/core"\n\nfunc main() { _ = core.Name() }\n',
          sizeBytes: 82,
        },
        {
          path: "pkg/core/core.go",
          content: 'package core\n\nfunc Name() string { return "x" }\n',
          sizeBytes: 47,
        },
      ],
      { repo: "demo/repo" },
    );
    const imports = snapshot.edges.filter((edge) => edge.type === "imports");
    expect(
      imports.some(
        (edge) =>
          edge.from === "file:packages/app/src/index.ts" &&
          edge.to === "file:packages/core/src/index.ts" &&
          edge.resolved,
      ),
    ).toBe(true);
    expect(
      imports.some(
        (edge) =>
          edge.from === "file:cmd/app/main.go" &&
          edge.to === "file:pkg/core/core.go" &&
          edge.resolved,
      ),
    ).toBe(true);
  });

  it("extracts MoonBit receiver methods as method names, not repeated type-name functions", () => {
    const snapshot = snapshotFromRemoteFiles(
      [
        {
          path: "builtin/int.mbt",
          content: [
            "pub type Int Int",
            'pub fn Int::to_string(self : Int) -> String { "" }',
            "pub fn Int::abs(self : Int) -> Int { self }",
            "pub fn parse_int(s : String) -> Int { 0 }",
          ].join("\n"),
          sizeBytes: 144,
        },
      ],
      { repo: "moonbitlang/core" },
    );
    const file = snapshot.nodes.find(
      (node) => node.type === "file" && node.path === "builtin/int.mbt",
    );
    const symbols = file?.type === "file" ? (file.symbols ?? []) : [];
    expect(symbols.filter((symbol) => symbol.name === "Int" && symbol.kind === "function")).toEqual(
      [],
    );
    expect(symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Int", kind: "type" }),
        expect.objectContaining({ name: "to_string", kind: "method", parentClass: "Int" }),
        expect.objectContaining({ name: "abs", kind: "method", parentClass: "Int" }),
        expect.objectContaining({ name: "parse_int", kind: "function" }),
      ]),
    );
  });

  it("builds MoonBit package import edges from moon.mod and moon.pkg DSL manifests", () => {
    const snapshot = snapshotFromRemoteFiles(
      [
        {
          path: "moon.mod",
          content: 'name = "demo"\n',
          sizeBytes: 14,
        },
        {
          path: "lib/moon.pkg",
          content: 'import {\n  "demo/util" as util,\n  "moonbitlang/core/builtin"\n}\n',
          sizeBytes: 66,
        },
        {
          path: "lib/lib.mbt",
          content: "pub fn run() -> Int { @util.value() }\n",
          sizeBytes: 37,
        },
        {
          path: "util/moon.pkg",
          content: "import {\n}\n",
          sizeBytes: 10,
        },
        {
          path: "util/value.mbt",
          content: "pub fn value() -> Int { 1 }\n",
          sizeBytes: 27,
        },
      ],
      { repo: "demo/repo" },
    );
    const imports = snapshot.edges.filter((edge) => edge.type === "imports");
    expect(
      imports.some(
        (edge) =>
          edge.from === "file:lib/lib.mbt" &&
          edge.to === "file:util/value.mbt" &&
          edge.specifier === "demo/util" &&
          edge.resolved,
      ),
    ).toBe(true);
    expect(
      imports.some(
        (edge) =>
          edge.from === "file:lib/lib.mbt" &&
          edge.to === "external:moonbitlang/core/builtin" &&
          edge.specifier === "moonbitlang/core/builtin" &&
          !edge.resolved,
      ),
    ).toBe(true);
  });

  it("builds MoonBit package import edges from moon.mod.json and moon.pkg.json manifests", () => {
    const snapshot = snapshotFromRemoteFiles(
      [
        {
          path: "moon.mod.json",
          content: '{"name":"demo"}',
          sizeBytes: 15,
        },
        {
          path: "app/moon.pkg.json",
          content: '{"import":[{"path":"demo/core","alias":"core"}]}',
          sizeBytes: 48,
        },
        {
          path: "app/main.mbt",
          content: "pub fn main() -> Int { @core.value() }\n",
          sizeBytes: 38,
        },
        {
          path: "core/moon.pkg.json",
          content: '{"import":[]}',
          sizeBytes: 13,
        },
        {
          path: "core/value.mbt",
          content: "pub fn value() -> Int { 1 }\n",
          sizeBytes: 27,
        },
        {
          path: "core/value_test.mbt",
          content: "test { inspect(value()) }\n",
          sizeBytes: 25,
        },
      ],
      { repo: "demo/repo" },
    );
    const imports = snapshot.edges.filter((edge) => edge.type === "imports");
    expect(
      imports.some(
        (edge) =>
          edge.from === "file:app/main.mbt" &&
          edge.to === "file:core/value.mbt" &&
          edge.specifier === "demo/core" &&
          edge.resolved,
      ),
    ).toBe(true);
    expect(imports.some((edge) => edge.to === "file:core/value_test.mbt")).toBe(false);
  });
});
