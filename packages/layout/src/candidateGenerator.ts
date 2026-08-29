import type { AtlasEdge } from "@sprawlens/contracts";
import type { CapacityLayoutState, CellInputNode } from "./capacityLayout.ts";
import type { ClipRegion } from "./clip.ts";
import { solveStableVoronoi } from "./stableVoronoi.ts";
import type { Vec2 } from "./vec.ts";

export type LayoutCandidateGeneratorMetadata = {
  id: string;
  revision: string;
  parameters: Record<string, string | number | boolean>;
};

export type StableNeighborhoodGeneratedCandidate = {
  candidateId: string;
  state: CapacityLayoutState;
  converged: boolean;
  steps: number;
};

export type StableNeighborhoodCandidateGeneratorContext = {
  nodes: readonly CellInputNode[];
  edges: readonly AtlasEdge[];
  clip: ClipRegion;
  seed: number;
  anchors: ReadonlyMap<string, Vec2>;
  baselineState: CapacityLayoutState;
  areaTolerance: number;
  maxSteps: number;
  adaptationRate?: number;
  lloydRate: number;
};

/**
 * A solver boundary for expanding the finite candidate set. Generators propose
 * geometry only; the host recomputes every metric and applies the same selector.
 */
export type StableNeighborhoodCandidateGenerator = LayoutCandidateGeneratorMetadata & {
  generate: (
    context: StableNeighborhoodCandidateGeneratorContext,
  ) => readonly StableNeighborhoodGeneratedCandidate[];
};

/**
 * Exploratory paper-derived generator. This is Algorithm 6 or 8 initialization
 * with Sprawlens' power solver, not the authors' complete implementation.
 */
export function createStableVoronoiCandidateGenerator(
  options: { hilbertVariant?: "algorithm-6-fixed" | "algorithm-8-variable" } = {},
): StableNeighborhoodCandidateGenerator {
  const hilbertVariant = options.hilbertVariant ?? "algorithm-8-variable";
  const algorithmNumber = hilbertVariant === "algorithm-6-fixed" ? 6 : 8;
  const parameters = {
    hilbertVariant:
      hilbertVariant === "algorithm-6-fixed"
        ? "thesis-algorithm-6-fixed-order-8"
        : "thesis-algorithm-8-variable-order",
    curveOrders: hilbertVariant === "algorithm-6-fixed" ? "8" : "1-extended,2,3,8",
    ...(hilbertVariant === "algorithm-8-variable"
      ? { fractionUpdate: "forward-normalized-position" }
      : {}),
    algorithm6Implemented: true,
    algorithm8Implemented: hilbertVariant === "algorithm-8-variable",
    algorithm9Implemented: false,
    authorAwpSweepLine: false,
    powerSolver: "sprawlens-capacity-power-diagram",
  } as const;
  return {
    id: `stable-vt-algorithm${algorithmNumber}-power-reimplementation`,
    revision: "stable-vt-reimplementation-v2",
    parameters,
    generate: (context) => {
      const result = solveStableVoronoi(context.nodes, context.clip, {
        seed: context.seed,
        hilbertVariant,
        maxIterations: context.maxSteps,
        tolerance: context.areaTolerance,
        adaptationRate: context.adaptationRate,
        lloydRate: context.lloydRate,
      });
      return [
        {
          candidateId: hilbertVariant,
          state: result.state,
          converged: result.converged,
          steps: result.state.iteration,
        },
      ];
    },
  };
}
