import type { AtlasEdge } from "@sprawlens/contracts";
import { minCostAssignment } from "./assignment.ts";
import {
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellInputNode,
} from "./capacityLayout.ts";
import { clipScale, type ClipRegion } from "./clip.ts";
import { cellAdjacency, greedySwapAssignment, realizedEdgeRate } from "./neighborhood.ts";
import type { Vec2 } from "./vec.ts";

export type StableNeighborhoodOptions = {
  seed: number;
  anchors?: ReadonlyMap<string, Vec2>;
  anchorMixes?: readonly number[];
  /** Greedy adjacency-swap pass budgets; must include the 8-pass NPVT baseline. */
  swapPasses?: readonly number[];
  /** Absolute adjacency-rate loss allowed relative to the pure NPVT candidate. */
  adjacencyTolerance?: number;
  areaTolerance?: number;
  maxSteps?: number;
  adaptationRate?: number;
  lloydRate?: number;
};

export type StableNeighborhoodCandidate = {
  anchorMix: number;
  swapPasses: number;
  state: CapacityLayoutState;
  converged: boolean;
  steps: number;
  adjacency: number;
  displacement: number;
  edgeLength: number;
  meanAreaError: number;
  objective: number;
};

export type StableNeighborhoodResult = {
  state: CapacityLayoutState;
  selected: StableNeighborhoodCandidate;
  baseline: StableNeighborhoodCandidate;
  candidates: StableNeighborhoodCandidate[];
  totalSteps: number;
  weightedSolves: number;
  eligibleCandidates: number;
  minimumAdjacency: number;
};

const DEFAULT_MIXES = [0, 0.25, 0.5, 0.75, 1] as const;

function settle(
  state: CapacityLayoutState,
  tolerance: number,
  maxSteps: number,
): { state: CapacityLayoutState; steps: number; converged: boolean } {
  let current = state;
  let steps = 0;
  while (steps < maxSteps && !isConverged(current, tolerance)) {
    current = capacityStep(current);
    steps++;
  }
  return { state: current, steps, converged: isConverged(current, tolerance) };
}

function candidateMetrics(
  state: CapacityLayoutState,
  edges: readonly AtlasEdge[],
  anchors: ReadonlyMap<string, Vec2>,
) {
  const adjacency = realizedEdgeRate(cellAdjacency(state.cells), edges);
  const scale = clipScale(state.clip);
  const siteOf = new Map(state.cells.map((cell) => [cell.id, cell.site] as const));
  let displacement = 0;
  let surviving = 0;
  for (const [id, anchor] of anchors) {
    const site = siteOf.get(id);
    if (!site) continue;
    displacement += Math.hypot(site.x - anchor.x, site.y - anchor.y) / scale;
    surviving++;
  }
  displacement /= Math.max(1, surviving);
  let edgeLength = 0;
  let edgeWeight = 0;
  for (const edge of edges) {
    const source = siteOf.get(edge.source);
    const target = siteOf.get(edge.target);
    if (!source || !target || edge.source === edge.target) continue;
    const weight = Math.max(edge.weight ?? 1, 0);
    edgeLength += (weight * Math.hypot(target.x - source.x, target.y - source.y)) / scale;
    edgeWeight += weight;
  }
  edgeLength = edgeWeight > 0 ? edgeLength / edgeWeight : 0;
  let meanAreaError = 0;
  for (const cell of state.cells) {
    meanAreaError += Math.abs(cell.actualArea - cell.targetArea) / Math.max(cell.targetArea, 1e-12);
  }
  meanAreaError /= Math.max(1, state.cells.length);
  const objective = meanAreaError + 2 * (1 - adjacency + 0.18 * edgeLength) + 0.7 * displacement;
  return { adjacency, displacement, edgeLength, meanAreaError, objective };
}

/**
 * Stable NPVT-style update. It keeps the pure similarity-based NPVT candidate,
 * generates anchor-aware alternatives, then chooses the least-displacing
 * candidate whose realized adjacency stays within the requested tolerance of
 * that baseline.
 */
export function stableNeighborhoodUpdate(
  nodes: readonly CellInputNode[],
  edges: readonly AtlasEdge[],
  clip: ClipRegion,
  options: StableNeighborhoodOptions,
): StableNeighborhoodResult {
  const areaTolerance = options.areaTolerance ?? 0.01;
  const maxSteps = options.maxSteps ?? 800;
  const adaptationRate = options.adaptationRate;
  const lloydRate = options.lloydRate ?? 0.25;
  const anchors = options.anchors ?? new Map<string, Vec2>();
  const mixes = [...(options.anchorMixes ?? DEFAULT_MIXES)];
  const swapPasses = [...(options.swapPasses ?? [8])];
  if (mixes.length === 0 || mixes[0] !== 0) {
    throw new Error("stable neighborhood anchorMixes must start with the NPVT baseline 0");
  }
  if (mixes.some((mix) => !Number.isFinite(mix) || mix < 0 || mix > 1)) {
    throw new Error("stable neighborhood anchorMixes must be between 0 and 1");
  }
  if (
    swapPasses.length === 0 ||
    !swapPasses.includes(8) ||
    swapPasses.some((passes) => !Number.isInteger(passes) || passes < 0 || passes > 8)
  ) {
    throw new Error("stable neighborhood swapPasses must be integers between 0 and 8 including 8");
  }
  const descriptors = [
    { anchorMix: 0, swapPasses: 8 },
    ...mixes.flatMap((anchorMix) =>
      swapPasses.flatMap((passes) =>
        anchorMix === 0 && passes === 8 ? [] : [{ anchorMix, swapPasses: passes }],
      ),
    ),
  ];
  const similarityLayout = createCapacityLayout([...nodes], clip, {
    seed: options.seed,
    adaptationRate,
    lloydRate,
  });
  const similarity = new Map(similarityLayout.cells.map((cell) => [cell.id, cell.site] as const));
  const slots = settle(
    createCapacityLayout(
      nodes.map((node) => ({ id: node.id, weight: 1 })),
      clip,
      { seed: options.seed, adaptationRate, lloydRate },
    ),
    areaTolerance,
    maxSteps,
  );
  const slotIndex = new Map(slots.state.cells.map((cell, index) => [cell.id, index]));
  const adjacencyById = cellAdjacency(slots.state.cells);
  const slotAdjacency = slots.state.cells.map(
    (cell) => new Set([...(adjacencyById.get(cell.id) ?? [])].map((id) => slotIndex.get(id)!)),
  );

  let totalSteps = slots.steps;
  const weightedByAssignment = new Map<
    string,
    { state: CapacityLayoutState; steps: number; converged: boolean }
  >();
  const candidates = descriptors.map(({ anchorMix, swapPasses: passes }) => {
    const cost = nodes.map((node) => {
      const cold = similarity.get(node.id)!;
      const anchor = anchors.get(node.id);
      const target = anchor
        ? {
            x: cold.x + (anchor.x - cold.x) * anchorMix,
            y: cold.y + (anchor.y - cold.y) * anchorMix,
          }
        : cold;
      return slots.state.cells.map(
        (slot) => (target.x - slot.site.x) ** 2 + (target.y - slot.site.y) ** 2,
      );
    });
    const matched = minCostAssignment(cost);
    const swapped = greedySwapAssignment(
      matched,
      nodes.map((node) => node.id),
      slotAdjacency,
      edges,
      passes,
    );
    const assignmentKey = swapped.join(",");
    let weighted = weightedByAssignment.get(assignmentKey);
    if (!weighted) {
      weighted = settle(
        createCapacityLayout(
          nodes.map((node, index) => ({
            id: node.id,
            weight: node.weight,
            hint: { ...slots.state.cells[swapped[index]!]!.site },
          })),
          clip,
          { seed: options.seed, adaptationRate, lloydRate },
        ),
        areaTolerance,
        maxSteps,
      );
      weightedByAssignment.set(assignmentKey, weighted);
      totalSteps += weighted.steps;
    }
    return {
      anchorMix,
      swapPasses: passes,
      state: weighted.state,
      converged: slots.converged && weighted.converged,
      steps: slots.steps + weighted.steps,
      ...candidateMetrics(weighted.state, edges, anchors),
    };
  });
  const baseline = candidates[0]!;
  const minimumAdjacency = baseline.adjacency - (options.adjacencyTolerance ?? 0);
  const eligible = candidates.filter(
    (candidate) => candidate.converged && candidate.adjacency + 1e-12 >= minimumAdjacency,
  );
  const selected = [...(eligible.length > 0 ? eligible : [baseline])].sort(
    (a, b) =>
      a.displacement - b.displacement ||
      b.adjacency - a.adjacency ||
      a.objective - b.objective ||
      b.anchorMix - a.anchorMix ||
      b.swapPasses - a.swapPasses,
  )[0]!;
  return {
    state: selected.state,
    selected,
    baseline,
    candidates,
    totalSteps,
    weightedSolves: weightedByAssignment.size,
    eligibleCandidates: eligible.length,
    minimumAdjacency,
  };
}
