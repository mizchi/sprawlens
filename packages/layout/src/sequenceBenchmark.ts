import type { AtlasEdge } from "@sprawlens/contracts";
import {
  applyGraphChanges,
  capacityStep,
  isConverged,
  type CapacityLayoutState,
  type CellInputNode,
} from "./capacityLayout.ts";
import { clipScale, type ClipRegion } from "./clip.ts";
import {
  compareLayoutGeometry,
  constraintGraphDistance,
  distanceChangeFaithfulness,
  type ConstraintGraphDistanceMetrics,
  type TemporalGeometryMetrics,
} from "./layoutComparison.ts";
import { cellAdjacency, realizedEdgeRate } from "./neighborhood.ts";
import {
  computeMatchedNeighborhoodUpdate,
  stableNeighborhoodUpdate,
} from "./stableNeighborhood.ts";

export type LayoutSequenceGraph = {
  nodes: CellInputNode[];
  edges: AtlasEdge[];
};

export type SequenceBenchmarkOptions = {
  seed: number;
  clip?: ClipRegion;
  maxSteps?: number;
  stableAnchorMixPolicy?: StableAnchorMixPolicy;
};

export type StableAnchorMixPolicy = {
  /** Anchor mixes used when nodes or dependency edges are added or removed. */
  structural: readonly number[];
  /** Anchor mixes used for weight-only and unchanged transitions. */
  nonStructural: readonly number[];
};

const CONDITION_NAMES = [
  "neighborhoodSwap",
  "computeMatchedNeighborhood",
  "warmStart",
  "anchorOnly",
  "stableNeighborhood",
] as const;
type SequenceConditionName = (typeof CONDITION_NAMES)[number];

type SequenceMetrics = TemporalGeometryMetrics &
  ConstraintGraphDistanceMetrics & {
    siteDisplacement: number;
    distanceChangeFaithfulnessError: number;
    distanceChangePairCount: number;
    adjacency: number;
    converged: boolean;
  };

const DEFAULT_CLIP = { kind: "rect" as const, x: 0, y: 0, width: 1000, height: 700 };

const anchorsOf = (state: CapacityLayoutState) =>
  new Map(state.cells.map((cell) => [cell.id, cell.site] as const));

const siteDisplacement = (
  before: CapacityLayoutState,
  after: CapacityLayoutState,
  scale: number,
) => {
  const current = new Map(after.cells.map((cell) => [cell.id, cell.site] as const));
  let total = 0;
  let surviving = 0;
  for (const cell of before.cells) {
    const site = current.get(cell.id);
    if (!site) continue;
    total += Math.hypot(site.x - cell.site.x, site.y - cell.site.y) / Math.max(scale, 1e-12);
    surviving++;
  }
  return total / Math.max(1, surviving);
};

const measure = (
  before: CapacityLayoutState,
  after: CapacityLayoutState,
  beforeEdges: readonly AtlasEdge[],
  afterEdges: readonly AtlasEdge[],
  converged: boolean,
): SequenceMetrics => {
  const adjacency = cellAdjacency(after.cells);
  return {
    siteDisplacement: siteDisplacement(before, after, clipScale(after.clip)),
    ...compareLayoutGeometry(before.cells, after.cells, clipScale(after.clip)),
    ...distanceChangeFaithfulness(before.cells, after.cells, beforeEdges, afterEdges),
    adjacency: realizedEdgeRate(adjacency, afterEdges),
    ...constraintGraphDistance(adjacency, afterEdges),
    converged,
  };
};

const sumMetrics = (metrics: readonly SequenceMetrics[]) => ({
  siteDisplacement: metrics.reduce((sum, value) => sum + value.siteDisplacement, 0),
  centroidDisplacement: metrics.reduce((sum, value) => sum + value.centroidDisplacement, 0),
  boundaryDisplacement: metrics.reduce((sum, value) => sum + value.boundaryDisplacement, 0),
  polygonIoULoss: metrics.reduce((sum, value) => sum + value.polygonIoULoss, 0),
  relativeDirectionChange: metrics.reduce((sum, value) => sum + value.relativeDirectionChange, 0),
  distanceChangeFaithfulnessError: metrics.reduce(
    (sum, value) => sum + value.distanceChangeFaithfulnessError,
    0,
  ),
});

const warmUpdate = (state: CapacityLayoutState, graph: LayoutSequenceGraph, maxSteps: number) => {
  const ids = new Set(graph.nodes.map((node) => node.id));
  let current = applyGraphChanges(state, {
    upsert: graph.nodes,
    remove: state.cells.filter((cell) => !ids.has(cell.id)).map((cell) => cell.id),
    edges: graph.edges,
  });
  let steps = 0;
  while (steps < maxSteps && !isConverged(current, 0.01)) {
    current = capacityStep(current);
    steps++;
  }
  return { state: current, steps, converged: isConverged(current, 0.01) };
};

const directedEdgeKey = (edge: AtlasEdge) => `${edge.source}\0${edge.target}`;

export const describeLayoutGraphChange = (
  before: LayoutSequenceGraph,
  after: LayoutSequenceGraph,
) => {
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node.weight] as const));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node.weight] as const));
  const addedNodes = [...afterNodes.keys()].filter((id) => !beforeNodes.has(id)).length;
  const removedNodes = [...beforeNodes.keys()].filter((id) => !afterNodes.has(id)).length;
  const changedWeights = [...afterNodes].filter(
    ([id, weight]) => beforeNodes.has(id) && Math.abs(beforeNodes.get(id)! - weight) > 1e-12,
  ).length;
  const beforeEdges = new Set(before.edges.map(directedEdgeKey));
  const afterEdges = new Set(after.edges.map(directedEdgeKey));
  const addedEdges = [...afterEdges].filter((edge) => !beforeEdges.has(edge)).length;
  const removedEdges = [...beforeEdges].filter((edge) => !afterEdges.has(edge)).length;
  const nodeUnion = new Set([...beforeNodes.keys(), ...afterNodes.keys()]).size;
  const edgeUnion = new Set([...beforeEdges, ...afterEdges]).size;
  return {
    addedNodes,
    removedNodes,
    changedWeights,
    addedEdges,
    removedEdges,
    nodeJaccardDistance: (addedNodes + removedNodes) / Math.max(1, nodeUnion),
    edgeJaccardDistance: (addedEdges + removedEdges) / Math.max(1, edgeUnion),
    nodeChurn: addedNodes + removedNodes > 0,
    weightChange: changedWeights > 0,
    dependencyRewire: addedEdges + removedEdges > 0,
  };
};

export type LayoutGraphChange = ReturnType<typeof describeLayoutGraphChange>;

const validateAnchorMixPolicy = (policy: StableAnchorMixPolicy) => {
  for (const [kind, mixes] of Object.entries(policy)) {
    if (
      mixes.length === 0 ||
      mixes[0] !== 0 ||
      mixes.some((mix) => !Number.isFinite(mix) || mix < 0 || mix > 1)
    ) {
      throw new Error(`sequence ${kind} anchor mixes must start with 0 and stay between 0 and 1`);
    }
  }
};

/**
 * Branch three update policies from one initial layout, then let every policy
 * carry only its own previous state through the sequence.
 */
export function runStableNeighborhoodSequence(
  snapshots: readonly LayoutSequenceGraph[],
  options: SequenceBenchmarkOptions,
) {
  if (snapshots.length < 2) {
    throw new Error("stable neighborhood sequence requires at least two snapshots");
  }
  const clip = options.clip ?? DEFAULT_CLIP;
  const maxSteps = options.maxSteps ?? 800;
  if (options.stableAnchorMixPolicy) validateAnchorMixPolicy(options.stableAnchorMixPolicy);
  const initialGraph = snapshots[0]!;
  const initial = stableNeighborhoodUpdate(initialGraph.nodes, initialGraph.edges, clip, {
    seed: options.seed,
    anchorMixes: [0],
    maxSteps,
  }).baseline.state;
  const sharedInitialSites = initial.cells.map(
    (cell) => [cell.id, cell.site.x, cell.site.y] as const,
  );
  const initialCellSites: Record<
    SequenceConditionName,
    ReadonlyArray<readonly [string, number, number]>
  > = {
    neighborhoodSwap: sharedInitialSites,
    computeMatchedNeighborhood: sharedInitialSites,
    warmStart: sharedInitialSites,
    anchorOnly: sharedInitialSites,
    stableNeighborhood: sharedInitialSites,
  };
  let previous: Record<SequenceConditionName, CapacityLayoutState> = {
    neighborhoodSwap: initial,
    computeMatchedNeighborhood: initial,
    warmStart: initial,
    anchorOnly: initial,
    stableNeighborhood: initial,
  };
  const transitions = [] as Array<{
    index: number;
    change: LayoutGraphChange;
    baselineAdjacency: number;
    stableSelection: { candidateCount: number; weightedSolves: number; anchorMix: number };
    anchorOnlySelection: { weightedSolves: number; anchorMix: number; adjacency: number };
    warmStartSelection: { steps: number };
    computeMatchedSelection: {
      weightedSolves: number;
      requestedWeightedSolves: number;
      budgetMatched: boolean;
      variant: number;
    };
    conditions: Record<SequenceConditionName, SequenceMetrics>;
  }>;

  for (let index = 1; index < snapshots.length; index++) {
    const previousGraph = snapshots[index - 1]!;
    const graph = snapshots[index]!;
    const change = describeLayoutGraphChange(previousGraph, graph);
    const stableAnchorMixes = options.stableAnchorMixPolicy
      ? change.nodeChurn || change.dependencyRewire
        ? options.stableAnchorMixPolicy.structural
        : options.stableAnchorMixPolicy.nonStructural
      : undefined;
    const baseline = stableNeighborhoodUpdate(graph.nodes, graph.edges, clip, {
      seed: options.seed,
      anchorMixes: [0],
      maxSteps,
    });
    const stable = stableNeighborhoodUpdate(graph.nodes, graph.edges, clip, {
      seed: options.seed,
      anchors: anchorsOf(previous.stableNeighborhood),
      ...(stableAnchorMixes ? { anchorMixes: stableAnchorMixes } : {}),
      adjacencyTolerance: 0,
      maxSteps,
    });
    const anchorOnly = stableNeighborhoodUpdate(graph.nodes, graph.edges, clip, {
      seed: options.seed,
      anchors: anchorsOf(previous.anchorOnly),
      adjacencyTolerance: 1,
      maxSteps,
    });
    const warmStart = warmUpdate(previous.warmStart, graph, maxSteps);
    const computeMatched = computeMatchedNeighborhoodUpdate(graph.nodes, graph.edges, clip, {
      seed: options.seed,
      anchors: anchorsOf(previous.computeMatchedNeighborhood),
      weightedSolveBudget: stable.weightedSolves,
      adjacencyTolerance: 0,
      maxSteps,
    });
    const current = {
      neighborhoodSwap: baseline.state,
      computeMatchedNeighborhood: computeMatched.state,
      warmStart: warmStart.state,
      anchorOnly: anchorOnly.state,
      stableNeighborhood: stable.state,
    };
    transitions.push({
      index,
      change,
      baselineAdjacency: baseline.baseline.adjacency,
      stableSelection: {
        candidateCount: stable.candidates.length,
        weightedSolves: stable.weightedSolves,
        anchorMix: stable.selected.anchorMix,
      },
      anchorOnlySelection: {
        weightedSolves: anchorOnly.weightedSolves,
        anchorMix: anchorOnly.selected.anchorMix,
        adjacency: anchorOnly.selected.adjacency,
      },
      warmStartSelection: { steps: warmStart.steps },
      computeMatchedSelection: {
        weightedSolves: computeMatched.weightedSolves,
        requestedWeightedSolves: computeMatched.requestedWeightedSolves,
        budgetMatched: computeMatched.budgetMatched,
        variant: computeMatched.selected.variant,
      },
      conditions: {
        neighborhoodSwap: measure(
          previous.neighborhoodSwap,
          current.neighborhoodSwap,
          previousGraph.edges,
          graph.edges,
          baseline.selected.converged,
        ),
        computeMatchedNeighborhood: measure(
          previous.computeMatchedNeighborhood,
          current.computeMatchedNeighborhood,
          previousGraph.edges,
          graph.edges,
          computeMatched.selected.converged,
        ),
        warmStart: measure(
          previous.warmStart,
          current.warmStart,
          previousGraph.edges,
          graph.edges,
          warmStart.converged,
        ),
        anchorOnly: measure(
          previous.anchorOnly,
          current.anchorOnly,
          previousGraph.edges,
          graph.edges,
          anchorOnly.selected.converged,
        ),
        stableNeighborhood: measure(
          previous.stableNeighborhood,
          current.stableNeighborhood,
          previousGraph.edges,
          graph.edges,
          stable.selected.converged,
        ),
      },
    });
    previous = current;
  }

  const summary = Object.fromEntries(
    CONDITION_NAMES.map((condition) => {
      const values = transitions.map((transition) => transition.conditions[condition]);
      const cumulative = sumMetrics(values);
      return [
        condition,
        {
          cumulative,
          mean: Object.fromEntries(
            Object.entries(cumulative).map(([metric, value]) => [
              metric,
              value / transitions.length,
            ]),
          ),
          initialToFinal: {
            siteDisplacement: siteDisplacement(initial, previous[condition], clipScale(clip)),
            ...compareLayoutGeometry(initial.cells, previous[condition].cells, clipScale(clip)),
            ...distanceChangeFaithfulness(
              initial.cells,
              previous[condition].cells,
              initialGraph.edges,
              snapshots.at(-1)!.edges,
            ),
          },
          meanAdjacency: values.reduce((sum, value) => sum + value.adjacency, 0) / values.length,
          minimumAdjacency: Math.min(...values.map((value) => value.adjacency)),
          finalAdjacency: transitions.at(-1)!.conditions[condition].adjacency,
          nonconvergedTransitions: values.filter((value) => !value.converged).length,
        },
      ];
    }),
  ) as Record<
    SequenceConditionName,
    {
      cumulative: ReturnType<typeof sumMetrics>;
      mean: Record<keyof ReturnType<typeof sumMetrics>, number>;
      initialToFinal: TemporalGeometryMetrics & {
        siteDisplacement: number;
        distanceChangeFaithfulnessError: number;
        distanceChangePairCount: number;
      };
      meanAdjacency: number;
      minimumAdjacency: number;
      finalAdjacency: number;
      nonconvergedTransitions: number;
    }
  >;
  const matchedTransitions = transitions.filter(
    (transition) => transition.computeMatchedSelection.budgetMatched,
  ).length;
  return {
    schemaVersion: 4 as const,
    configuration: {
      stableAnchorMixPolicy: options.stableAnchorMixPolicy ?? null,
    },
    seed: options.seed,
    snapshots: snapshots.length,
    initialCellSites,
    transitions,
    budget: {
      matchedTransitions,
      shortfallTransitions: transitions.length - matchedTransitions,
    },
    adjacencyFloorViolations: transitions.filter(
      (transition) =>
        transition.conditions.stableNeighborhood.adjacency + 1e-12 < transition.baselineAdjacency,
    ).length,
    summary,
  };
}
