import { describe, expect, it } from "vitest";
import { liftOverlay, type FlowOverlay } from "./overlay.ts";

const moduleOf = (id: string): string | null =>
  id.startsWith("src/alpha/") ? "src/alpha" : id.startsWith("src/beta/") ? "src/beta" : null;

describe("liftOverlay — path", () => {
  const trace: FlowOverlay = {
    id: "t1",
    label: "trace: POST /orders",
    kind: "path",
    steps: [
      { nodeId: "src/alpha/a.ts", at: 0 },
      { nodeId: "src/alpha/b.ts", at: 1 },
      { nodeId: "src/beta/d.ts", at: 2 },
      { nodeId: "vendor/x.ts", at: 3 },
      { nodeId: "src/beta/e.ts", at: 4 },
    ],
  };

  it("maps steps and collapses consecutive duplicates", () => {
    const lifted = liftOverlay(trace, moduleOf);
    expect(lifted.kind).toBe("path");
    if (lifted.kind !== "path") return;
    expect(lifted.steps.map((s) => s.nodeId)).toEqual(["src/alpha", "src/beta"]);
    // first step of each run keeps its timestamp
    expect(lifted.steps[0]!.at).toBe(0);
    expect(lifted.steps[1]!.at).toBe(2);
  });

  it("preserves identity fields", () => {
    const lifted = liftOverlay(trace, moduleOf);
    expect(lifted.id).toBe("t1");
    expect(lifted.label).toBe("trace: POST /orders");
  });

  it("identity mapping keeps the path unchanged", () => {
    const lifted = liftOverlay(trace, (id) => id);
    if (lifted.kind !== "path") throw new Error("path expected");
    expect(lifted.steps).toEqual(trace.kind === "path" ? trace.steps : []);
  });
});

describe("liftOverlay — heat", () => {
  const coverage: FlowOverlay = {
    id: "c1",
    label: "coverage",
    kind: "heat",
    hits: new Map([
      ["src/alpha/a.ts", 5],
      ["src/alpha/b.ts", 3],
      ["src/beta/d.ts", 2],
      ["vendor/x.ts", 9],
    ]),
  };

  it("sums hits into the mapped groups and drops unmapped ids", () => {
    const lifted = liftOverlay(coverage, moduleOf);
    expect(lifted.kind).toBe("heat");
    if (lifted.kind !== "heat") return;
    expect(lifted.hits.get("src/alpha")).toBe(8);
    expect(lifted.hits.get("src/beta")).toBe(2);
    expect(lifted.hits.has("vendor/x.ts")).toBe(false);
  });
});
