import { describe, expect, it } from "vitest";
import { parseCpuProfile, parseV8Coverage } from "./trace.js";

// minimal cpuprofile: (root) -> main -> [lib] -> beta ; main -> delta
// main/beta/delta are in-repo; lib is in node_modules (excluded); root is a builtin
const profile = {
  startTime: 0,
  endTime: 1000,
  nodes: [
    {
      id: 1,
      callFrame: { functionName: "(root)", url: "", lineNumber: -1, columnNumber: -1 },
      children: [2],
    },
    {
      id: 2,
      callFrame: {
        functionName: "main",
        url: "file:///repo/src/a.ts",
        lineNumber: 4,
        columnNumber: 0,
      },
      children: [3, 5],
    },
    {
      id: 3,
      callFrame: {
        functionName: "wrap",
        url: "file:///repo/node_modules/x/i.js",
        lineNumber: 0,
        columnNumber: 0,
      },
      children: [4],
    },
    {
      id: 4,
      callFrame: {
        functionName: "beta",
        url: "file:///repo/src/a.ts",
        lineNumber: 1,
        columnNumber: 0,
      },
    },
    {
      id: 5,
      callFrame: {
        functionName: "delta",
        url: "file:///repo/src/a.ts",
        lineNumber: 9,
        columnNumber: 0,
      },
    },
  ],
  samples: [4, 4, 5, 2],
  timeDeltas: [10, 10, 20, 5],
};

describe("parseCpuProfile", () => {
  it("keeps in-repo frames with repo-relative file + 1-based line", () => {
    const trace = parseCpuProfile(profile, "/repo");
    expect(trace.source).toBe("v8-cpuprofile");
    expect(trace.durationUs).toBe(1000);
    const names = trace.nodes.map((n) => n.ref.name).sort();
    expect(names).toEqual(["beta", "delta", "main"]);
    const beta = trace.nodes.find((n) => n.ref.name === "beta")!;
    expect(beta.ref.file).toBe("src/a.ts");
    expect(beta.ref.line).toBe(2); // V8 0-based -> 1-based
    expect(beta.selfSamples).toBe(2);
  });

  it("drops node_modules and builtin frames", () => {
    const trace = parseCpuProfile(profile, "/repo");
    expect(trace.nodes.find((n) => n.ref.name === "wrap")).toBeUndefined();
    expect(trace.nodes.find((n) => n.ref.name === "(root)")).toBeUndefined();
  });

  it("connects each repo frame to its nearest repo ancestor through library frames", () => {
    const trace = parseCpuProfile(profile, "/repo");
    // main -> beta survives across the node_modules `wrap` frame
    expect(trace.edges).toContainEqual({ from: "2", to: "4", count: 2 });
    expect(trace.edges).toContainEqual({ from: "2", to: "5", count: 1 });
  });
});

describe("parseV8Coverage", () => {
  const coverage = {
    result: [
      {
        scriptId: "1",
        url: "file:///repo/src/a.ts",
        functions: [
          {
            functionName: "foo",
            ranges: [{ startOffset: 0, endOffset: 50, count: 3 }],
            isBlockCoverage: false,
          },
          {
            functionName: "bar",
            ranges: [{ startOffset: 51, endOffset: 80, count: 0 }],
            isBlockCoverage: false,
          },
          {
            functionName: "",
            ranges: [{ startOffset: 81, endOffset: 90, count: 9 }],
            isBlockCoverage: false,
          },
        ],
      },
      {
        scriptId: "2",
        url: "file:///repo/node_modules/x/i.js",
        functions: [
          {
            functionName: "lib",
            ranges: [{ startOffset: 0, endOffset: 5, count: 7 }],
            isBlockCoverage: false,
          },
        ],
      },
    ],
  };

  it("makes one node per executed in-repo named function with exact counts", () => {
    const trace = parseV8Coverage(coverage, "/repo");
    expect(trace.source).toBe("v8-coverage");
    expect(trace.edges).toEqual([]);
    expect(trace.nodes).toHaveLength(1); // bar(count 0) + anon + node_modules dropped
    expect(trace.nodes[0]!.ref).toMatchObject({ file: "src/a.ts", name: "foo" });
    expect(trace.nodes[0]!.calls).toBe(3);
  });
});
