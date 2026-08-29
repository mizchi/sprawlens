import { describe, expect, it } from "vitest";
import { buildExternalCommonSequenceProbe } from "@sprawlens/layout";
import { runExternalCommonSequenceProbe } from "./externalControlledSequence.ts";

const probe = buildExternalCommonSequenceProbe({
  nodes: [
    { id: "a", weight: 3 },
    { id: "b", weight: 2 },
    { id: "c", weight: 1 },
  ],
  edges: [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
  ],
});

const script = `let input = "";
let requestCount = 0;
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  requestCount++;
  const request = JSON.parse(input);
  const layout = (snapshot) => ({
    snapshotId: snapshot.snapshotId,
    cells: snapshot.graph.nodes.map((node, index) => {
      const x0 = index / snapshot.graph.nodes.length;
      const x1 = (index + 1) / snapshot.graph.nodes.length;
      return { id: node.id, polygon: [
        { x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 1 }, { x: x0, y: 1 }
      ] };
    }),
    work: { nativeIterations: requestCount },
    nativeConverged: true
  });
  process.stdout.write(JSON.stringify({
    schemaVersion: 2, requestId: request.requestId, status: "ok",
    implementation: {
      id: "fixture", revision: "fixture-1", sourceUrl: "https://example.test/fixture",
      license: "MIT", adapterRevision: "1", parameters: {},
      temporalAccess: "current-only", stateModel: "stateless",
      capabilities: {
        initializationModes: ["native"], nodeCount: { min: 1, max: 100 },
        boundary: "convex-polygon", cellGeometry: "convex-polygons", siteSemantics: "derived",
        dependencySemantics: "ignored", deterministicForFixedSeed: true
      }
    },
    runs: request.snapshots.map(layout)
  }));
});`;

describe("external controlled-sequence runner", () => {
  it("runs every path in a fresh process and computes no-op/reversal/order calibration", async () => {
    const result = await runExternalCommonSequenceProbe(
      [process.execPath, "--eval", script],
      probe,
      { seed: 7, timeoutMs: 5_000 },
    );

    expect(Object.keys(result.paths)).toEqual([
      "noOp",
      "weight",
      "leafInsertion",
      "combined",
      "orderAB",
      "orderBA",
      "orderABDuplicate",
    ]);
    expect(result.failures).toEqual([]);
    expect(result.metadataConsistent).toBe(true);
    expect(result.paths.noOp.status).toBe("ok");
    if (result.paths.noOp.status !== "ok") throw new Error("expected successful no-op path");
    expect(result.paths.noOp.evaluation.runs.map(({ work }) => work.nativeIterations)).toEqual([
      1, 1, 1,
    ]);
    expect(result.calibration).toMatchObject({
      noOp: { polygonIoULoss: 0 },
      reversalExcess: {
        weight: { polygonIoULoss: 0 },
        leafInsertion: { polygonIoULoss: 0 },
        combined: { polygonIoULoss: 0 },
      },
      orderABvsBA: { polygonIoULoss: 0 },
      duplicateABNoise: { polygonIoULoss: 0 },
    });
  });

  it("fails closed when host-side validity exceeds a frozen threshold", async () => {
    const result = await runExternalCommonSequenceProbe(
      [process.execPath, "--eval", script],
      probe,
      {
        seed: 7,
        timeoutMs: 5_000,
        validityThresholds: {
          maxRelativeAreaError: 0.01,
          maxAreaCoverageError: 1e-8,
          maxOverlapAreaRatio: 1e-8,
          maxOutsideBoundaryAreaRatio: 1e-8,
          requireNativeConverged: true,
        },
      },
    );

    expect(result.calibration).toBeNull();
    expect(result.failures).toHaveLength(7);
    expect(result.failures.every(({ status }) => status === "host-invalid")).toBe(true);
  });

  it("fails closed when implementation provenance differs from the expected manifest", async () => {
    const exploratory = await runExternalCommonSequenceProbe(
      [process.execPath, "--eval", script],
      probe,
      { seed: 7, timeoutMs: 5_000 },
    );
    const first = exploratory.paths.noOp;
    if (first.status !== "ok") throw new Error("expected exploratory fixture response");

    const result = await runExternalCommonSequenceProbe(
      [process.execPath, "--eval", script],
      probe,
      {
        seed: 7,
        timeoutMs: 5_000,
        expectedImplementation: { ...first.response.implementation, revision: "unexpected" },
      },
    );

    expect(result.calibration).toBeNull();
    expect(result.failures).toHaveLength(7);
    expect(result.failures.every(({ status }) => status === "implementation-mismatch")).toBe(true);
  });
});
