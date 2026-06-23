import { describe, expect, it } from "vitest";
import type { Snapshot, Trace } from "@sprawlens/contracts";
import {
  parseFoldedStacks,
  parseLlvmCoverage,
  resolveTraceSymbols,
  traceOverlay,
} from "./trace.ts";

const sym = (
  id: string,
  name: string,
  startLine: number,
  endLine: number,
): {
  id: string;
  kind: "function";
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
  complexity: number;
  exported: boolean;
} => ({ id, kind: "function", name, startLine, endLine, loc: 1, complexity: 1, exported: true });

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
      symbols: [
        sym("symbol:src/a.ts:function:foo:1", "foo", 1, 10),
        sym("symbol:src/a.ts:function:Bar:12", "Bar", 12, 20),
      ],
    },
  ],
} as unknown as Snapshot;

describe("resolveTraceSymbols", () => {
  it("resolves by enclosing line range, then by name", () => {
    const trace: Trace = {
      schemaVersion: 1,
      source: "v8-cpuprofile",
      nodes: [
        { id: "1", ref: { file: "src/a.ts", name: "foo", line: 3 } },
        // name mismatch but line falls inside Bar's range → resolves to Bar
        { id: "2", ref: { file: "src/a.ts", name: "anon", line: 15 } },
        // no line, name match
        { id: "3", ref: { file: "src/a.ts", name: "foo" } },
      ],
      edges: [],
    };
    const out = resolveTraceSymbols(trace, snapshot);
    expect(out.nodes[0]!.ref.symbolId).toBe("symbol:src/a.ts:function:foo:1");
    expect(out.nodes[1]!.ref.symbolId).toBe("symbol:src/a.ts:function:Bar:12");
    expect(out.nodes[2]!.ref.symbolId).toBe("symbol:src/a.ts:function:foo:1");
  });

  it("falls back to a name match anywhere when the file is unknown", () => {
    const trace: Trace = {
      schemaVersion: 1,
      source: "folded",
      nodes: [{ id: "1", ref: { name: "Bar" } }],
      edges: [],
    };
    expect(resolveTraceSymbols(trace, snapshot).nodes[0]!.ref.symbolId).toBe(
      "symbol:src/a.ts:function:Bar:12",
    );
  });

  it("leaves symbolId undefined when nothing matches", () => {
    const trace: Trace = {
      schemaVersion: 1,
      source: "folded",
      nodes: [{ id: "1", ref: { name: "nope" } }],
      edges: [],
    };
    expect(resolveTraceSymbols(trace, snapshot).nodes[0]!.ref.symbolId).toBeUndefined();
  });
});

describe("traceOverlay", () => {
  it("keys weights by symbol id and drops unresolved nodes/edges", () => {
    const trace: Trace = {
      schemaVersion: 1,
      source: "v8-cpuprofile",
      nodes: [
        { id: "1", ref: { name: "foo", symbolId: "S:foo" }, selfTimeUs: 100 },
        { id: "2", ref: { name: "bar", symbolId: "S:bar" }, selfTimeUs: 40 },
        { id: "3", ref: { name: "x" } }, // unresolved
      ],
      edges: [
        { from: "1", to: "2", count: 5 },
        { from: "1", to: "3", count: 9 }, // dropped (3 unresolved)
      ],
    };
    const overlay = traceOverlay(trace);
    expect(overlay.nodeWeight).toEqual({ "S:foo": 100, "S:bar": 40 });
    expect(overlay.maxNodeWeight).toBe(100);
    expect(overlay.edges).toEqual([{ from: "S:foo", to: "S:bar", weight: 5 }]);
  });
});

describe("parseFoldedStacks", () => {
  it("builds nodes, self samples and call edges from collapsed stacks", () => {
    const trace = parseFoldedStacks("a;b;c 5\na;b 3");
    expect(trace.source).toBe("folded");
    expect(trace.sampleCount).toBe(8);
    const byId = new Map(trace.nodes.map((n) => [n.id, n]));
    expect(byId.get("c")!.selfSamples).toBe(5);
    expect(byId.get("b")!.selfSamples).toBe(3);
    expect(trace.edges).toContainEqual({ from: "a", to: "b", count: 8 });
    expect(trace.edges).toContainEqual({ from: "b", to: "c", count: 5 });
  });

  it("cleans Rust mangling so the ref name matches the symbol", () => {
    const trace = parseFoldedStacks("crate::module::beta::h0123abcd 7");
    expect(trace.nodes[0]!.ref.name).toBe("beta");
  });
});

describe("parseLlvmCoverage", () => {
  it("makes one coverage node per executed function with exact counts", () => {
    const trace = parseLlvmCoverage(
      {
        data: [
          {
            functions: [
              {
                name: "_RNvCs7SYglE0mePz_9trace_exp5delta",
                count: 200,
                filenames: ["/repo/src/calc.rs"],
              },
              {
                name: "_ZN9trace_exp4beta17h0643486588e47a79E",
                count: 400,
                filenames: ["/repo/src/calc.rs"],
              },
              { name: "_ZN9trace_exp5never17habc0E", count: 0, filenames: ["/repo/src/calc.rs"] },
            ],
          },
        ],
      },
      "/repo",
    );
    expect(trace.source).toBe("llvm-coverage");
    expect(trace.edges).toEqual([]);
    // never-executed (count 0) is dropped
    expect(trace.nodes).toHaveLength(2);
    const delta = trace.nodes.find((n) => n.ref.name === "delta")!;
    expect(delta.calls).toBe(200);
    expect(delta.ref.file).toBe("src/calc.rs");
    const beta = trace.nodes.find((n) => n.ref.name === "beta")!;
    expect(beta.calls).toBe(400);
  });

  it("takes the last segment of an already-demangled name", () => {
    const trace = parseLlvmCoverage(
      {
        data: [
          {
            functions: [
              { name: "trace_exp::calc::beta", count: 5, filenames: ["/repo/src/calc.rs"] },
            ],
          },
        ],
      },
      "/repo",
    );
    expect(trace.nodes[0]!.ref.name).toBe("beta");
  });
});
