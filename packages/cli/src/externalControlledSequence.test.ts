import { describe, expect, it } from "vitest";
import { buildExternalCommonSequenceProbe } from "@sprawlens/layout";
import type { ExternalLayoutSequenceImplementationV2 } from "@sprawlens/schema";
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

const expectedImplementation: ExternalLayoutSequenceImplementationV2 = {
  id: "fixture",
  revision: "fixture-1",
  sourceUrl: "https://example.test/fixture",
  license: "MIT",
  adapterRevision: "1",
  parameters: {},
  temporalAccess: "current-only",
  stateModel: "stateless",
  capabilities: {
    initializationModes: ["native"],
    nodeCount: { min: 1, max: 100 },
    boundary: "convex-polygon",
    cellGeometry: "convex-polygons",
    siteSemantics: "derived",
    dependencySemantics: "ignored",
    deterministicForFixedSeed: true,
  },
};

const unsupportedScript = script.replace(
  'status: "ok",',
  'status: "unsupported", reason: { code: "fixture", message: "not supported" },',
);

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
    expect(result.confirmatoryEffect).toBeNull();
  });

  it("emits a confirmatory effect only after manifest and host-validity gates pass", async () => {
    const result = await runExternalCommonSequenceProbe(
      [process.execPath, "--eval", script],
      probe,
      {
        seed: 7,
        timeoutMs: 5_000,
        expectedImplementation,
        validityThresholds: {
          maxRelativeAreaError: 2,
          maxAreaCoverageError: 1e-8,
          maxBoundaryGapAreaRatio: 1e-8,
          maxOverlapAreaRatio: 1e-8,
          maxOutsideBoundaryAreaRatio: 1e-8,
          requireNativeConverged: true,
        },
      },
    );

    expect(result.runEligibilityGatesApplied).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.confirmatoryEffect).toEqual(result.calibration);
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
          maxBoundaryGapAreaRatio: 1e-8,
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

  it("promotes unsupported responses inside the manifest to unexpected failures", async () => {
    const result = await runExternalCommonSequenceProbe(
      [process.execPath, "--eval", unsupportedScript],
      probe,
      { seed: 7, timeoutMs: 5_000, expectedImplementation },
    );

    expect(result.calibration).toBeNull();
    expect(result.paths.noOp.expectedSupport).toMatchObject({ expectedSupported: true });
    expect(result.failures).toHaveLength(7);
    expect(result.failures.every(({ status }) => status === "unexpected-unsupported")).toBe(true);
  });

  it("keeps unsupported responses outside the manifest as expected missingness", async () => {
    const limitedImplementation = {
      ...expectedImplementation,
      capabilities: {
        ...expectedImplementation.capabilities,
        nodeCount: { min: 1, max: 2 },
      },
    };
    const limitedScript = unsupportedScript.replace(
      "nodeCount: { min: 1, max: 100 }",
      "nodeCount: { min: 1, max: 2 }",
    );
    const result = await runExternalCommonSequenceProbe(
      [process.execPath, "--eval", limitedScript],
      probe,
      { seed: 7, timeoutMs: 5_000, expectedImplementation: limitedImplementation },
    );

    expect(result.calibration).toBeNull();
    expect(result.paths.noOp.expectedSupport?.expectedSupported).toBe(false);
    expect(result.paths.noOp.expectedSupport?.reasons.map(({ code }) => code)).toEqual([
      "node-count",
      "node-count",
      "node-count",
    ]);
    expect(result.failures).toEqual([]);
  });

  it("rejects successful output for a request outside declared capabilities", async () => {
    const limitedImplementation = {
      ...expectedImplementation,
      capabilities: {
        ...expectedImplementation.capabilities,
        nodeCount: { min: 1, max: 2 },
      },
    };
    const limitedScript = script.replace(
      "nodeCount: { min: 1, max: 100 }",
      "nodeCount: { min: 1, max: 2 }",
    );
    const result = await runExternalCommonSequenceProbe(
      [process.execPath, "--eval", limitedScript],
      probe,
      { seed: 7, timeoutMs: 5_000, expectedImplementation: limitedImplementation },
    );

    expect(result.calibration).toBeNull();
    expect(result.failures).toHaveLength(7);
    expect(result.failures.every(({ status }) => status === "capability-violation")).toBe(true);
  });
});
