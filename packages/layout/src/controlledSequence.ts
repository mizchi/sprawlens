import { clipScale } from "./clip.ts";
import {
  compareLayoutGeometry,
  compareSameEndpointBoundaryHausdorffInterval,
  requireSameEndpointGeometryDomain,
  type ComparableCell,
  type SameEndpointBoundaryHausdorffInterval,
  type TemporalGeometryMetrics,
} from "./layoutComparison.ts";
import {
  DEFAULT_SEQUENCE_CLIP,
  runStableNeighborhoodSequence,
  SEQUENCE_CONDITION_NAMES,
  type LayoutSequenceGraph,
  type SequenceBenchmarkOptions,
  type SequenceConditionName,
} from "./sequenceBenchmark.ts";

export type ControlledSequenceProbe = {
  noOp: readonly [LayoutSequenceGraph, LayoutSequenceGraph, LayoutSequenceGraph];
  weightReversal: readonly [LayoutSequenceGraph, LayoutSequenceGraph, LayoutSequenceGraph];
  rewireReversal: readonly [LayoutSequenceGraph, LayoutSequenceGraph, LayoutSequenceGraph];
  combinedReversal: readonly [LayoutSequenceGraph, LayoutSequenceGraph, LayoutSequenceGraph];
  orderAB: readonly [LayoutSequenceGraph, LayoutSequenceGraph, LayoutSequenceGraph];
  orderBA: readonly [LayoutSequenceGraph, LayoutSequenceGraph, LayoutSequenceGraph];
};

export const CONTROLLED_RECOVERY_NAMES = ["noOp", "weight", "rewire", "combined"] as const;
export type ControlledRecoveryName = (typeof CONTROLLED_RECOVERY_NAMES)[number];
export const CONTROLLED_REPEATABILITY_PATH_NAMES = [
  ...CONTROLLED_RECOVERY_NAMES,
  "orderAB",
  "orderBA",
] as const;
export type ControlledRepeatabilityPathName = (typeof CONTROLLED_REPEATABILITY_PATH_NAMES)[number];
export type ControlledSequenceProbeOptions = SequenceBenchmarkOptions & {
  /** Execute each controlled path a second time with the same declared inputs. */
  captureRepeatability?: boolean;
};

const cloneGraph = (graph: LayoutSequenceGraph): LayoutSequenceGraph => ({
  nodes: graph.nodes.map((node) => ({ ...node, hint: node.hint ? { ...node.hint } : undefined })),
  edges: graph.edges.map((edge) => ({ ...edge })),
});

const edgeKey = (source: string, target: string) => `${source}\0${target}`;

/**
 * Build commuting changes from input structure only: A changes one weight and
 * B rewires one dependency among persistent nodes. Both orders end at the exact
 * same graph, while the reversal returns to the exact starting graph.
 */
export function buildControlledSequenceProbe(graph: LayoutSequenceGraph): ControlledSequenceProbe {
  if (graph.nodes.length < 3) throw new Error("controlled probe requires at least three nodes");
  if (graph.edges.length === 0) throw new Error("controlled probe requires at least one edge");
  const ids = graph.nodes.map(({ id }) => id).sort((left, right) => left.localeCompare(right));
  const weightedId = ids[0]!;
  const changedWeight = (input: LayoutSequenceGraph): LayoutSequenceGraph => ({
    nodes: input.nodes.map((node) =>
      node.id === weightedId ? { ...node, weight: Math.max(1, node.weight * 1.5) } : { ...node },
    ),
    edges: input.edges.map((edge) => ({ ...edge })),
  });
  const existing = new Set(graph.edges.map((edge) => edgeKey(edge.source, edge.target)));
  const selected = [...graph.edges]
    .sort((left, right) =>
      edgeKey(left.source, left.target).localeCompare(edgeKey(right.source, right.target)),
    )
    .flatMap((edge) => {
      const target = ids.find(
        (id) => id !== edge.source && id !== edge.target && !existing.has(edgeKey(edge.source, id)),
      );
      return target ? [{ edge, target }] : [];
    })[0];
  if (!selected) throw new Error("controlled probe could not construct an independent rewire");
  const rewired = (input: LayoutSequenceGraph): LayoutSequenceGraph => ({
    nodes: input.nodes.map((node) => ({ ...node })),
    edges: input.edges.map((edge) =>
      edge.source === selected.edge.source && edge.target === selected.edge.target
        ? { source: edge.source, target: selected.target }
        : { ...edge },
    ),
  });
  const base = cloneGraph(graph);
  const afterA = changedWeight(base);
  const afterB = rewired(base);
  const final = rewired(afterA);
  return {
    noOp: [cloneGraph(base), cloneGraph(base), cloneGraph(base)],
    weightReversal: [cloneGraph(base), cloneGraph(afterA), cloneGraph(base)],
    rewireReversal: [cloneGraph(base), cloneGraph(afterB), cloneGraph(base)],
    combinedReversal: [cloneGraph(base), cloneGraph(final), cloneGraph(base)],
    orderAB: [cloneGraph(base), afterA, cloneGraph(final)],
    orderBA: [cloneGraph(base), afterB, cloneGraph(final)],
  };
}

type ControlledGeometryMetrics = TemporalGeometryMetrics & {
  siteDisplacement: number;
  boundaryHausdorffInterval: SameEndpointBoundaryHausdorffInterval;
};

const compareFinal = (
  before: readonly ComparableCell[],
  after: readonly ComparableCell[],
  scale: number,
): ControlledGeometryMetrics => {
  const pairs = requireSameEndpointGeometryDomain(before, after);
  const siteDisplacements = pairs.map(
    (pair) =>
      Math.hypot(pair.after.site.x - pair.before.site.x, pair.after.site.y - pair.before.site.y) /
      scale,
  );
  return {
    siteDisplacement:
      siteDisplacements.reduce((sum, displacement) => sum + displacement, 0) /
      Math.max(1, siteDisplacements.length),
    ...compareLayoutGeometry(before, after, scale),
    boundaryHausdorffInterval: compareSameEndpointBoundaryHausdorffInterval(before, after, scale),
  };
};

/** Measure true recovery error and order-induced path dependence. */
export function runControlledSequenceProbe(
  probe: ControlledSequenceProbe,
  options: ControlledSequenceProbeOptions,
) {
  const captureOptions = {
    ...options,
    captureFinalGeometry: true,
    captureInitialGeometry: true,
  };
  const executePaths = () => ({
    noOp: runStableNeighborhoodSequence(probe.noOp, captureOptions),
    weight: runStableNeighborhoodSequence(probe.weightReversal, captureOptions),
    rewire: runStableNeighborhoodSequence(probe.rewireReversal, captureOptions),
    combined: runStableNeighborhoodSequence(probe.combinedReversal, captureOptions),
    orderAB: runStableNeighborhoodSequence(probe.orderAB, captureOptions),
    orderBA: runStableNeighborhoodSequence(probe.orderBA, captureOptions),
  });
  const primaryRuns = executePaths();
  const repeatRuns = options.captureRepeatability ? executePaths() : null;
  const comparePathFinals = (
    left: (typeof primaryRuns)[ControlledRepeatabilityPathName],
    right: (typeof primaryRuns)[ControlledRepeatabilityPathName],
  ) =>
    Object.fromEntries(
      SEQUENCE_CONDITION_NAMES.map((condition) => [
        condition,
        compareFinal(
          left.finalCellGeometry![condition],
          right.finalCellGeometry![condition],
          clipScale(options.clip ?? DEFAULT_SEQUENCE_CLIP),
        ),
      ]),
    ) as Record<SequenceConditionName, ControlledGeometryMetrics>;
  const repeatability = repeatRuns
    ? (Object.fromEntries(
        CONTROLLED_REPEATABILITY_PATH_NAMES.map((path) => [
          path,
          comparePathFinals(primaryRuns[path], repeatRuns[path]),
        ]),
      ) as Record<
        ControlledRepeatabilityPathName,
        Record<SequenceConditionName, ControlledGeometryMetrics>
      >)
    : null;
  const recoveryRuns = {
    noOp: primaryRuns.noOp,
    weight: primaryRuns.weight,
    rewire: primaryRuns.rewire,
    combined: primaryRuns.combined,
  };
  const orderAB = primaryRuns.orderAB;
  const orderBA = primaryRuns.orderBA;
  const scale = clipScale(options.clip ?? DEFAULT_SEQUENCE_CLIP);
  const finalAB = orderAB.finalCellGeometry!;
  const finalBA = orderBA.finalCellGeometry!;
  const pathDependence = Object.fromEntries(
    SEQUENCE_CONDITION_NAMES.map((condition) => [
      condition,
      compareFinal(finalAB[condition], finalBA[condition], scale),
    ]),
  ) as Record<SequenceConditionName, ControlledGeometryMetrics>;
  const recovery = Object.fromEntries(
    CONTROLLED_RECOVERY_NAMES.map((name) => [
      name,
      Object.fromEntries(
        SEQUENCE_CONDITION_NAMES.map((condition) => [
          condition,
          {
            ...recoveryRuns[name].summary[condition].initialToFinal,
            boundaryHausdorffInterval: compareSameEndpointBoundaryHausdorffInterval(
              recoveryRuns[name].initialCellGeometry![condition],
              recoveryRuns[name].finalCellGeometry![condition],
              scale,
            ),
          },
        ]),
      ),
    ]),
  ) as Record<
    ControlledRecoveryName,
    Record<
      SequenceConditionName,
      (typeof recoveryRuns)[ControlledRecoveryName]["summary"][SequenceConditionName]["initialToFinal"] & {
        boundaryHausdorffInterval: SameEndpointBoundaryHausdorffInterval;
      }
    >
  >;
  const allRuns = [...Object.values(primaryRuns), ...(repeatRuns ? Object.values(repeatRuns) : [])];
  return {
    schemaVersion: 4 as const,
    seed: options.seed,
    recovery,
    pathDependence,
    repeatability,
    floorViolations: allRuns.reduce((sum, run) => sum + run.adjacencyFloorViolations, 0),
    budgetShortfalls: allRuns.reduce((sum, run) => sum + run.budget.shortfallTransitions, 0),
  };
}
