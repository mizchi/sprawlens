import { describe, expect, it } from "vitest";
import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
  ExternalLayoutSequenceRequestV2,
  ExternalLayoutSequenceResponseV2,
} from "@sprawlens/contracts";
import {
  evaluateExternalLayoutBaselineResponse,
  evaluateExternalLayoutSequenceResponse,
} from "./externalBaselineMetrics.ts";

const request: ExternalLayoutBaselineRequestV1 = {
  schemaVersion: 1,
  requestId: "case:3",
  caseName: "case",
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

const cells = [
  {
    id: "a",
    site: { x: 0.25, y: 0.5 },
    polygon: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
      { x: 0, y: 1 },
    ],
  },
  {
    id: "b",
    site: { x: 0.75, y: 0.5 },
    polygon: [
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.5, y: 1 },
    ],
  },
];

const response: ExternalLayoutBaselineResponseV1 = {
  schemaVersion: 1,
  requestId: request.requestId,
  status: "ok",
  implementation: {
    id: "fixture",
    revision: "fixture-1",
    sourceUrl: "https://example.test",
    license: "MIT",
    adapterRevision: "1",
    parameters: {},
  },
  before: { cells, steps: 2, converged: true },
  after: { cells, steps: 3, converged: true },
};

describe("external baseline common metrics", () => {
  it("infers shared polygon boundaries and recomputes the common metrics", () => {
    const evaluated = evaluateExternalLayoutBaselineResponse(response, request);

    expect(evaluated.status).toBe("ok");
    if (evaluated.status !== "ok") throw new Error("expected metrics");
    expect(evaluated.before).toMatchObject({
      adjacency: 1,
      displacement: 0,
      maxAreaError: 0,
      steps: 2,
      converged: true,
    });
    expect(evaluated.after.adjacency).toBe(1);
    expect(evaluated.after.displacement).toBe(0);
    expect(evaluated.after.meanAreaError).toBeCloseTo(0.375);
    expect(evaluated.after.maxAreaError).toBeCloseTo(0.5);
  });

  it("preserves an adapter's structured unsupported reason", () => {
    const evaluated = evaluateExternalLayoutBaselineResponse(
      {
        schemaVersion: 1,
        requestId: request.requestId,
        status: "unsupported",
        implementation: response.implementation,
        reason: { code: "node-count", message: "too many nodes" },
      },
      request,
    );
    expect(evaluated).toMatchObject({
      status: "unsupported",
      reason: { code: "node-count" },
    });
  });
});

describe("external sequence host-side metrics", () => {
  const sequenceRequest: ExternalLayoutSequenceRequestV2 = {
    schemaVersion: 2,
    requestId: "sequence:3",
    caseName: "sequence",
    seed: 3,
    boundary: request.boundary,
    snapshots: [
      { snapshotId: "g0", graph: request.before },
      { snapshotId: "g0-return", graph: request.before },
    ],
    semantics: request.semantics,
    identitySemantics: "path-stable-id",
    nodeOrderSemantics: "request-order",
    initialization: { mode: "native" },
    lifecycle: {
      resetBeforeRequest: true,
      hostDoesNotResetWithinRequest: true,
      rngReset: "request-seed",
    },
  };
  const sequenceResponse: ExternalLayoutSequenceResponseV2 = {
    schemaVersion: 2,
    requestId: sequenceRequest.requestId,
    status: "ok",
    implementation: {
      ...response.implementation,
      temporalAccess: "current-only",
      stateModel: "stateless",
      capabilities: {
        initializationModes: ["native"],
        nodeCount: { min: 2, max: 80 },
        boundary: "convex-polygon",
        cellGeometry: "convex-polygons",
        siteSemantics: "derived",
        dependencySemantics: "ignored",
        deterministicForFixedSeed: true,
      },
    },
    runs: [
      { snapshotId: "g0", cells, work: { nativeIterations: 2 }, nativeConverged: true },
      {
        snapshotId: "g0-return",
        cells: cells.map(({ site: _, ...cell }) => cell),
        work: { nativeIterations: 3 },
        nativeConverged: true,
      },
    ],
  };

  it("derives absent sites and recomputes validity and recovery outside the adapter", () => {
    const evaluated = evaluateExternalLayoutSequenceResponse(sequenceResponse, sequenceRequest);

    expect(evaluated.status).toBe("ok");
    if (evaluated.status !== "ok") throw new Error("expected sequence metrics");
    expect(evaluated.runs[0]).toMatchObject({
      snapshotId: "g0",
      derivedSiteCount: 0,
      validity: {
        degenerateCellCount: 0,
        nonConvexCellCount: 0,
        areaCoverageError: 0,
        overlapAreaRatio: 0,
        outsideBoundaryAreaRatio: 0,
      },
      initialToCurrent: {
        representativePointDisplacement: 0,
        centroidDisplacement: 0,
        boundaryDisplacement: 0,
        polygonIoULoss: 0,
      },
    });
    expect(evaluated.runs[1]).toMatchObject({
      snapshotId: "g0-return",
      derivedSiteCount: 2,
      work: { nativeIterations: 3 },
      nativeConverged: true,
    });
  });

  it("measures boundary gap from polygon union when overlap cancels total-area error", () => {
    const gapAndOverlap = [
      {
        id: "a",
        site: { x: 0.3, y: 0.5 },
        polygon: [
          { x: 0, y: 0 },
          { x: 0.6, y: 0 },
          { x: 0.6, y: 1 },
          { x: 0, y: 1 },
        ],
      },
      {
        id: "b",
        site: { x: 0.6, y: 0.5 },
        polygon: [
          { x: 0.4, y: 0 },
          { x: 0.8, y: 0 },
          { x: 0.8, y: 1 },
          { x: 0.4, y: 1 },
        ],
      },
    ];
    const evaluated = evaluateExternalLayoutSequenceResponse(
      {
        ...sequenceResponse,
        runs: sequenceResponse.runs.map((run) => ({ ...run, cells: gapAndOverlap })),
      },
      sequenceRequest,
    );

    expect(evaluated.status).toBe("ok");
    if (evaluated.status !== "ok") throw new Error("expected sequence metrics");
    expect(evaluated.runs[0]!.validity.areaCoverageError).toBeCloseTo(0, 12);
    expect(evaluated.runs[0]!.validity.overlapAreaRatio).toBeCloseTo(0.2, 12);
    expect(evaluated.runs[0]!.validity.boundaryGapAreaRatio).toBeCloseTo(0.2, 12);
  });

  it("reports structural polygon and native-site violations", () => {
    const malformed = [
      {
        id: "a",
        site: { x: 0.9, y: 0.9 },
        polygon: [
          { x: 0, y: 0 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 },
          { x: 0.5, y: 0 },
        ],
      },
      {
        id: "b",
        site: { x: 0.75, y: 0.5 },
        polygon: [
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 1, y: 1 },
          { x: 0.5, y: 1 },
        ],
      },
    ];
    const evaluated = evaluateExternalLayoutSequenceResponse(
      {
        ...sequenceResponse,
        implementation: {
          ...sequenceResponse.implementation,
          capabilities: {
            ...sequenceResponse.implementation.capabilities,
            siteSemantics: "native",
          },
        },
        runs: sequenceResponse.runs.map((run) => ({ ...run, cells: malformed })),
      },
      sequenceRequest,
    );

    expect(evaluated.status).toBe("ok");
    if (evaluated.status !== "ok") throw new Error("expected sequence metrics");
    expect(evaluated.runs[0]!.validity).toMatchObject({
      selfIntersectingCellCount: 1,
      duplicateVertexCellCount: 1,
      zeroLengthEdgeCellCount: 1,
      nativeSiteOutsideCellCount: 1,
    });
  });
});
