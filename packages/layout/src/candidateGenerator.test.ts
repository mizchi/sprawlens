import { describe, expect, it } from "vitest";
import { createStableVoronoiCandidateGenerator } from "./candidateGenerator.ts";
import { stableNeighborhoodUpdate } from "./stableNeighborhood.ts";

const nodes = [
  { id: "a", weight: 4 },
  { id: "b", weight: 3 },
  { id: "c", weight: 2 },
  { id: "d", weight: 1 },
];
const edges = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
];
const clip = { kind: "rect" as const, x: 0, y: 0, width: 1000, height: 700 };

describe("stable neighborhood candidate-generator contract", () => {
  it("adds a paper-derived generator without changing the feasible-envelope policy", () => {
    const result = stableNeighborhoodUpdate(nodes, edges, clip, {
      seed: 7,
      anchorMixes: [0, 1],
      additionalCandidateGenerators: [createStableVoronoiCandidateGenerator()],
    });

    expect(result.baseline.generator.id).toBe("npvt-anchor-assignment");
    expect(result.candidates.map((candidate) => candidate.generator.id)).toContain(
      "stable-vt-algorithm8-power-reimplementation",
    );
    expect(result.selected.adjacency + 1e-12).toBeGreaterThanOrEqual(result.baseline.adjacency);
  });

  it("exposes fixed Algorithm 6 and weight-aware Algorithm 8 as distinct generators", () => {
    const fixed = createStableVoronoiCandidateGenerator({
      hilbertVariant: "algorithm-6-fixed",
    });
    const variable = createStableVoronoiCandidateGenerator({
      hilbertVariant: "algorithm-8-variable",
    });

    expect(fixed.id).toBe("stable-vt-algorithm6-power-reimplementation");
    expect(variable.id).toBe("stable-vt-algorithm8-power-reimplementation");
    expect(fixed.parameters.hilbertVariant).toBe("thesis-algorithm-6-fixed-order-8");
  });

  it("rejects generator output whose cell ids do not match the graph", () => {
    expect(() =>
      stableNeighborhoodUpdate(nodes, edges, clip, {
        seed: 7,
        anchorMixes: [0],
        additionalCandidateGenerators: [
          {
            id: "invalid-fixture",
            revision: "1",
            parameters: {},
            generate: (context) => [
              {
                candidateId: "missing-node",
                state: {
                  ...context.baselineState,
                  cells: context.baselineState.cells.slice(1),
                },
                converged: true,
                steps: 0,
              },
            ],
          },
        ],
      }),
    ).toThrow("candidate cell ids must exactly match the graph");
  });

  it("rejects duplicate candidate ids within one generator", () => {
    expect(() =>
      stableNeighborhoodUpdate(nodes, edges, clip, {
        seed: 7,
        anchorMixes: [0],
        additionalCandidateGenerators: [
          {
            id: "duplicate-fixture",
            revision: "1",
            parameters: {},
            generate: (context) => [
              {
                candidateId: "same",
                state: context.baselineState,
                converged: true,
                steps: 0,
              },
              {
                candidateId: "same",
                state: context.baselineState,
                converged: true,
                steps: 0,
              },
            ],
          },
        ],
      }),
    ).toThrow("candidate ids must be unique within a generator");
  });

  it("rejects non-finite generated geometry before metric evaluation", () => {
    expect(() =>
      stableNeighborhoodUpdate(nodes, edges, clip, {
        seed: 7,
        anchorMixes: [0],
        additionalCandidateGenerators: [
          {
            id: "non-finite-fixture",
            revision: "1",
            parameters: {},
            generate: (context) => [
              {
                candidateId: "nan-site",
                state: {
                  ...context.baselineState,
                  cells: context.baselineState.cells.map((cell, index) =>
                    index === 0 ? { ...cell, site: { ...cell.site, x: Number.NaN } } : cell,
                  ),
                },
                converged: true,
                steps: 0,
              },
            ],
          },
        ],
      }),
    ).toThrow("candidate geometry must be finite");
  });
});
