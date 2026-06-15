import { describe, expect, it } from "vitest";
import type { Snapshot } from "@sprawlens/contracts";
import { applyLayers, layerManifest, resolveLayers } from "./layersConfig.js";
import { layerOfNode } from "./layers.js";

const commit = {
  hash: "WORKTREE",
  shortHash: "worktree",
  timestamp: "2020-01-01T00:00:00.000Z",
  authorName: "t",
  message: "t",
  aiIndicators: [],
};

function snap(paths: string[]): Snapshot {
  return {
    schemaVersion: 1,
    repoPath: "/tmp/x",
    commit,
    nodes: [
      { id: "repo", type: "repo", name: "x" },
      ...paths.map((p) => ({
        id: `file:${p}`,
        type: "file" as const,
        path: p,
        ext: ".ts",
        loc: 10,
        sizeBytes: 100,
      })),
    ],
    edges: [],
    metrics: { loc: paths.length * 10 } as Snapshot["metrics"],
  };
}

const layerByPath = (s: Snapshot) =>
  new Map(
    s.nodes
      .filter((n) => n.type === "file")
      .map((n) => [(n as { path: string }).path, (n as { layer?: string }).layer]),
  );

describe("applyLayers", () => {
  it("stamps the built-in test layer, leaves source bare", () => {
    const out = applyLayers(snap(["src/a.ts", "src/a.test.ts"]), {});
    const by = layerByPath(out);
    expect(by.get("src/a.ts")).toBeUndefined();
    expect(by.get("src/a.test.ts")).toBe("test");
  });

  it("routes a custom glob layer (first match wins, ordered after built-ins)", () => {
    const out = applyLayers(snap(["src/a.ts", "docs/intro.ts"]), {
      layers: [{ name: "docs", match: ["docs/**"] }],
    });
    const by = layerByPath(out);
    expect(by.get("docs/intro.ts")).toBe("docs");
    expect(by.get("src/a.ts")).toBeUndefined();
  });

  it("overrides a built-in layer's matcher when redefined by name", () => {
    // redefining `test` with an explicit glob replaces the default regex
    const out = applyLayers(snap(["src/a.test.ts", "spec/b.ts"]), {
      layers: [{ name: "test", match: ["spec/**"] }],
    });
    const by = layerByPath(out);
    expect(by.get("spec/b.ts")).toBe("test");
    expect(by.get("src/a.test.ts")).toBeUndefined(); // no longer a test
  });

  it("drops ignored files and edges referencing them", () => {
    const base = snap(["src/a.ts", "gen/big.ts"]);
    base.edges.push({
      id: "imports:file:src/a.ts->file:gen/big.ts:./big",
      type: "imports",
      from: "file:src/a.ts",
      to: "file:gen/big.ts",
      specifier: "./big",
      resolved: true,
    });
    const out = applyLayers(base, { ignore: ["gen/**"] });
    expect(out.nodes.some((n) => n.type === "file" && n.path === "gen/big.ts")).toBe(
      false,
    );
    expect(out.edges.length).toBe(0);
  });

  it("maps a deps glob to the deps layer", () => {
    const out = applyLayers(snap(["src/a.ts", "vendor/lib.ts"]), {
      layers: [{ name: "deps", match: ["vendor/**"], includeExternal: true }],
    });
    expect(layerByPath(out).get("vendor/lib.ts")).toBe("deps");
  });
});

describe("resolveLayers", () => {
  it("keeps built-ins, appends new names, overrides same names in place", () => {
    const resolved = resolveLayers([
      { name: "deps", match: ["vendor/**"] },
      { name: "docs", match: ["docs/**"] },
    ]);
    expect(resolved.map((l) => l.name)).toEqual(["test", "deps", "docs"]);
    expect(resolved.find((l) => l.name === "deps")?.match).toEqual(["vendor/**"]);
  });
});

describe("layerManifest", () => {
  it("emits name/layout/includeExternal for every layer, defaults filled", () => {
    const manifest = layerManifest({ layers: [{ name: "docs", match: ["docs/**"] }] });
    expect(manifest).toEqual([
      { name: "test", layout: "rings", includeExternal: false },
      { name: "deps", layout: "rings", includeExternal: true },
      { name: "docs", layout: "rings", includeExternal: false },
    ]);
  });
});

describe("layerOfNode", () => {
  it("prefers the stamped layer, falls back to the path-based default", () => {
    expect(layerOfNode({ id: "file:src/a.test.ts" })).toBe("test");
    expect(layerOfNode({ id: "file:src/a.ts" })).toBe("source");
    expect(layerOfNode({ id: "file:src/a.ts", layer: "deps" })).toBe("deps");
  });
});
