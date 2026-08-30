import { describe, expect, it } from "vitest";
import type {
  ExternalLayoutSequenceImplementationV2,
  ExternalLayoutSequenceRequestV2,
} from "@sprawlens/contracts";
import { assessExternalLayoutSequenceSupport } from "./externalSequenceSupport.ts";

const request: ExternalLayoutSequenceRequestV2 = {
  schemaVersion: 2,
  requestId: "support:1",
  caseName: "support",
  seed: 1,
  boundary: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  snapshots: [
    {
      snapshotId: "g0",
      graph: {
        nodes: [
          { id: "a", weight: 1 },
          { id: "b", weight: 1 },
        ],
        edges: [{ source: "a", target: "b" }],
      },
    },
  ],
  semantics: { nodeWeight: "loc", dependencyEdges: "undirected-constraints" },
  identitySemantics: "path-stable-id",
  nodeOrderSemantics: "request-order",
  initialization: { mode: "native" },
  lifecycle: {
    resetBeforeRequest: true,
    hostDoesNotResetWithinRequest: true,
    rngReset: "request-seed",
  },
};

const implementation: ExternalLayoutSequenceImplementationV2 = {
  id: "fixture",
  revision: "1",
  sourceUrl: "https://example.test",
  license: "MIT",
  adapterRevision: "1",
  parameters: {},
  temporalAccess: "current-only",
  stateModel: "stateless",
  capabilities: {
    initializationModes: ["native"],
    nodeCount: { min: 1, max: 2 },
    boundary: "axis-aligned-rectangle",
    cellGeometry: "convex-polygons",
    siteSemantics: "derived",
    dependencySemantics: "ignored",
    deterministicForFixedSeed: true,
  },
};

describe("external sequence expected support", () => {
  it("accepts a request only when every declared input capability covers it", () => {
    expect(assessExternalLayoutSequenceSupport(request, implementation)).toEqual({
      expectedSupported: true,
      reasons: [],
    });
  });

  it.each([
    {
      name: "initialization mode",
      changedRequest: { ...request, initialization: { mode: "common-cells", cells: [] } },
      implementation,
      code: "initialization-mode",
    },
    {
      name: "node count in any snapshot",
      changedRequest: {
        ...request,
        snapshots: [
          ...request.snapshots,
          {
            snapshotId: "g1",
            graph: {
              nodes: [
                { id: "a", weight: 1 },
                { id: "b", weight: 1 },
                { id: "c", weight: 1 },
              ],
              edges: [],
            },
          },
        ],
      },
      implementation,
      code: "node-count",
    },
    {
      name: "axis-aligned rectangle boundary",
      changedRequest: {
        ...request,
        boundary: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.8, y: 1 },
          { x: 0, y: 1 },
        ],
      },
      implementation,
      code: "boundary-capability",
    },
  ])("rejects an unsupported $name", ({ changedRequest, implementation, code }) => {
    const result = assessExternalLayoutSequenceSupport(
      changedRequest as ExternalLayoutSequenceRequestV2,
      implementation,
    );
    expect(result.expectedSupported).toBe(false);
    expect(result.reasons.map((reason) => reason.code)).toContain(code);
  });

  it("rejects an invalid convex boundary independently of implementation capability", () => {
    const result = assessExternalLayoutSequenceSupport(
      {
        ...request,
        boundary: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
          { x: 1, y: 0 },
        ],
      },
      {
        ...implementation,
        capabilities: { ...implementation.capabilities, boundary: "convex-polygon" },
      },
    );
    expect(result).toMatchObject({
      expectedSupported: false,
      reasons: [{ code: "invalid-boundary" }],
    });
  });

  it("rejects invalid graph weights and dependency endpoints before adapter execution", () => {
    const result = assessExternalLayoutSequenceSupport(
      {
        ...request,
        snapshots: [
          {
            snapshotId: "invalid",
            graph: {
              nodes: [
                { id: "a", weight: 0 },
                { id: "a", weight: 1 },
              ],
              edges: [
                { source: "a", target: "a" },
                { source: "a", target: "missing" },
              ],
            },
          },
        ],
      },
      implementation,
    );

    expect(result.expectedSupported).toBe(false);
    expect(result.reasons.map(({ code }) => code)).toContain("invalid-graph");
  });
});
