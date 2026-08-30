import { describe, expect, it } from "vitest";
import type { ExternalLayoutSequenceRequestV2 } from "@sprawlens/schema";
import {
  GIT_AUTHOR_SEQUENCE_IMPLEMENTATION,
  gitAuthorCsvInputs,
  parseGitAuthorRectangles,
  runGitAuthorSequenceAdapterRequest,
} from "./gitAuthorExternalAdapter.ts";

const graph0 = {
  nodes: [
    { id: "src/a", weight: 3 },
    { id: "src/b", weight: 2 },
  ],
  edges: [{ source: "src/a", target: "src/b" }],
};

const request = (overrides: Partial<ExternalLayoutSequenceRequestV2> = {}) =>
  ({
    schemaVersion: 2,
    requestId: "git-author:42",
    caseName: "git-author",
    seed: 42,
    boundary: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    snapshots: [
      { snapshotId: "g0", graph: graph0 },
      {
        snapshotId: "g1",
        graph: {
          nodes: [
            { id: "src/b", weight: 4 },
            { id: "src/c", weight: 1 },
          ],
          edges: [],
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
    ...overrides,
  }) satisfies ExternalLayoutSequenceRequestV2;

describe("GIT fixed-author sequence adapter", () => {
  it("serializes active leaves in request order with lexically ordered fixed-width revisions", () => {
    expect(gitAuthorCsvInputs(request())).toEqual([
      {
        name: "revision-000000.csv",
        contents: "id,weight\nsrc/a,3\nsrc/b,2\n",
      },
      {
        name: "revision-000001.csv",
        contents: "id,weight\nsrc/b,4\nsrc/c,1\n",
      },
    ]);
  });

  it("normalizes rectangles and restores the snapshot request order", () => {
    expect(
      parseGitAuthorRectangles(
        ["src/b 500000 0 500000 1000000", "src/a 0 0 500000 1000000"].join("\n"),
        graph0.nodes.map(({ id }) => id),
        1_000_000,
      ),
    ).toEqual([
      {
        id: "src/a",
        site: { x: 0.25, y: 0.5 },
        polygon: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 },
        ],
      },
      {
        id: "src/b",
        site: { x: 0.75, y: 0.5 },
        polygon: [
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0.5, y: 1 },
        ],
      },
    ]);
  });

  it("declares the author's whole-sequence parser and predecessor-retaining layout state", async () => {
    const response = await runGitAuthorSequenceAdapterRequest(request(), {
      execute: async (inputs) => {
        expect(inputs).toHaveLength(2);
        return [
          "src/a 0 0 600000 1000000\nsrc/b 600000 0 400000 1000000\n",
          "src/b 0 0 800000 1000000\nsrc/c 800000 0 200000 1000000\n",
        ];
      },
    });

    expect(response).toMatchObject({
      schemaVersion: 2,
      status: "ok",
      implementation: {
        id: "git-author-java",
        revision: "19b0f52c268838b31db32a200cf7b340a4b705fe",
        temporalAccess: "full-sequence",
        stateModel: "sequence-global",
        capabilities: {
          initializationModes: ["native"],
          nodeCount: { min: 1, max: 80 },
          boundary: "axis-aligned-rectangle",
          siteSemantics: "derived",
          dependencySemantics: "ignored",
          deterministicForFixedSeed: true,
        },
      },
      runs: [
        { snapshotId: "g0", nativeConverged: true, work: {} },
        { snapshotId: "g1", nativeConverged: true, work: {} },
      ],
    });
    expect(GIT_AUTHOR_SEQUENCE_IMPLEMENTATION.parameters).toMatchObject({
      parserSeed: 42,
      sourceModified: false,
      boundaryRestriction: "normalized-axis-aligned-rectangle",
    });
  });

  it("fails closed for a seed the fixed author parser cannot honor", async () => {
    const response = await runGitAuthorSequenceAdapterRequest(request({ seed: 7 }), {
      execute: async () => {
        throw new Error("must not execute");
      },
    });

    expect(response).toMatchObject({
      status: "unsupported",
      reason: { code: "seed" },
    });
  });

  it("fails closed for non-rectangular boundaries and lossy CSV ids", async () => {
    const nonRectangle = await runGitAuthorSequenceAdapterRequest(
      request({
        boundary: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 },
        ],
      }),
      { execute: async () => [] },
    );
    expect(nonRectangle).toMatchObject({
      status: "unsupported",
      reason: { code: "boundary" },
    });

    const lossyId = await runGitAuthorSequenceAdapterRequest(
      request({
        snapshots: [
          { snapshotId: "g0", graph: { nodes: [{ id: "src/a,b", weight: 1 }], edges: [] } },
          { snapshotId: "g1", graph: { nodes: [{ id: "src/a,b", weight: 2 }], edges: [] } },
        ],
      }),
      { execute: async () => [] },
    );
    expect(lossyId).toMatchObject({
      status: "unsupported",
      reason: { code: "node-id" },
    });

    const hierarchyCollision = await runGitAuthorSequenceAdapterRequest(
      request({
        snapshots: [
          {
            snapshotId: "g0",
            graph: {
              nodes: [
                { id: "src", weight: 1 },
                { id: "src/a", weight: 1 },
              ],
              edges: [],
            },
          },
          { snapshotId: "g1", graph: graph0 },
        ],
      }),
      { execute: async () => [] },
    );
    expect(hierarchyCollision).toMatchObject({
      status: "unsupported",
      reason: { code: "node-id" },
    });
  });

  it("returns a structured failure when the external author process fails", async () => {
    const response = await runGitAuthorSequenceAdapterRequest(request(), {
      execute: async () => {
        throw new Error("javac unavailable");
      },
    });
    expect(response).toMatchObject({
      status: "failed",
      reason: { code: "author-process", message: "javac unavailable" },
    });
  });
});
