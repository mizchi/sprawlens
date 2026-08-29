import type { AtlasEdge } from "@sprawlens/contracts";
import type { CapacityLayoutState, CellInputNode } from "./capacityLayout.ts";
import { clipScale, type ClipRegion } from "./clip.ts";
import {
  compareLayoutGeometry,
  constraintGraphDistance,
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
};

const CONDITION_NAMES = [
  "neighborhoodSwap",
  "computeMatchedNeighborhood",
  "stableNeighborhood",
] as const;
type SequenceConditionName = (typeof CONDITION_NAMES)[number];

type SequenceMetrics = TemporalGeometryMetrics &
  ConstraintGraphDistanceMetrics & {
    siteDisplacement: number;
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
  edges: readonly AtlasEdge[],
  converged: boolean,
): SequenceMetrics => {
  const adjacency = cellAdjacency(after.cells);
  return {
    siteDisplacement: siteDisplacement(before, after, clipScale(after.clip)),
    ...compareLayoutGeometry(before.cells, after.cells, clipScale(after.clip)),
    adjacency: realizedEdgeRate(adjacency, edges),
    ...constraintGraphDistance(adjacency, edges),
    converged,
  };
};

const sumMetrics = (metrics: readonly SequenceMetrics[]) => ({
  siteDisplacement: metrics.reduce((sum, value) => sum + value.siteDisplacement, 0),
  centroidDisplacement: metrics.reduce((sum, value) => sum + value.centroidDisplacement, 0),
  polygonIoULoss: metrics.reduce((sum, value) => sum + value.polygonIoULoss, 0),
  relativeDirectionChange: metrics.reduce((sum, value) => sum + value.relativeDirectionChange, 0),
});

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
    stableNeighborhood: sharedInitialSites,
  };
  let previous: Record<SequenceConditionName, CapacityLayoutState> = {
    neighborhoodSwap: initial,
    computeMatchedNeighborhood: initial,
    stableNeighborhood: initial,
  };
  const transitions = [] as Array<{
    index: number;
    baselineAdjacency: number;
    stableSelection: { weightedSolves: number; anchorMix: number };
    computeMatchedSelection: {
      weightedSolves: number;
      requestedWeightedSolves: number;
      budgetMatched: boolean;
      variant: number;
    };
    conditions: Record<SequenceConditionName, SequenceMetrics>;
  }>;

  for (let index = 1; index < snapshots.length; index++) {
    const graph = snapshots[index]!;
    const baseline = stableNeighborhoodUpdate(graph.nodes, graph.edges, clip, {
      seed: options.seed,
      anchorMixes: [0],
      maxSteps,
    });
    const stable = stableNeighborhoodUpdate(graph.nodes, graph.edges, clip, {
      seed: options.seed,
      anchors: anchorsOf(previous.stableNeighborhood),
      adjacencyTolerance: 0,
      maxSteps,
    });
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
      stableNeighborhood: stable.state,
    };
    transitions.push({
      index,
      baselineAdjacency: baseline.baseline.adjacency,
      stableSelection: {
        weightedSolves: stable.weightedSolves,
        anchorMix: stable.selected.anchorMix,
      },
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
          graph.edges,
          baseline.selected.converged,
        ),
        computeMatchedNeighborhood: measure(
          previous.computeMatchedNeighborhood,
          current.computeMatchedNeighborhood,
          graph.edges,
          computeMatched.selected.converged,
        ),
        stableNeighborhood: measure(
          previous.stableNeighborhood,
          current.stableNeighborhood,
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
          },
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
      initialToFinal: TemporalGeometryMetrics & { siteDisplacement: number };
      finalAdjacency: number;
      nonconvergedTransitions: number;
    }
  >;
  const matchedTransitions = transitions.filter(
    (transition) => transition.computeMatchedSelection.budgetMatched,
  ).length;
  return {
    schemaVersion: 1 as const,
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
