import { describe, expect, it } from "vitest";
import { computeGraphMetrics } from "./metrics.ts";
import type { CodeEdge, CodeNode } from "@sprawlens/contracts";

describe("computeGraphMetrics", () => {
  it("computes fan-in, fan-out, cyclic components, and largest connected component", () => {
    const nodes: CodeNode[] = [
      { id: "repo", type: "repo", name: "repo" },
      { id: "file:a.ts", type: "file", path: "a.ts", ext: ".ts", loc: 1, sizeBytes: 1 },
      { id: "file:b.ts", type: "file", path: "b.ts", ext: ".ts", loc: 1, sizeBytes: 1 },
      { id: "file:c.ts", type: "file", path: "c.ts", ext: ".ts", loc: 1, sizeBytes: 1 },
      { id: "file:d.ts", type: "file", path: "d.ts", ext: ".ts", loc: 1, sizeBytes: 1 },
    ];
    const edges: CodeEdge[] = [
      {
        id: "imports:file:a.ts->file:b.ts:./b",
        type: "imports",
        from: "file:a.ts",
        to: "file:b.ts",
        specifier: "./b",
        resolved: true,
      },
      {
        id: "imports:file:b.ts->file:c.ts:./c",
        type: "imports",
        from: "file:b.ts",
        to: "file:c.ts",
        specifier: "./c",
        resolved: true,
      },
      {
        id: "imports:file:c.ts->file:a.ts:./a",
        type: "imports",
        from: "file:c.ts",
        to: "file:a.ts",
        specifier: "./a",
        resolved: true,
      },
    ];

    const result = computeGraphMetrics(nodes, edges);

    expect(result.metrics).toMatchObject({
      loc: 4,
      fileCount: 4,
      importEdgeCount: 3,
      cycleCount: 1,
      largestComponentSize: 3,
      maxFanIn: 1,
      maxFanOut: 1,
    });
    expect(result.cycleFiles.sort()).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(result.fileMetrics["a.ts"]).toMatchObject({ fanIn: 1, fanOut: 1, inCycle: true });
    expect(result.fileMetrics["d.ts"]).toMatchObject({ fanIn: 0, fanOut: 0, inCycle: false });
  });
});
