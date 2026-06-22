import { describe, expect, it } from "vitest";
import type { Snapshot } from "@sprawlens/contracts";
import { buildTraceTimeline, mergeTimelines } from "./traceTimeline.js";

const sym = (id: string, name: string, startLine: number, endLine: number) => ({
  id,
  kind: "function" as const,
  name,
  startLine,
  endLine,
  loc: 1,
  complexity: 1,
  exported: true,
});

const FOO = "symbol:src/a.ts:function:foo:1";
const BAR = "symbol:src/a.ts:function:bar:12";
const BAZ = "symbol:src/b.ts:function:baz:1";

const snapshot = {
  schemaVersion: 1,
  repoPath: "/r",
  commit: {} as never,
  edges: [],
  metrics: {} as never,
  nodes: [
    {
      id: "file:src/a.ts",
      type: "file",
      path: "src/a.ts",
      ext: ".ts",
      loc: 30,
      sizeBytes: 0,
      symbols: [sym(FOO, "foo", 1, 10), sym(BAR, "bar", 12, 20)],
    },
    {
      id: "file:src/b.ts",
      type: "file",
      path: "src/b.ts",
      ext: ".ts",
      loc: 10,
      sizeBytes: 0,
      symbols: [sym(BAZ, "baz", 1, 5)],
    },
  ],
} as unknown as Snapshot;

// V8 cpuprofile shape. node 6 is a pure library frame under root (no first-party
// ancestor); node 3 is a library frame *under* foo (resolves to foo via ancestor).
const profile = {
  nodes: [
    { id: 1, callFrame: { functionName: "(root)", url: "", lineNumber: -1, columnNumber: -1 }, children: [2, 4, 6] },
    { id: 2, callFrame: { functionName: "foo", url: "file:///r/src/a.ts", lineNumber: 0, columnNumber: 0 }, children: [3] },
    { id: 3, callFrame: { functionName: "readSync", url: "node:fs", lineNumber: 10, columnNumber: 0 } },
    { id: 4, callFrame: { functionName: "bar", url: "file:///r/src/a.ts", lineNumber: 11, columnNumber: 0 }, children: [5] },
    { id: 5, callFrame: { functionName: "baz", url: "file:///r/src/b.ts", lineNumber: 0, columnNumber: 0 } },
    { id: 6, callFrame: { functionName: "gc", url: "", lineNumber: -1, columnNumber: -1 } },
  ],
  samples: [6, 2, 2, 3, 4, 5, 5],
  timeDeltas: [100, 100, 100, 100, 100, 100, 100],
  startTime: 0,
  endTime: 700,
};

describe("buildTraceTimeline", () => {
  const tl = buildTraceTimeline(profile, { repoRoot: "/r", snapshot, plane: "server" });

  it("collapses consecutive same-symbol samples into ordered spans", () => {
    expect(tl.steps.map((s) => s.symbolId)).toEqual([FOO, BAR, BAZ]);
  });

  it("drops a leading library-only sample but advances the clock", () => {
    // node 6 (pre-roll, t=0..100) emits nothing; foo's span starts at t=100
    expect(tl.steps[0]!.t).toBe(100);
  });

  it("attributes a library frame under foo (node 3) to foo's span", () => {
    // samples 2,2,3 → foo span = 300us (the node:fs frame folds into foo)
    expect(tl.steps[0]!.durUs).toBe(300);
    expect(tl.steps[1]!).toMatchObject({ symbolId: BAR, t: 400, durUs: 100 });
    expect(tl.steps[2]!).toMatchObject({ symbolId: BAZ, t: 500, durUs: 200 });
  });

  it("records the resolved caller→callee stack and full sampled depth", () => {
    expect(tl.steps[0]!.stack).toEqual([FOO]);
    expect(tl.steps[0]!.depth).toBe(2); // [foo, root]
    expect(tl.steps[2]!.stack).toEqual([BAR, BAZ]); // bar called baz
    expect(tl.steps[2]!.depth).toBe(3); // [baz, bar, root]
  });

  it("tags the plane and reports its wall-clock span", () => {
    expect(tl.steps.every((s) => s.plane === "server")).toBe(true);
    expect(tl.planes).toEqual([{ plane: "server", startUs: 0, durationUs: 700 }]);
  });
});

describe("mergeTimelines", () => {
  it("concatenates planes in order with cumulative startUs", () => {
    const server = buildTraceTimeline(profile, { repoRoot: "/r", snapshot, plane: "server" });
    const browser = buildTraceTimeline(
      { ...profile, samples: [2], timeDeltas: [50], endTime: 50 },
      { repoRoot: "/r", snapshot, plane: "browser" },
    );
    const merged = mergeTimelines(server, browser);
    expect(merged.planes).toEqual([
      { plane: "server", startUs: 0, durationUs: 700 },
      { plane: "browser", startUs: 700, durationUs: 50 },
    ]);
    // steps keep their plane-relative t; plane order is server then browser
    expect(merged.steps.at(-1)!.plane).toBe("browser");
    expect(merged.steps.length).toBe(server.steps.length + browser.steps.length);
  });
});
