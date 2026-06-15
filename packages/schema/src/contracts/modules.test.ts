import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/contracts";
import { defaultModuleIdOf, deriveModuleIdOf, deriveModules } from "./modules.js";

describe("deriveModuleIdOf (structural, language-neutral)", () => {
  it("treats a top-level dir with no direct files as a container", () => {
    // Rust crates / Go internal,pkg: the container's children are the modules
    const m = deriveModuleIdOf([
      "main.go",
      "internal/api/api.go",
      "internal/store/store.go",
      "pkg/mathx/mathx.go",
      "crates/app/src/main.rs",
      "crates/core/src/lib.rs",
    ]);
    expect(m("main.go")).toBe("(root)");
    expect(m("internal/api/api.go")).toBe("internal/api");
    expect(m("internal/store/store.go")).toBe("internal/store");
    expect(m("pkg/mathx/mathx.go")).toBe("pkg/mathx");
    expect(m("crates/app/src/main.rs")).toBe("crates/app");
    expect(m("crates/core/src/lib.rs")).toBe("crates/core");
  });

  it("treats a top-level dir that holds direct files as its own module", () => {
    const m = deriveModuleIdOf(["src/index.ts", "src/core/a.ts"]);
    expect(m("src/index.ts")).toBe("src");
    expect(m("src/core/a.ts")).toBe("src"); // src is a real module, not a container
  });

  it("groups monorepo packages without any hard-coded dir names", () => {
    const m = deriveModuleIdOf([
      "packages/schema/src/index.ts",
      "packages/layout/src/x.ts",
    ]);
    expect(m("packages/schema/src/index.ts")).toBe("packages/schema");
    expect(m("packages/layout/src/x.ts")).toBe("packages/layout");
  });
});

function fileNode(id: string, loc: number) {
  return { id, kind: "file" as const, label: id, metrics: { loc } };
}

const graph: AtlasGraph = {
  nodes: [
    fileNode("src/core/a.ts", 100),
    fileNode("src/core/b.ts", 50),
    fileNode("src/ui/view.tsx", 200),
    fileNode("vite.config.ts", 10),
  ],
  edges: [
    { source: "src/core/b.ts", target: "src/core/a.ts" },
    { source: "src/ui/view.tsx", target: "src/core/a.ts" },
    { source: "src/ui/view.tsx", target: "src/core/b.ts" },
  ],
};

describe("defaultModuleIdOf", () => {
  it("groups src files by their second path segment", () => {
    expect(defaultModuleIdOf("src/core/a.ts")).toBe("src/core");
    expect(defaultModuleIdOf("src/atlas/kernel/vec.ts")).toBe("src/atlas");
  });

  it("treats monorepo container dirs as two-segment modules", () => {
    expect(defaultModuleIdOf("packages/foo/index.ts")).toBe("packages/foo");
    expect(defaultModuleIdOf("tests/page/click.spec.ts")).toBe("tests/page");
  });

  it("groups other files by their first directory", () => {
    expect(defaultModuleIdOf("docs/intro.md")).toBe("docs");
    expect(defaultModuleIdOf("vite.config.ts")).toBe("(root)");
  });

  it("keeps a bare src file under src", () => {
    expect(defaultModuleIdOf("src/main.ts")).toBe("src");
  });
});

describe("deriveModules", () => {
  it("creates module nodes with summed LOC", () => {
    const result = deriveModules(graph);
    const core = result.modules.find((m) => m.id === "src/core")!;
    expect(core.kind).toBe("module");
    expect(core.metrics.loc).toBe(150);
    expect(result.modules.map((m) => m.id).sort()).toEqual([
      "(root)",
      "src/core",
      "src/ui",
    ]);
  });

  it("aggregates cross-module imports into weighted module edges", () => {
    const result = deriveModules(graph);
    expect(result.moduleEdges).toEqual([
      { source: "src/ui", target: "src/core", weight: 2 },
    ]);
  });

  it("buckets files and intra-module edges per module", () => {
    const result = deriveModules(graph);
    expect(result.filesByModule.get("src/core")!.map((f) => f.id)).toEqual([
      "src/core/a.ts",
      "src/core/b.ts",
    ]);
    expect(result.fileEdgesByModule.get("src/core")).toEqual([
      { source: "src/core/b.ts", target: "src/core/a.ts" },
    ]);
    expect(result.fileEdgesByModule.get("src/ui") ?? []).toEqual([]);
  });

  it("respects a custom module assignment", () => {
    const result = deriveModules(graph, () => "everything");
    expect(result.modules).toHaveLength(1);
    expect(result.moduleEdges).toEqual([]);
    expect(result.modules[0]!.metrics.loc).toBe(360);
  });
});
