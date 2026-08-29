import { describe, expect, it } from "vitest";
import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutSequenceRequestV2,
} from "@sprawlens/schema";
import {
  runStableVoronoiAdapterRequest,
  runStableVoronoiSequenceAdapterRequest,
} from "./stableVoronoiExternalAdapter.ts";

const graph = {
  nodes: [
    { id: "a", weight: 4 },
    { id: "b", weight: 3 },
    { id: "c", weight: 2 },
    { id: "d", weight: 1 },
  ],
  edges: [{ source: "a", target: "b" }],
};
const request: ExternalLayoutBaselineRequestV1 = {
  schemaVersion: 1,
  requestId: "stable:1",
  caseName: "stable",
  seed: 1,
  boundary: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  before: graph,
  after: graph,
  semantics: { nodeWeight: "loc", dependencyEdges: "undirected-constraints" },
};

describe("paper-derived stable Voronoi external adapter", () => {
  it("returns a versioned deterministic layout with explicit reimplementation provenance", () => {
    const response = runStableVoronoiAdapterRequest(request);

    expect(response).toMatchObject({
      schemaVersion: 1,
      requestId: request.requestId,
      status: "ok",
      implementation: {
        id: "stable-vt-algorithm8-power-reimplementation",
        license: "MIT",
        parameters: {
          hilbertVariant: "thesis-algorithm-8-variable-order",
          curveOrders: "1-extended,2,3,8",
          powerSolver: "sprawlens-capacity-power-diagram",
          algorithm8Implemented: true,
          algorithm9Implemented: false,
          authorAwpSweepLine: false,
        },
      },
      before: { converged: true },
      after: { converged: true },
    });
    if (response.status !== "ok") throw new Error("expected successful response");
    expect(response.before.cells.map(({ id }) => id)).toEqual(["a", "b", "c", "d"]);
    expect(response.after).toEqual(response.before);
  });

  it("rejects unsupported node counts without running the solver", () => {
    expect(
      runStableVoronoiAdapterRequest({
        ...request,
        before: { nodes: [], edges: [] },
      }),
    ).toMatchObject({ status: "unsupported", reason: { code: "node-count" } });
  });

  it("declares current-only stateless semantics for an ordered sequence", () => {
    const sequence: ExternalLayoutSequenceRequestV2 = {
      schemaVersion: 2,
      requestId: "stable-sequence:1",
      caseName: "stable-sequence",
      seed: 1,
      boundary: request.boundary,
      snapshots: [
        { snapshotId: "g0", graph },
        {
          snapshotId: "g1",
          graph: {
            ...graph,
            nodes: graph.nodes.map((node, index) => ({
              ...node,
              weight: node.weight + (index === 0 ? 1 : 0),
            })),
          },
        },
        { snapshotId: "g0-return", graph },
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

    const response = runStableVoronoiSequenceAdapterRequest(sequence);

    expect(response).toMatchObject({
      schemaVersion: 2,
      status: "ok",
      implementation: {
        temporalAccess: "current-only",
        stateModel: "stateless",
        capabilities: {
          initializationModes: ["native"],
          dependencySemantics: "ignored",
        },
      },
      runs: [
        { snapshotId: "g0", nativeConverged: true },
        { snapshotId: "g1", nativeConverged: true },
        { snapshotId: "g0-return", nativeConverged: true },
      ],
    });
    if (response.status !== "ok") throw new Error("expected successful sequence response");
    expect(response.runs[2]?.cells).toEqual(response.runs[0]?.cells);
  });
});
