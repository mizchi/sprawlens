import { describe, expect, it } from "vitest";
import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
} from "@sprawlens/contracts";
import { evaluateExternalLayoutBaselineResponse } from "./externalBaselineMetrics.ts";

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
