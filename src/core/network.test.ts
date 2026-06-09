import { describe, expect, it } from "vitest";
import { buildReviewGraphFrame, interpolateReviewGraphFrames, reviewGraphToGeoJson } from "./network.js";
import type { Snapshot } from "./types.js";

function snapshot(hash: string, files: Array<{ path: string; loc: number }>, imports: Array<[string, string, string]>): Snapshot {
  return {
    schemaVersion: 1,
    repoPath: "/repo",
    commit: {
      hash,
      shortHash: hash,
      timestamp: "2026-06-09T00:00:00.000Z",
      authorName: "Test",
      message: "fixture",
      aiIndicators: [],
    },
    nodes: [
      { id: "repo", type: "repo", name: "repo" },
      ...files.map((file) => ({
        id: `file:${file.path}`,
        type: "file" as const,
        path: file.path,
        ext: ".ts",
        loc: file.loc,
        sizeBytes: file.loc,
      })),
    ],
    edges: imports.map(([from, to, specifier]) => ({
      id: `imports:file:${from}->file:${to}:${specifier}`,
      type: "imports" as const,
      from: `file:${from}`,
      to: `file:${to}`,
      specifier,
      resolved: true,
    })),
    metrics: {
      loc: files.reduce((sum, file) => sum + file.loc, 0),
      fileCount: files.length,
      dirCount: 0,
      importEdgeCount: imports.length,
      unresolvedImportCount: 0,
      cycleCount: 0,
      largestComponentSize: 0,
      maxFanIn: 0,
      maxFanOut: 0,
    },
  };
}

describe("review graph model", () => {
  it("builds a deterministic layered graph frame from a snapshot", () => {
    const frame = buildReviewGraphFrame(
      snapshot(
        "abc",
        [
          { path: "packages/app/src/index.ts", loc: 80 },
          { path: "packages/app/src/index.test.ts", loc: 30 },
          { path: "scripts/release.ts", loc: 50 },
        ],
        [
          ["packages/app/src/index.test.ts", "packages/app/src/index.ts", "../src/index"],
          ["scripts/release.ts", "packages/app/src/index.ts", "../packages/app/src/index"],
        ],
      ),
    );

    expect(frame.nodes.map((node) => [node.path, node.group, node.layer])).toEqual([
      ["packages/app/src/index.test.ts", "packages", "test"],
      ["packages/app/src/index.ts", "packages", "runtime"],
      ["scripts/release.ts", "scripts", "tooling"],
    ]);
    expect(frame.edges).toHaveLength(2);
    expect(frame.bounds.maxX).toBeGreaterThan(frame.bounds.minX);
  });

  it("marks diff status and exports node and edge GeoJSON features", () => {
    const frame = buildReviewGraphFrame(
      snapshot("after", [{ path: "src/a.ts", loc: 20 }, { path: "src/b.ts", loc: 120 }], [["src/a.ts", "src/b.ts", "./b"]]),
      {
        diff: {
          addedNodes: ["file:src/b.ts"],
          removedNodes: [],
          addedEdges: ["imports:file:src/a.ts->file:src/b.ts:./b"],
          removedEdges: [],
          changedFiles: [{ path: "src/a.ts", locDelta: 5 }],
          hotspots: [{ path: "src/b.ts", score: 25, reasons: ["large-new-file"] }],
        },
      },
    );

    expect(frame.nodes.find((node) => node.path === "src/b.ts")).toMatchObject({
      status: "hotspot",
      hotspotScore: 25,
    });
    expect(frame.edges[0]).toMatchObject({ status: "added" });

    const geojson = reviewGraphToGeoJson(frame);
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.filter((feature) => feature.properties.kind === "node")).toHaveLength(2);
    expect(geojson.features.filter((feature) => feature.properties.kind === "edge")).toHaveLength(1);
  });

  it("interpolates node alpha for timeline animation", () => {
    const before = buildReviewGraphFrame(snapshot("before", [{ path: "src/a.ts", loc: 20 }], []));
    const after = buildReviewGraphFrame(snapshot("after", [{ path: "src/a.ts", loc: 20 }, { path: "src/b.ts", loc: 20 }], []));
    const frame = interpolateReviewGraphFrames(before, after, 0.25);

    expect(frame.nodes.find((node) => node.path === "src/a.ts")).toMatchObject({ alpha: 1, status: "stable" });
    expect(frame.nodes.find((node) => node.path === "src/b.ts")).toMatchObject({ alpha: 0.25, status: "added" });
  });
});
