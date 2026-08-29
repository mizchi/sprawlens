import { describe, expect, it } from "vitest";
import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
  ExternalLayoutSequenceImplementationV2,
  ExternalLayoutSequenceRequestV2,
  ExternalLayoutSequenceResponseV2,
} from "@sprawlens/contracts";
import {
  parseExternalLayoutBaselineResponse,
  parseExternalLayoutSequenceResponse,
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

const implementation = {
  id: "npvt-author",
  revision: "abc123",
  sourceUrl: "https://example.test/npvt",
  license: "BSD-3-Clause",
  adapterRevision: "adapter-1",
  parameters: { iterations: 150 },
};

const run = {
  cells: [
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
  ],
  steps: 42,
  converged: true,
};

describe("external layout baseline response", () => {
  it("accepts a complete normalized response for the requested node ids", () => {
    const response: ExternalLayoutBaselineResponseV1 = {
      schemaVersion: 1,
      requestId: request.requestId,
      status: "ok",
      implementation,
      before: run,
      after: run,
    };

    expect(parseExternalLayoutBaselineResponse(response, request)).toEqual(response);
  });

  it("rejects mismatched ids and coordinates outside the normalized boundary", () => {
    expect(() =>
      parseExternalLayoutBaselineResponse(
        {
          schemaVersion: 1,
          requestId: request.requestId,
          status: "ok",
          implementation,
          before: run,
          after: {
            ...run,
            cells: [{ ...run.cells[0]!, site: { x: 2, y: 0.5 } }],
          },
        },
        request,
      ),
    ).toThrow(/after.*node ids/);
  });

  it("keeps structured unsupported results", () => {
    const response = {
      schemaVersion: 1,
      requestId: request.requestId,
      status: "unsupported",
      implementation,
      reason: { code: "hierarchy-depth", message: "only one level is supported" },
    };
    expect(parseExternalLayoutBaselineResponse(response, request)).toEqual(response);
  });
});

const sequenceRequest: ExternalLayoutSequenceRequestV2 = {
  schemaVersion: 2,
  requestId: "sequence-a:3",
  caseName: "sequence-a",
  seed: 3,
  boundary: request.boundary,
  snapshots: [
    { snapshotId: "g0", graph: request.before },
    { snapshotId: "ga", graph: request.after },
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

const sequenceCapabilities: ExternalLayoutSequenceImplementationV2["capabilities"] = {
  initializationModes: ["native"],
  nodeCount: { min: 2, max: 80 },
  boundary: "convex-polygon",
  cellGeometry: "convex-polygons",
  siteSemantics: "native",
  dependencySemantics: "ignored",
  deterministicForFixedSeed: true,
};

const sequenceRun = {
  cells: run.cells,
  work: { nativeIterations: 42 },
  nativeConverged: true,
};

describe("external layout sequence response", () => {
  it("accepts ordered snapshot runs with explicit temporal provenance", () => {
    const response: ExternalLayoutSequenceResponseV2 = {
      schemaVersion: 2,
      requestId: sequenceRequest.requestId,
      status: "ok",
      implementation: {
        ...implementation,
        temporalAccess: "current-only",
        stateModel: "stateless",
        capabilities: sequenceCapabilities,
      },
      runs: sequenceRequest.snapshots.map(({ snapshotId }) => ({ snapshotId, ...sequenceRun })),
    };

    expect(parseExternalLayoutSequenceResponse(response, sequenceRequest)).toEqual(response);
  });

  it("rejects reordered runs and node ids that do not match a snapshot", () => {
    expect(() =>
      parseExternalLayoutSequenceResponse(
        {
          schemaVersion: 2,
          requestId: sequenceRequest.requestId,
          status: "ok",
          implementation: {
            ...implementation,
            temporalAccess: "past-and-present",
            stateModel: "predecessor-layout",
            capabilities: sequenceCapabilities,
          },
          runs: [
            { snapshotId: "ga", ...sequenceRun },
            { snapshotId: "g0", ...sequenceRun },
            { snapshotId: "g0-return", ...sequenceRun },
          ],
        },
        sequenceRequest,
      ),
    ).toThrow(/snapshot order/);
  });
});
