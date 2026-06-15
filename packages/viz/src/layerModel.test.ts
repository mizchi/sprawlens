import { describe, expect, it } from "vitest";
import type { AtlasGraph, LayerManifestEntry } from "@sprawlens/schema";
import { buildSatelliteLayers } from "./layerModel.ts";

const ext = { width: 800, height: 600 };
const labelOf = (id: string) => id.split("/").pop() ?? id;

function fileNode(id: string, layer?: string): AtlasGraph["nodes"][number] {
  return { id, kind: "file", label: labelOf(id), metrics: { loc: 10 }, ...(layer ? { layer } : {}) };
}

describe("buildSatelliteLayers", () => {
  it("builds a custom capacity layer from stamped nodes, linking to source", () => {
    const graph: AtlasGraph = {
      nodes: [fileNode("src/a.ts"), fileNode("docs/intro.ts", "docs")],
      edges: [{ source: "docs/intro.ts", target: "src/a.ts" }],
    };
    const manifest: LayerManifestEntry[] = [
      { name: "docs", layout: "capacity", includeExternal: false },
    ];
    const layers = buildSatelliteLayers({
      manifest,
      enabled: new Set(["docs"]),
      graph,
      externalDeps: [],
      ext,
      labelOf,
    });
    expect(layers).toHaveLength(1);
    expect(layers[0]!.id).toBe("docs");
    expect(layers[0]!.planeIndex).toBe(1);
    const doc = layers[0]!.placed.find((p) => p.id === "docs/intro.ts");
    expect(doc?.sourceIds).toContain("src/a.ts");
  });

  it("builds the deps plane from external packages", () => {
    const graph: AtlasGraph = { nodes: [fileNode("src/a.ts")], edges: [] };
    const layers = buildSatelliteLayers({
      manifest: [{ name: "deps", layout: "rings", includeExternal: true }],
      enabled: new Set(["deps"]),
      graph,
      externalDeps: [{ source: "src/a.ts", specifier: "react" }],
      ext,
      labelOf,
    });
    expect(layers).toHaveLength(1);
    expect(layers[0]!.id).toBe("deps");
    expect(layers[0]!.placed.some((p) => p.id === "external:react")).toBe(true);
  });

  it("skips layers that are not enabled and ones with no nodes", () => {
    const graph: AtlasGraph = {
      nodes: [fileNode("src/a.ts"), fileNode("docs/x.ts", "docs")],
      edges: [],
    };
    const manifest: LayerManifestEntry[] = [
      { name: "test", layout: "rings", includeExternal: false },
      { name: "docs", layout: "capacity", includeExternal: false },
    ];
    // test enabled but no test nodes -> skipped; docs disabled -> skipped
    const layers = buildSatelliteLayers({
      manifest,
      enabled: new Set(["test"]),
      graph,
      externalDeps: [],
      ext,
      labelOf,
    });
    expect(layers).toHaveLength(0);
  });
});
