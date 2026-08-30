import type { AtlasEdge, AtlasNode } from "@sprawlens/schema";
import {
  applyGraphChanges,
  weightedBarycenter,
  capacityStep,
  deltaAwareStep,
  isConverged,
  isDeltaConverged,
  stableNeighborhoodUpdate,
  type CapacityLayoutState,
  type ClipRegion,
  type StableNeighborhoodOptions,
  type StableNeighborhoodResult,
  type Vec2,
} from "@sprawlens/layout";

export type StableNeighborhoodUpdateConfig = Omit<StableNeighborhoodOptions, "seed" | "anchors"> & {
  /** Groups above this size retain the incremental warm solver. */
  maxNodes?: number;
};

/** First unstable warm steps hidden synchronously before yielding to frames. */
export const INTERACTIVE_WARM_PRE_ROLL_STEPS = 2;

/**
 * Interactive budget for the sequence-stable update. The endpoint candidates
 * retain the NPVT baseline and maximum-anchor alternative; the 240-step guard
 * matches the production micro benchmark.
 */
export function interactiveStableNeighborhoodConfig(
  protectPathMax = false,
): StableNeighborhoodUpdateConfig {
  return {
    maxNodes: 48,
    anchorMixes: [0, 1],
    swapPasses: [8],
    adjacencyTolerance: 0,
    areaTolerance: 0.01,
    maxSteps: 240,
    ...(protectPathMax ? { protectedConstraints: ["constraintPathMax"] } : {}),
  };
}

export type LeafUpdateOptions = {
  seed: number;
  adaptationRate?: number;
  lloydRate?: number;
  stableNeighborhood?: StableNeighborhoodUpdateConfig | false;
  /** Skip the unstable first solver steps without waiting for convergence. */
  preRollWarm?: { steps: number; tolerance: number } | false;
};

export type LeafUpdateResult =
  | { strategy: "warm"; state: CapacityLayoutState }
  | {
      strategy: "stableNeighborhood";
      state: CapacityLayoutState;
      result: StableNeighborhoodResult;
    };

export type LeafUpdateStrategy = "cold" | LeafUpdateResult["strategy"];

export type StableGroupUpdate = Extract<LeafUpdateResult, { strategy: "stableNeighborhood" }>;

export type LeafUpdateSummary = Record<LeafUpdateStrategy, number>;

export type StableNeighborhoodExperimentSummary = {
  groups: number;
  baselineSelections: number;
  contractViolations: number;
  meanAdjacencyGain: number;
  meanDisplacementReduction: number;
  meanEligibleCandidates: number;
  meanWeightedSolves: number;
  meanTotalSteps: number;
};

export function summarizeLeafUpdateStrategies(
  strategies: Iterable<LeafUpdateStrategy>,
): LeafUpdateSummary {
  const summary: LeafUpdateSummary = { cold: 0, warm: 0, stableNeighborhood: 0 };
  for (const strategy of strategies) summary[strategy]++;
  return summary;
}

export function summarizeStableNeighborhoodExperiments(
  results: Iterable<StableNeighborhoodResult>,
): StableNeighborhoodExperimentSummary {
  const summary: StableNeighborhoodExperimentSummary = {
    groups: 0,
    baselineSelections: 0,
    contractViolations: 0,
    meanAdjacencyGain: 0,
    meanDisplacementReduction: 0,
    meanEligibleCandidates: 0,
    meanWeightedSolves: 0,
    meanTotalSteps: 0,
  };
  for (const result of results) {
    summary.groups++;
    if (result.selected.anchorMix === 0 && result.selected.swapPasses === 8) {
      summary.baselineSelections++;
    }
    const selectedConstraintScores = {
      adjacency: result.selected.adjacency,
      constraintDisconnectedRate: -result.selected.constraintDisconnectedRate,
      constraintPathMax: -result.selected.constraintPathMax,
    };
    const violatesFloor = Object.entries(result.minimumConstraints).some(
      ([name, floor]) =>
        selectedConstraintScores[name as keyof typeof selectedConstraintScores] + 1e-12 < floor,
    );
    if (violatesFloor || result.selected.displacement > result.baseline.displacement + 1e-12) {
      summary.contractViolations++;
    }
    summary.meanAdjacencyGain += result.selected.adjacency - result.baseline.adjacency;
    summary.meanDisplacementReduction +=
      result.baseline.displacement - result.selected.displacement;
    summary.meanEligibleCandidates += result.eligibleCandidates;
    summary.meanWeightedSolves += result.weightedSolves;
    summary.meanTotalSteps += result.totalSteps;
  }
  if (summary.groups > 0) {
    summary.meanAdjacencyGain /= summary.groups;
    summary.meanDisplacementReduction /= summary.groups;
    summary.meanEligibleCandidates /= summary.groups;
    summary.meanWeightedSolves /= summary.groups;
    summary.meanTotalSteps /= summary.groups;
  }
  return summary;
}

/** Deterministic signature of the data that can change a leaf layout. */
export function leafGraphKey(leaves: readonly AtlasNode[], edges: readonly AtlasEdge[]): string {
  const nodes = leaves
    .map((leaf) => [leaf.id, leaf.metrics.loc] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const graphEdges = edges
    .map(
      (edge) => `${edge.source}\0${edge.target}\0${edge.kind ?? ""}\0${String(edge.weight ?? 1)}`,
    )
    .sort();
  return JSON.stringify([nodes, graphEdges]);
}

export function neighborSiteHint(
  id: string,
  edges: readonly AtlasEdge[],
  siteOf: (id: string) => Vec2 | undefined,
): Vec2 | undefined {
  const neighbors: Array<{ point: Vec2; weight: number }> = [];
  for (const edge of edges) {
    const other = edge.source === id ? edge.target : edge.target === id ? edge.source : undefined;
    if (!other || other === id) continue;
    const site = siteOf(other);
    if (!site) continue;
    neighbors.push({ point: site, weight: 1 });
  }
  return weightedBarycenter(neighbors);
}

export function nodeInsertionHint(
  id: string,
  edges: readonly AtlasEdge[],
  siteOf: (id: string) => Vec2 | undefined,
): Vec2 | undefined {
  return siteOf(id) ?? neighborSiteHint(id, edges, siteOf);
}

/** Skip a bounded number of unstable solver steps without repainting them. */
export function preRollCapacityLayout(
  state: CapacityLayoutState,
  options: { steps: number; tolerance: number },
): CapacityLayoutState {
  let current = state;
  let steps = 0;
  const converged = () =>
    current.guidance
      ? isDeltaConverged(current, options.tolerance)
      : isConverged(current, options.tolerance);
  while (steps < options.steps && !converged()) {
    current = current.guidance ? deltaAwareStep(current) : capacityStep(current);
    steps++;
  }
  return current;
}

/**
 * Apply the sequence-stable feasible envelope to any hierarchy group.
 *
 * The research policy needs only the current graph and the previous sites of
 * surviving identities. Keeping this adapter independent from the leaf warm
 * solver lets boundary levels use the exact same candidate generator and
 * baseline-relative selector instead of approximating temporal stability with
 * hints.
 */
export function updateStableGroupLayout(
  previousCells: readonly Pick<CapacityLayoutState["cells"][number], "id" | "site">[],
  nodes: readonly AtlasNode[],
  edges: readonly AtlasEdge[],
  clip: ClipRegion,
  options: Omit<LeafUpdateOptions, "preRollWarm">,
): StableGroupUpdate | null {
  const stable = options.stableNeighborhood;
  const maxNodes = stable === false || stable === undefined ? 0 : (stable.maxNodes ?? 40);
  if (!stable || nodes.length < 2 || nodes.length > maxNodes) return null;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const anchors = new Map(
    previousCells.flatMap((cell) =>
      nodeIds.has(cell.id) ? [[cell.id, { ...cell.site }] as const] : [],
    ),
  );
  if (anchors.size === 0) return null;
  const { maxNodes: _, ...stableOptions } = stable;
  const result = stableNeighborhoodUpdate(
    nodes.map((node) => ({ id: node.id, weight: node.metrics.loc })),
    edges,
    clip,
    {
      ...stableOptions,
      seed: options.seed,
      anchors,
      adaptationRate: stable.adaptationRate ?? options.adaptationRate,
      lloydRate: stable.lloydRate ?? options.lloydRate,
    },
  );
  return result.selected.converged
    ? { strategy: "stableNeighborhood", state: result.state, result }
    : null;
}

/**
 * Update one existing innermost group. Stable neighborhood selection is the
 * bounded production policy; all unsupported or non-converged cases retain
 * the previous animated warm-update behavior.
 */
export function updateLeafLayout(
  existing: CapacityLayoutState,
  leaves: readonly AtlasNode[],
  edges: readonly AtlasEdge[],
  clip: ClipRegion,
  options: LeafUpdateOptions,
): LeafUpdateResult {
  const previousSiteOf = (id: string) => existing.cells.find((cell) => cell.id === id)?.site;
  const stableUpdate = updateStableGroupLayout(existing.cells, leaves, edges, clip, options);
  if (stableUpdate) return stableUpdate;

  const leafIds = new Set(leaves.map((leaf) => leaf.id));
  const warm = applyGraphChanges(existing, {
    clip,
    upsert: leaves.map((leaf) => ({
      id: leaf.id,
      weight: leaf.metrics.loc,
      hint: nodeInsertionHint(leaf.id, edges, previousSiteOf),
    })),
    remove: existing.cells.map((cell) => cell.id).filter((id) => !leafIds.has(id)),
    edges,
  });
  return {
    strategy: "warm",
    state: options.preRollWarm ? preRollCapacityLayout(warm, options.preRollWarm) : warm,
  };
}
