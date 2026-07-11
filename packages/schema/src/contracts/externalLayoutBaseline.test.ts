import { describe, expect, it } from "vitest";
import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
} from "@sprawlens/contracts";
import { parseExternalLayoutBaselineResponse } from "./externalLayoutBaseline.ts";

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
