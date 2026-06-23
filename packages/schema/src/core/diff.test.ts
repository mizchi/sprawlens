import { describe, expect, it } from "vitest";
import { diffSnapshots } from "./diff.ts";
import type { Snapshot } from "@sprawlens/contracts";

function snapshot(
  hash: string,
  files: Array<{ path: string; loc: number }>,
  imports: Array<[string, string, string]>,
): Snapshot {
  return {
    schemaVersion: 1,
    repoPath: "/repo",
    commit: {
      hash,
      shortHash: hash.slice(0, 7),
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

describe("diffSnapshots", () => {
  it("computes graph deltas and ranks structural hotspots", () => {
    const before = snapshot(
      "before",
      [
        { path: "a.ts", loc: 20 },
        { path: "b.ts", loc: 20 },
      ],
      [["a.ts", "b.ts", "./b"]],
    );
    const after = snapshot(
      "after",
      [
        { path: "a.ts", loc: 150 },
        { path: "b.ts", loc: 20 },
        { path: "c.ts", loc: 140 },
      ],
      [
        ["a.ts", "b.ts", "./b"],
        ["a.ts", "c.ts", "./c"],
        ["c.ts", "a.ts", "./a"],
      ],
    );

    const diff = diffSnapshots(before, after);

    expect(diff.addedNodes).toContain("file:c.ts");
    expect(diff.addedEdges).toContain("imports:file:a.ts->file:c.ts:./c");
    expect(diff.metricDelta.loc).toBe(270);
    expect(diff.changedFiles.find((file) => file.path === "a.ts")).toMatchObject({
      locDelta: 130,
      fanInBefore: 0,
      fanInAfter: 1,
      fanOutBefore: 1,
      fanOutAfter: 2,
    });
    expect(diff.hotspots[0]?.path).toBe("c.ts");
    expect(diff.hotspots.map((hotspot) => hotspot.reasons).flat()).toContain("new-cycle");
  });
});
