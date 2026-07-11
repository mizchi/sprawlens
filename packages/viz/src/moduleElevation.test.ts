import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import { deriveModuleIdOf } from "@sprawlens/schema";
import { moduleDependencyElevation } from "./moduleElevation.ts";

function graph(nodes: string[], edges: Array<[string, string]>): AtlasGraph {
  return {
    nodes: nodes.map((id) => ({
      id,
      kind: "file",
      label: id,
      metrics: { loc: 10 },
    })),
    edges: edges.map(([source, target]) => ({ source, target })),
  };
}

function moduleIdOf(paths: string[]) {
  return deriveModuleIdOf(paths);
}

describe("moduleDependencyElevation", () => {
  it("builds topo elevation for Rust crate dependency paths", () => {
    const g = graph(
      ["crates/app/src/main.rs", "crates/service/src/lib.rs", "crates/core/src/lib.rs"],
      [
        ["crates/app/src/main.rs", "crates/service/src/lib.rs"],
        ["crates/service/src/lib.rs", "crates/core/src/lib.rs"],
      ],
    );
    const elev = moduleDependencyElevation(g, moduleIdOf(g.nodes.map((node) => node.id)));
    expect(elev.get("crates/app")).toBe(1);
    expect(elev.get("crates/service")).toBeCloseTo(0.5);
    expect(elev.get("crates/core")).toBe(0);
    expect(elev.get("crates/app/src/main.rs")).toBe(1);
  });

  it("builds topo elevation for Go package dependency paths", () => {
    const g = graph(
      ["cmd/api/main.go", "internal/service/service.go", "pkg/core/core.go"],
      [
        ["cmd/api/main.go", "internal/service/service.go"],
        ["internal/service/service.go", "pkg/core/core.go"],
      ],
    );
    const elev = moduleDependencyElevation(g, moduleIdOf(g.nodes.map((node) => node.id)));
    expect(elev.get("cmd/api")).toBe(1);
    expect(elev.get("internal/service")).toBeCloseTo(0.5);
    expect(elev.get("pkg/core")).toBe(0);
  });

  it("builds topo elevation for MoonBit package dependency paths", () => {
    const g = graph(
      ["app/main.mbt", "lib/http/client.mbt", "core/base.mbt"],
      [
        ["app/main.mbt", "lib/http/client.mbt"],
        ["lib/http/client.mbt", "core/base.mbt"],
      ],
    );
    const elev = moduleDependencyElevation(g, moduleIdOf(g.nodes.map((node) => node.id)));
    expect(elev.get("app")).toBe(1);
    expect(elev.get("lib/http")).toBeCloseTo(0.5);
    expect(elev.get("core")).toBe(0);
  });

  it("returns an empty map when the graph has no cross-module dependency path", () => {
    const g = graph(
      ["single/main.go", "single/helper.go"],
      [["single/main.go", "single/helper.go"]],
    );
    expect(moduleDependencyElevation(g, moduleIdOf(g.nodes.map((node) => node.id))).size).toBe(0);
  });
});
