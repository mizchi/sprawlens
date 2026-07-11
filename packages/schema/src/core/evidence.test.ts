import { describe, expect, it } from "vitest";
import type { AtlasEvidence } from "@sprawlens/contracts";
import { normalizeAtlasEvidence, projectAtlasEvidence } from "./evidence.ts";

describe("atlas evidence", () => {
  it("normalizes a partial wire payload into a deterministic v1 contract", () => {
    expect(
      normalizeAtlasEvidence({
        changes: [{ id: "b.ts", kind: "modified" }],
        tests: [{ id: "test:b", status: "pass" }],
      }),
    ).toEqual({
      schemaVersion: 1,
      changes: [{ id: "b.ts", kind: "modified" }],
      trace: null,
      tests: [{ id: "test:b", status: "pass" }],
    });
  });

  it("projects serializable arrays into scene-ready maps and clamps heat", () => {
    const evidence: AtlasEvidence = {
      schemaVersion: 1,
      changes: [
        {
          id: "src/a.ts",
          kind: "modified",
          addedLines: 3,
          deletedLines: 1,
          touchedLines: 4,
          totalLines: 20,
        },
        { id: "src/removed.ts", kind: "removed" },
      ],
      trace: {
        id: "trace-1",
        timeUs: 42,
        edges: [{ source: "symbol:a", target: "symbol:b", weight: 2 }],
        heat: [
          { id: "symbol:a", value: 1.5 },
          { id: "symbol:b", value: -1 },
        ],
      },
      tests: [{ id: "test:a", status: "fail", durationMs: 12 }],
    };

    const projected = projectAtlasEvidence(evidence);
    expect(projected.changed).toEqual(new Map([["src/a.ts", "modified"]]));
    expect(projected.diffStats.get("src/a.ts")).toEqual({
      added: 3,
      deleted: 1,
      touched: 4,
      total: 20,
      ratio: 0.2,
    });
    expect(projected.traceEdges).toEqual(evidence.trace?.edges);
    expect(projected.traceHeat).toEqual(
      new Map([
        ["symbol:a", 1],
        ["symbol:b", 0],
      ]),
    );
    expect(projected.testStatus).toEqual(new Map([["test:a", "fail"]]));
    expect(projected.testDuration).toEqual(new Map([["test:a", 12]]));
    expect(projected.summary).toEqual({
      changes: { added: 0, modified: 1, removed: 1 },
      traceEdges: 1,
      tracedNodes: 2,
      tests: { pass: 0, fail: 1, skip: 0, todo: 0 },
    });
  });
});
