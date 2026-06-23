import { describe, expect, it } from "vitest";
import type { Snapshot, TestRun, TestTree } from "@sprawlens/contracts";
import { parseTestId, resolveTestRun, testRunOverlay } from "./testRun.js";

const snapshot = {
  schemaVersion: 1,
  repoPath: "/r",
  commit: {} as never,
  edges: [],
  metrics: {} as never,
  nodes: [
    {
      id: "file:src/math.ts",
      type: "file",
      path: "src/math.ts",
      ext: ".ts",
      loc: 30,
      sizeBytes: 0,
      symbols: [
        {
          id: "symbol:src/math.ts:function:add:1",
          kind: "function",
          name: "add",
          startLine: 1,
          endLine: 5,
          loc: 5,
          complexity: 1,
          exported: true,
        },
      ],
    },
  ],
} as unknown as Snapshot;

// tree: src/math.test.ts › (suite "math") › case "adds two numbers" @ line 5
const tree: TestTree = {
  root: {
    id: "testroot",
    kind: "dir",
    name: "",
    children: [
      {
        id: "testfile:src/math.test.ts",
        kind: "file",
        name: "math.test.ts",
        file: "src/math.test.ts",
        children: [
          {
            id: "test:src/math.test.ts:3:math",
            kind: "suite",
            name: "math",
            file: "src/math.test.ts",
            startLine: 3,
            children: [
              {
                id: "test:src/math.test.ts:5:adds two numbers",
                kind: "case",
                name: "adds two numbers",
                file: "src/math.test.ts",
                startLine: 5,
                endLine: 7,
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe("resolveTestRun", () => {
  it("keeps a matching testId and resolves covers to symbol ids", () => {
    const run: TestRun = {
      schemaVersion: 1,
      results: [
        {
          testId: "test:src/math.test.ts:5:adds two numbers",
          status: "pass",
          durationMs: 12,
          covers: [{ name: "add", file: "src/math.ts", line: 2 }],
        },
      ],
    };
    const out = resolveTestRun(run, tree, snapshot);
    expect(out.results[0]!.testId).toBe("test:src/math.test.ts:5:adds two numbers");
    expect(out.results[0]!.covers![0]!.symbolId).toBe("symbol:src/math.ts:function:add:1");
  });

  it("re-resolves a drifted testId by file + full title", () => {
    const run: TestRun = {
      schemaVersion: 1,
      // line drifted from 5 to 9; matched back by file + "math › adds two numbers"
      results: [
        {
          testId: "test:src/math.test.ts:9:adds two numbers",
          file: "src/math.test.ts",
          name: "math › adds two numbers",
          status: "fail",
        },
      ],
    };
    const out = resolveTestRun(run, tree, snapshot);
    expect(out.results[0]!.testId).toBe("test:src/math.test.ts:5:adds two numbers");
  });
});

describe("parseTestId", () => {
  it("splits test:<file>:<line>:<title>, keeping colons in the title", () => {
    expect(parseTestId("test:src/a.test.ts:5:adds two numbers")).toEqual({
      file: "src/a.test.ts",
      line: 5,
      title: "adds two numbers",
    });
    expect(parseTestId("test:src/a.test.ts:9:a:b ratio")).toEqual({
      file: "src/a.test.ts",
      line: 9,
      title: "a:b ratio",
    });
  });

  it("accepts a line-less id and rejects non-test ids", () => {
    expect(parseTestId("test:src/a.test.ts:?:later")).toEqual({
      file: "src/a.test.ts",
      title: "later",
    });
    expect(parseTestId("symbol:src/a.ts:function:add:1")).toBeNull();
  });
});

describe("testRunOverlay", () => {
  it("keys status/duration/covers by testId and counts statuses", () => {
    const run: TestRun = {
      schemaVersion: 1,
      results: [
        {
          testId: "a",
          status: "pass",
          durationMs: 3,
          covers: [{ name: "add", symbolId: "S:add" }],
        },
        { testId: "b", status: "fail", durationMs: 8 },
        { testId: "c", status: "skip" },
      ],
    };
    const overlay = testRunOverlay(run);
    expect(overlay.statusOf).toEqual({ a: "pass", b: "fail", c: "skip" });
    expect(overlay.durationOf).toEqual({ a: 3, b: 8 });
    expect(overlay.coversOf).toEqual({ a: ["S:add"] });
    expect(overlay.counts).toEqual({ pass: 1, fail: 1, skip: 1, todo: 0, total: 3 });
  });
});
