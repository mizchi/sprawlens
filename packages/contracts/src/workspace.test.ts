import { describe, expect, it } from "vitest";
import { matchWorkspacePackage, type WorkspacePackage } from "./workspace.js";

const npm: WorkspacePackage[] = [
  { name: "@sprawlens/schema", sourceRoot: "packages/schema/src" },
  { name: "@sprawlens/schema-utils", sourceRoot: "packages/schema-utils/src" },
  { name: "@sprawlens/layout", sourceRoot: "packages/layout/src" },
];

describe("matchWorkspacePackage", () => {
  it("matches a bare package name with an empty subpath", () => {
    expect(matchWorkspacePackage(npm, "@sprawlens/schema")).toEqual({
      pkg: npm[0],
      subpath: "",
    });
  });

  it("matches a subpath import and returns the remainder", () => {
    expect(matchWorkspacePackage(npm, "@sprawlens/layout/rings")).toEqual({
      pkg: npm[2],
      subpath: "rings",
    });
  });

  it("prefers the longest package-name prefix", () => {
    // schema-utils must win over schema for its own specifier
    expect(matchWorkspacePackage(npm, "@sprawlens/schema-utils")?.pkg.name).toBe(
      "@sprawlens/schema-utils",
    );
    // and a plain schema import must not be captured by schema-utils
    expect(matchWorkspacePackage(npm, "@sprawlens/schema")?.pkg.name).toBe(
      "@sprawlens/schema",
    );
  });

  it("returns null for an external package", () => {
    expect(matchWorkspacePackage(npm, "react")).toBeNull();
    // a name that only partially overlaps a package is not a match
    expect(matchWorkspacePackage(npm, "@sprawlens/schematics")).toBeNull();
  });

  it("uses :: as the separator for Rust crate paths", () => {
    const crates: WorkspacePackage[] = [
      { name: "my_lib", sourceRoot: "crates/my_lib/src" },
    ];
    expect(matchWorkspacePackage(crates, "my_lib::module::Item", "::")).toEqual({
      pkg: crates[0],
      subpath: "module::Item",
    });
    expect(matchWorkspacePackage(crates, "serde::Deserialize", "::")).toBeNull();
  });
});
