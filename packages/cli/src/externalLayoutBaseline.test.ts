import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExternalLayoutBaselineRequestV1 } from "@sprawlens/schema";
import {
  createExternalLayoutBaselineRequest,
  createExternalLayoutSequenceRequest,
  runExternalLayoutBaseline,
  runExternalLayoutSequenceBaseline,
} from "./externalLayoutBaseline.ts";

const request: ExternalLayoutBaselineRequestV1 = {
  schemaVersion: 1,
  requestId: "case-a:3",
  caseName: "case-a",
  seed: 3,
  boundary: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  before: {
    nodes: [
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
    ],
    edges: [{ source: "a", target: "b" }],
  },
  after: {
    nodes: [
      { id: "a", weight: 2 },
      { id: "b", weight: 1 },
    ],
    edges: [{ source: "a", target: "b" }],
  },
  semantics: { nodeWeight: "loc", dependencyEdges: "undirected-constraints" },
};

describe("external layout baseline process bridge", () => {
  it("converts an internal delta case to the normalized external contract", () => {
    const converted = createExternalLayoutBaselineRequest(
      {
        name: "module-change",
        before: request.before,
        after: request.after,
        changedIds: new Set(["a"]),
      },
      7,
    );

    expect(converted).toMatchObject({
      schemaVersion: 1,
      requestId: "module-change:7",
      caseName: "module-change",
      seed: 7,
      before: request.before,
      after: request.after,
      semantics: { nodeWeight: "loc", dependencyEdges: "undirected-constraints" },
    });
    expect(converted.boundary).toHaveLength(4);
  });

  it("sends one request over stdin and validates the JSON response", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sprawlens-baseline-"));
    const adapter = join(directory, "adapter.mjs");
    await writeFile(
      adapter,
      `let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  const request = JSON.parse(input);
  const layout = (graph) => ({
    cells: graph.nodes.map((node, index) => {
      const x0 = index / graph.nodes.length;
      const x1 = (index + 1) / graph.nodes.length;
      return {
        id: node.id,
        site: { x: (x0 + x1) / 2, y: 0.5 },
        polygon: [
          { x: x0, y: 0 }, { x: x1, y: 0 },
          { x: x1, y: 1 }, { x: x0, y: 1 }
        ]
      };
    }),
    steps: 1,
    converged: true
  });
  process.stdout.write(JSON.stringify({
    schemaVersion: 1,
    requestId: request.requestId,
    status: "ok",
    implementation: {
      id: "fixture", revision: "fixture-1", sourceUrl: "https://example.test/fixture",
      license: "MIT", adapterRevision: "1", parameters: {}
    },
    before: layout(request.before),
    after: layout(request.after)
  }));
});

`,
    );

    const execution = await runExternalLayoutBaseline([process.execPath, adapter], request, {
      timeoutMs: 5_000,
    });

    expect(execution.status).toBe("completed");
    if (execution.status !== "completed") throw new Error("expected completed adapter execution");
    expect(execution.response.status).toBe("ok");
    expect(execution.wallTimeMs).toBeGreaterThanOrEqual(0);
    expect(execution.stderr).toBe("");
  });

  it("turns malformed adapter output into an explicit execution failure", async () => {
    const execution = await runExternalLayoutBaseline(
      [process.execPath, "--eval", 'process.stdout.write("not-json")'],
      request,
    );

    expect(execution).toMatchObject({
      status: "failed",
      failure: { code: "invalid-output" },
    });
  });
});

describe("external layout sequence process bridge", () => {
  it("converts ordered graphs without exposing implementation-specific state", () => {
    const converted = createExternalLayoutSequenceRequest(
      "controlled-weight",
      [request.before, request.after, request.before],
      7,
    );

    expect(converted).toMatchObject({
      schemaVersion: 2,
      requestId: "controlled-weight:7",
      caseName: "controlled-weight",
      seed: 7,
      snapshots: [
        { snapshotId: "snapshot-0", graph: request.before },
        { snapshotId: "snapshot-1", graph: request.after },
        { snapshotId: "snapshot-2", graph: request.before },
      ],
    });
  });

  it("validates a sequence response emitted by a separate process", async () => {
    const sequence = createExternalLayoutSequenceRequest(
      "controlled-weight",
      [request.before, request.after, request.before],
      7,
    );
    const script = `let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  const request = JSON.parse(input);
  const layout = (snapshot) => ({
    snapshotId: snapshot.snapshotId,
    cells: snapshot.graph.nodes.map((node, index) => {
      const x0 = index / snapshot.graph.nodes.length;
      const x1 = (index + 1) / snapshot.graph.nodes.length;
      return { id: node.id, site: { x: (x0 + x1) / 2, y: 0.5 }, polygon: [
        { x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 1 }, { x: x0, y: 1 }
      ] };
    }),
    work: { nativeIterations: 1 },
    nativeConverged: true
  });
  process.stdout.write(JSON.stringify({
    schemaVersion: 2, requestId: request.requestId, status: "ok",
    implementation: {
      id: "fixture", revision: "fixture-2", sourceUrl: "https://example.test/fixture",
      license: "MIT", adapterRevision: "2", parameters: {},
      temporalAccess: "current-only", stateModel: "stateless",
      capabilities: {
        initializationModes: ["native"], nodeCount: { min: 1, max: 100 },
        boundary: "convex-polygon", cellGeometry: "convex-polygons", siteSemantics: "native",
        dependencySemantics: "ignored", deterministicForFixedSeed: true
      }
    },
    runs: request.snapshots.map(layout)
  }));
});`;

    const execution = await runExternalLayoutSequenceBaseline(
      [process.execPath, "--eval", script],
      sequence,
      { timeoutMs: 5_000 },
    );

    expect(execution.status).toBe("completed");
    if (execution.status !== "completed") throw new Error("expected completed sequence adapter");
    expect(execution.response.status).toBe("ok");
    if (execution.response.status !== "ok") throw new Error("expected successful sequence");
    expect(execution.response.runs.map(({ snapshotId }) => snapshotId)).toEqual([
      "snapshot-0",
      "snapshot-1",
      "snapshot-2",
    ]);
  });
});
