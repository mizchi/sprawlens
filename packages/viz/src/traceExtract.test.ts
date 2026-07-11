import { describe, expect, it } from "vitest";
import type { Trace, TraceTimeline } from "@sprawlens/schema";
import { buildTraceExtractFocus } from "./traceExtract.ts";

const moduleOfId = (id: string) => id.split("/")[0] ?? id;
const parentFileOf = (id: string) => (id.startsWith("symbol:") ? id.split(":")[1]! : id);

describe("buildTraceExtractFocus", () => {
  it("extracts every symbol in a timeline, not only the current cursor", () => {
    const timeline: TraceTimeline = {
      schemaVersion: 1,
      steps: [
        {
          t: 0,
          durUs: 10,
          plane: "server",
          symbolId: "symbol:src/app.ts:function:main:1",
          depth: 1,
          stack: ["symbol:src/app.ts:function:main:1"],
        },
        {
          t: 10,
          durUs: 10,
          plane: "server",
          symbolId: "symbol:src/db.ts:function:load:1",
          depth: 2,
          stack: ["symbol:src/app.ts:function:main:1", "symbol:src/db.ts:function:load:1"],
        },
      ],
      planes: [{ plane: "server", startUs: 0, durationUs: 20 }],
    };

    const focus = buildTraceExtractFocus({ timeline, moduleOfId, parentFileOf });

    expect(focus?.level).toBe("symbol");
    expect([...focus!.symbolIds]).toEqual([
      "symbol:src/app.ts:function:main:1",
      "symbol:src/db.ts:function:load:1",
    ]);
    expect([...focus!.fileIds]).toEqual(["src/app.ts", "src/db.ts"]);
    expect([...focus!.moduleIds]).toEqual(["src"]);
    expect(focus!.downstreamEdges).toContainEqual({
      source: "symbol:src/app.ts:function:main:1",
      target: "symbol:src/db.ts:function:load:1",
      kind: "call",
    });
  });

  it("extracts a resolved static trace", () => {
    const trace: Trace = {
      schemaVersion: 1,
      source: "folded",
      nodes: [
        { id: "a", ref: { name: "main", symbolId: "symbol:src/app.ts:function:main:1" }, calls: 3 },
        { id: "b", ref: { name: "load", symbolId: "symbol:src/db.ts:function:load:1" }, calls: 2 },
      ],
      edges: [{ from: "a", to: "b", count: 2 }],
    };

    const focus = buildTraceExtractFocus({ trace, moduleOfId, parentFileOf });

    expect([...focus!.symbolIds]).toEqual([
      "symbol:src/app.ts:function:main:1",
      "symbol:src/db.ts:function:load:1",
    ]);
    expect(focus!.downstreamEdges).toHaveLength(1);
  });

  it("returns null when no resolved trace symbols exist", () => {
    expect(buildTraceExtractFocus({ moduleOfId, parentFileOf })).toBeNull();
    expect(
      buildTraceExtractFocus({
        timeline: { schemaVersion: 1, steps: [], planes: [] },
        moduleOfId,
        parentFileOf,
      }),
    ).toBeNull();
  });
});
