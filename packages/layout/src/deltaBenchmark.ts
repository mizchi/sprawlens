import type { AtlasEdge, AtlasGraph } from "@sprawlens/contracts";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
  type CellInputNode,
  type GraphChanges,
} from "./capacityLayout.ts";
import { clipScale } from "./clip.ts";
import { attachDeltaGuidance, deltaAwareStep, isDeltaConverged } from "./deltaLayout.ts";
import type { DeltaGuidanceOptions } from "./deltaTypes.ts";
import { compareLayoutGeometry, constraintGraphDistance } from "./layoutComparison.ts";
import { cellAdjacency, realizedEdgeRate } from "./neighborhood.ts";
import {
  computeMatchedNeighborhoodUpdate,
  stableNeighborhoodUpdate,
} from "./stableNeighborhood.ts";
import { squarify } from "./squarify.ts";

type BenchmarkGraph = { nodes: CellInputNode[]; edges: AtlasEdge[] };
export type DeltaBenchmarkCase = {
  name: string;
  before: BenchmarkGraph;
  after: BenchmarkGraph;
  changedIds: Set<string>;
};
type GraphPair = { name: string; before: AtlasGraph; after: AtlasGraph };
type CaseOptions = {
  groupOf?: (id: string) => string;
  minNodes?: number;
  maxNodes?: number;
};
type BenchmarkOptions = {
  seeds?: readonly number[];
  cases?: readonly DeltaBenchmarkCase[];
  stableSwapPasses?: readonly number[];
};
type Metrics = {
  maxAreaError: number;
  meanAreaError: number;
  adjacency: number;
  edgeLength: number;
  displacement: number;
  centroidDisplacement: number;
  polygonIoULoss: number;
  relativeDirectionChange: number;
  constraintPathMedian: number;
  constraintPathMax: number;
  constraintDisconnectedRate: number;
  constraintEdgeCount: number;
  objective: number;
  steps: number;
};
type TrialMetrics = Metrics & { converged: boolean };
type MetricName = keyof Metrics;
const CONDITIONS = [
  "squarified",
  "cold",
  "warm",
  "neighborhoodSwap",
  "stableNeighborhood",
  "computeMatchedNeighborhood",
  "adjacencyOnly",
  "stabilityOnly",
  "guided",
] as const;
type ConditionName = (typeof CONDITIONS)[number];
type Trial = {
  seed: number;
  conditions: Record<ConditionName, TrialMetrics>;
  stableSelection: {
    anchorMix: number;
    candidateCount: number;
    weightedSolves: number;
    eligibleCandidates: number;
    swapPasses: number;
    baselineAdjacency: number;
    minimumAdjacency: number;
  };
  computeMatchedSelection: {
    variant: number;
    candidateCount: number;
    weightedSolves: number;
    requestedWeightedSolves: number;
    budgetMatched: boolean;
    eligibleCandidates: number;
    baselineAdjacency: number;
    minimumAdjacency: number;
  };
};

const CLIP = { kind: "rect" as const, x: 0, y: 0, width: 1000, height: 700 };
const DEFAULT_SEEDS = [3, 7, 11, 17, 29] as const;
const DEFAULT_STABLE_SWAP_PASSES = [8] as const;
const AREA_TOLERANCE = 0.01;
const MAX_BASE_STEPS = 800;
// Guidance starts only after the capacity melt reaches activationAreaError;
// leave enough total steps for both that melt and maxGuidedSteps afterward.
const MAX_DELTA_STEPS = 800;
const METRICS: readonly MetricName[] = [
  "maxAreaError",
  "meanAreaError",
  "adjacency",
  "edgeLength",
  "displacement",
  "centroidDisplacement",
  "polygonIoULoss",
  "relativeDirectionChange",
  "constraintPathMedian",
  "constraintPathMax",
  "constraintDisconnectedRate",
  "constraintEdgeCount",
  "objective",
  "steps",
];
const GUIDANCE: DeltaGuidanceOptions = {
  dependencyRate: 0.16,
  areaWeight: 1,
  adjacencyWeight: 2,
  stabilityWeight: 0.7,
  proximityWeight: 0.18,
  minGuidedSteps: 24,
  maxGuidedSteps: 160,
};
type Geometry = {
  cells: Array<Pick<CellResult, "id" | "site" | "polygon" | "targetArea" | "actualArea">>;
  adjacency: Map<string, Set<string>>;
  steps: number;
  converged: boolean;
};

const edgeKey = (edge: AtlasEdge): string => `${edge.source}\0${edge.target}`;

function graphChanges(input: DeltaBenchmarkCase): GraphChanges {
  const before = new Map(input.before.nodes.map((node) => [node.id, node]));
  const after = new Map(input.after.nodes.map((node) => [node.id, node]));
  return {
    upsert: input.after.nodes.filter(
      (node) => !before.has(node.id) || before.get(node.id)!.weight !== node.weight,
    ),
    remove: input.before.nodes.filter((node) => !after.has(node.id)).map((node) => node.id),
    edges: input.after.edges,
  };
}

/** Convert consecutive repository graphs into changed, bounded layout groups. */
export function deltaBenchmarkCasesFromGraphPairs(
  pairs: readonly GraphPair[],
  options: CaseOptions = {},
): DeltaBenchmarkCase[] {
  return buildDeltaBenchmarkCorpus(pairs, options).cases;
}

/** Same conversion plus explicit exclusion accounting for artifact reports. */
export function buildDeltaBenchmarkCorpus(pairs: readonly GraphPair[], options: CaseOptions = {}) {
  const groupOf = options.groupOf ?? (() => "all");
  const minNodes = options.minNodes ?? 3;
  const maxNodes = options.maxNodes ?? 80;
  const cases: DeltaBenchmarkCase[] = [];
  const excluded = { tooSmall: 0, tooLarge: 0, unchanged: 0 };
  let candidateGroups = 0;
  for (const pair of pairs) {
    const beforeGroup = new Map(pair.before.nodes.map((node) => [node.id, groupOf(node.id)]));
    const afterGroup = new Map(pair.after.nodes.map((node) => [node.id, groupOf(node.id)]));
    const groups = new Set([...beforeGroup.values(), ...afterGroup.values()]);
    for (const group of [...groups].sort()) {
      candidateGroups++;
      const beforeNodes = pair.before.nodes.filter((node) => beforeGroup.get(node.id) === group);
      const afterNodes = pair.after.nodes.filter((node) => afterGroup.get(node.id) === group);
      if (beforeNodes.length < minNodes || afterNodes.length < minNodes) {
        excluded.tooSmall++;
        continue;
      }
      if (beforeNodes.length > maxNodes || afterNodes.length > maxNodes) {
        excluded.tooLarge++;
        continue;
      }
      const beforeIds = new Set(beforeNodes.map((node) => node.id));
      const afterIds = new Set(afterNodes.map((node) => node.id));
      const beforeEdges = pair.before.edges.filter(
        (edge) => beforeIds.has(edge.source) && beforeIds.has(edge.target),
      );
      const afterEdges = pair.after.edges.filter(
        (edge) => afterIds.has(edge.source) && afterIds.has(edge.target),
      );
      const beforeById = new Map(beforeNodes.map((node) => [node.id, node]));
      const afterById = new Map(afterNodes.map((node) => [node.id, node]));
      const changedIds = new Set<string>();
      for (const node of afterNodes) {
        const previous = beforeById.get(node.id);
        if (!previous || previous.metrics.loc !== node.metrics.loc) changedIds.add(node.id);
      }
      for (const node of beforeNodes) if (!afterById.has(node.id)) changedIds.add(node.id);
      const beforeEdgeKeys = new Set(beforeEdges.map(edgeKey));
      const afterEdgeKeys = new Set(afterEdges.map(edgeKey));
      for (const edge of beforeEdges) {
        if (afterEdgeKeys.has(edgeKey(edge))) continue;
        changedIds.add(edge.source);
        changedIds.add(edge.target);
      }
      for (const edge of afterEdges) {
        if (beforeEdgeKeys.has(edgeKey(edge))) continue;
        changedIds.add(edge.source);
        changedIds.add(edge.target);
      }
      if (changedIds.size === 0) {
        excluded.unchanged++;
        continue;
      }
      cases.push({
        name: `${pair.name}:${group}`,
        before: {
          nodes: beforeNodes.map((node) => ({ id: node.id, weight: node.metrics.loc })),
          edges: beforeEdges,
        },
        after: {
          nodes: afterNodes.map((node) => ({ id: node.id, weight: node.metrics.loc })),
          edges: afterEdges,
        },
        changedIds,
      });
    }
  }
  return {
    cases,
    selection: { minNodes, maxNodes, candidateGroups, included: cases.length, excluded },
  };
}

const gridNodes = (count: number): CellInputNode[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    weight: 1 + (i % 3),
  }));
const chainEdges = (count: number): AtlasEdge[] =>
  Array.from({ length: count - 1 }, (_, i) => ({ source: `n${i}`, target: `n${i + 1}` }));

function syntheticCases(): DeltaBenchmarkCase[] {
  const weightNodes = gridNodes(10);
  const weightEdges = chainEdges(weightNodes.length);
  const rewireNodes: CellInputNode[] = [
    { id: "a", weight: 1 },
    { id: "b", weight: 1 },
    { id: "c", weight: 1 },
    { id: "d", weight: 1 },
    { id: "e", weight: 1 },
    { id: "f", weight: 1 },
  ];
  const rewireEdges: AtlasEdge[] = [
    { source: "a", target: "f" },
    { source: "c", target: "d" },
    { source: "a", target: "d" },
    { source: "c", target: "f" },
  ];
  const bridgeNodes = gridNodes(9);
  const bridgeEdges = chainEdges(bridgeNodes.length);
  const bridgeFinalEdges = [
    ...bridgeEdges.filter((edge) => !(edge.source === "n3" && edge.target === "n4")),
    { source: "n3", target: "bridge" },
    { source: "bridge", target: "n4" },
  ];
  return [
    {
      name: "weight-shift",
      before: { nodes: weightNodes, edges: weightEdges },
      after: {
        nodes: weightNodes.map((node) => (node.id === "n0" ? { ...node, weight: 9 } : node)),
        edges: weightEdges,
      },
      changedIds: new Set(["n0"]),
    },
    {
      name: "dependency-rewire",
      before: { nodes: rewireNodes, edges: [] },
      after: { nodes: rewireNodes, edges: rewireEdges },
      changedIds: new Set(rewireEdges.flatMap((edge) => [edge.source, edge.target])),
    },
    {
      name: "bridge-insertion",
      before: { nodes: bridgeNodes, edges: bridgeEdges },
      after: {
        nodes: [...bridgeNodes, { id: "bridge", weight: 2 }],
        edges: bridgeFinalEdges,
      },
      changedIds: new Set(["bridge", "n3", "n4"]),
    },
  ];
}

function settleBase(state: CapacityLayoutState): CapacityLayoutState {
  let current = state;
  for (let i = 0; i < MAX_BASE_STEPS && !isConverged(current, AREA_TOLERANCE); i++) {
    current = capacityStep(current);
  }
  return current;
}
function settleVanilla(
  state: CapacityLayoutState,
  maxSteps = MAX_DELTA_STEPS,
): { state: CapacityLayoutState; steps: number } {
  let current: CapacityLayoutState = { ...state, guidance: undefined };
  let steps = 0;
  while (steps < maxSteps && !isConverged(current, AREA_TOLERANCE)) {
    current = capacityStep(current);
    steps++;
  }
  return { state: current, steps };
}
function settleGuided(state: CapacityLayoutState): { state: CapacityLayoutState; steps: number } {
  let current = state;
  let steps = 0;
  while (steps < MAX_DELTA_STEPS && !isDeltaConverged(current, AREA_TOLERANCE)) {
    current = deltaAwareStep(current);
    steps++;
  }
  return { state: current, steps };
}
const powerGeometry = (
  result: { state: CapacityLayoutState; steps: number },
  converged: boolean,
): Geometry => ({
  cells: result.state.cells,
  adjacency: cellAdjacency(result.state.cells),
  steps: result.steps,
  converged,
});

const rectanglesTouch = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean => {
  const epsilon = 1e-7;
  const overlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(a1, b1) - Math.max(a0, b0) > epsilon;
  const vertical =
    (Math.abs(a.x + a.w - b.x) < epsilon || Math.abs(b.x + b.w - a.x) < epsilon) &&
    overlap(a.y, a.y + a.h, b.y, b.y + b.h);
  const horizontal =
    (Math.abs(a.y + a.h - b.y) < epsilon || Math.abs(b.y + b.h - a.y) < epsilon) &&
    overlap(a.x, a.x + a.w, b.x, b.x + b.w);
  return vertical || horizontal;
};

function squarifiedGeometry(nodes: readonly CellInputNode[]): Geometry {
  const tiles = squarify(nodes, { x: 0, y: 0, w: CLIP.width, h: CLIP.height });
  const totalWeight = nodes.reduce((sum, node) => sum + Math.max(node.weight, 0), 0);
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()] as const));
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i]!;
      const b = tiles[j]!;
      if (!rectanglesTouch(a, b)) continue;
      adjacency.get(a.item.id)!.add(b.item.id);
      adjacency.get(b.item.id)!.add(a.item.id);
    }
  }
  return {
    cells: tiles.map((tile) => ({
      id: tile.item.id,
      site: { x: tile.x + tile.w / 2, y: tile.y + tile.h / 2 },
      polygon: [
        { x: tile.x, y: tile.y },
        { x: tile.x + tile.w, y: tile.y },
        { x: tile.x + tile.w, y: tile.y + tile.h },
        { x: tile.x, y: tile.y + tile.h },
      ],
      targetArea: (CLIP.width * CLIP.height * Math.max(tile.item.weight, 0)) / totalWeight,
      actualArea: tile.w * tile.h,
    })),
    adjacency,
    steps: 0,
    converged: tiles.length === nodes.length,
  };
}

function metrics(
  geometry: Geometry,
  edges: readonly AtlasEdge[],
  previous: Geometry,
): TrialMetrics {
  let meanAreaError = 0;
  let maxAreaError = 0;
  const siteOf = new Map(geometry.cells.map((cell) => [cell.id, cell.site] as const));
  for (const cell of geometry.cells) {
    const error = Math.abs(cell.actualArea - cell.targetArea) / Math.max(cell.targetArea, 1e-12);
    meanAreaError += error;
    maxAreaError = Math.max(maxAreaError, error);
  }
  meanAreaError /= Math.max(1, geometry.cells.length);
  const adjacency = realizedEdgeRate(geometry.adjacency, edges);
  const scale = clipScale(CLIP);
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
  let displacement = 0;
  let surviving = 0;
  for (const cell of previous.cells) {
    const site = siteOf.get(cell.id);
    if (!site) continue;
    displacement += Math.hypot(site.x - cell.site.x, site.y - cell.site.y) / scale;
    surviving++;
  }
  displacement /= Math.max(1, surviving);
  const temporal = compareLayoutGeometry(previous.cells, geometry.cells, scale);
  const topology = constraintGraphDistance(geometry.adjacency, edges);
  const objective =
    meanAreaError +
    2 * (1 - adjacency + (GUIDANCE.proximityWeight ?? 0.18) * edgeLength) +
    0.7 * displacement;
  return {
    maxAreaError,
    meanAreaError,
    adjacency,
    edgeLength,
    displacement,
    ...temporal,
    ...topology,
    objective,
    steps: geometry.steps,
    converged: geometry.converged,
  };
}

function runTrial(
  input: DeltaBenchmarkCase,
  seed: number,
  stableSwapPasses: readonly number[],
): Trial {
  const before = settleBase(
    createCapacityLayout(input.before.nodes, CLIP, { seed, lloydRate: 0.25 }),
  );
  const anchors = new Map(before.cells.map((cell) => [cell.id, cell.site] as const));
  const squarifiedBefore = squarifiedGeometry(input.before.nodes);
  const squarifiedAfter = squarifiedGeometry(input.after.nodes);
  const beforeGeometry = powerGeometry({ state: before, steps: 0 }, true);
  const neighborhoodBefore = stableNeighborhoodUpdate(
    input.before.nodes,
    input.before.edges,
    CLIP,
    { seed, anchorMixes: [0], maxSteps: MAX_BASE_STEPS },
  );
  const neighborhoodAnchors = new Map(
    neighborhoodBefore.baseline.state.cells.map((cell) => [cell.id, cell.site] as const),
  );
  const neighborhoodBeforeGeometry = powerGeometry(
    { state: neighborhoodBefore.baseline.state, steps: neighborhoodBefore.baseline.steps },
    neighborhoodBefore.baseline.converged,
  );
  const neighborhoodAfter = stableNeighborhoodUpdate(input.after.nodes, input.after.edges, CLIP, {
    seed,
    anchors: neighborhoodAnchors,
    adjacencyTolerance: 0,
    swapPasses: stableSwapPasses,
    maxSteps: MAX_BASE_STEPS,
  });
  const computeMatchedAfter = computeMatchedNeighborhoodUpdate(
    input.after.nodes,
    input.after.edges,
    CLIP,
    {
      seed,
      anchors: neighborhoodAnchors,
      weightedSolveBudget: neighborhoodAfter.weightedSolves,
      adjacencyTolerance: 0,
      maxSteps: MAX_BASE_STEPS,
    },
  );
  const warmStart = applyGraphChanges(before, graphChanges(input));
  const cold = settleVanilla(
    createCapacityLayout(input.after.nodes, CLIP, { seed, lloydRate: 0.25 }),
    MAX_BASE_STEPS,
  );
  const warm = settleVanilla(warmStart);
  const guidedFrom = (options: DeltaGuidanceOptions) =>
    settleGuided(
      attachDeltaGuidance(warmStart, input.after.edges, {
        ...GUIDANCE,
        ...options,
        anchors,
        changedIds: input.changedIds,
      }),
    );
  const adjacencyOnly = guidedFrom({ temporalRate: 0, stabilityWeight: 0 });
  const stabilityOnly = guidedFrom({
    dependencyRate: 0,
    adjacencyWeight: 0,
    proximityWeight: 0,
  });
  const guided = guidedFrom({});
  const measured = (result: { state: CapacityLayoutState; steps: number }, converged: boolean) =>
    metrics(powerGeometry(result, converged), input.after.edges, beforeGeometry);
  return {
    seed,
    stableSelection: {
      anchorMix: neighborhoodAfter.selected.anchorMix,
      candidateCount: neighborhoodAfter.candidates.length,
      weightedSolves: neighborhoodAfter.weightedSolves,
      eligibleCandidates: neighborhoodAfter.eligibleCandidates,
      swapPasses: neighborhoodAfter.selected.swapPasses,
      baselineAdjacency: neighborhoodAfter.baseline.adjacency,
      minimumAdjacency: neighborhoodAfter.minimumAdjacency,
    },
    computeMatchedSelection: {
      variant: computeMatchedAfter.selected.variant,
      candidateCount: computeMatchedAfter.candidates.length,
      weightedSolves: computeMatchedAfter.weightedSolves,
      requestedWeightedSolves: computeMatchedAfter.requestedWeightedSolves,
      budgetMatched: computeMatchedAfter.budgetMatched,
      eligibleCandidates: computeMatchedAfter.eligibleCandidates,
      baselineAdjacency: computeMatchedAfter.baseline.adjacency,
      minimumAdjacency: computeMatchedAfter.minimumAdjacency,
    },
    conditions: {
      squarified: metrics(squarifiedAfter, input.after.edges, squarifiedBefore),
      cold: measured(cold, isConverged(cold.state, AREA_TOLERANCE)),
      warm: measured(warm, isConverged(warm.state, AREA_TOLERANCE)),
      neighborhoodSwap: metrics(
        powerGeometry(
          { state: neighborhoodAfter.baseline.state, steps: neighborhoodAfter.baseline.steps },
          neighborhoodAfter.baseline.converged,
        ),
        input.after.edges,
        neighborhoodBeforeGeometry,
      ),
      stableNeighborhood: metrics(
        powerGeometry(
          { state: neighborhoodAfter.state, steps: neighborhoodAfter.totalSteps },
          neighborhoodAfter.selected.converged,
        ),
        input.after.edges,
        neighborhoodBeforeGeometry,
      ),
      computeMatchedNeighborhood: metrics(
        powerGeometry(
          { state: computeMatchedAfter.state, steps: computeMatchedAfter.totalSteps },
          computeMatchedAfter.selected.converged,
        ),
        input.after.edges,
        neighborhoodBeforeGeometry,
      ),
      adjacencyOnly: measured(adjacencyOnly, isDeltaConverged(adjacencyOnly.state, AREA_TOLERANCE)),
      stabilityOnly: measured(stabilityOnly, isDeltaConverged(stabilityOnly.state, AREA_TOLERANCE)),
      guided: measured(guided, isDeltaConverged(guided.state, AREA_TOLERANCE)),
    },
  };
}

const T95 = [
  0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16,
  2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052,
  2.048, 2.045, 2.042,
] as const;

export function summarizeSamples(values: readonly number[]) {
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, n);
  const variance =
    n > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const critical = n <= 1 ? 0 : (T95[Math.min(n - 1, 30)] ?? 1.96);
  const margin = critical * (sd / Math.sqrt(Math.max(1, n)));
  return { n, mean, sd, ci95: [mean - margin, mean + margin] as const };
}
const summarize = summarizeSamples;
function conditionSummary(trials: readonly Trial[], kind: ConditionName) {
  return Object.fromEntries(
    METRICS.map((metric) => [
      metric,
      summarize(
        trials
          .filter(
            (trial) =>
              (!metric.startsWith("constraintPath") && metric !== "constraintDisconnectedRate") ||
              trial.conditions[kind].constraintEdgeCount > 0,
          )
          .map((trial) => trial.conditions[kind][metric]),
      ),
    ]),
  ) as Record<MetricName, ReturnType<typeof summarize>>;
}
function contrastSummary(
  trials: readonly Trial[],
  candidate: ConditionName,
  baseline: ConditionName,
) {
  const paired = (fn: (trial: Trial) => number) => summarize(trials.map(fn));
  const topologicalPaired = (fn: (trial: Trial) => number) =>
    summarize(trials.filter((trial) => trial.conditions[baseline].constraintEdgeCount > 0).map(fn));
  return {
    adjacencyGain: paired(
      (trial) => trial.conditions[candidate].adjacency - trial.conditions[baseline].adjacency,
    ),
    edgeLengthReduction: paired(
      (trial) => trial.conditions[baseline].edgeLength - trial.conditions[candidate].edgeLength,
    ),
    displacementReduction: paired(
      (trial) => trial.conditions[baseline].displacement - trial.conditions[candidate].displacement,
    ),
    centroidDisplacementReduction: paired(
      (trial) =>
        trial.conditions[baseline].centroidDisplacement -
        trial.conditions[candidate].centroidDisplacement,
    ),
    polygonIoULossReduction: paired(
      (trial) =>
        trial.conditions[baseline].polygonIoULoss - trial.conditions[candidate].polygonIoULoss,
    ),
    relativeDirectionChangeReduction: paired(
      (trial) =>
        trial.conditions[baseline].relativeDirectionChange -
        trial.conditions[candidate].relativeDirectionChange,
    ),
    constraintPathMedianReduction: topologicalPaired(
      (trial) =>
        trial.conditions[baseline].constraintPathMedian -
        trial.conditions[candidate].constraintPathMedian,
    ),
    constraintPathMaxReduction: topologicalPaired(
      (trial) =>
        trial.conditions[baseline].constraintPathMax -
        trial.conditions[candidate].constraintPathMax,
    ),
    constraintDisconnectedRateReduction: topologicalPaired(
      (trial) =>
        trial.conditions[baseline].constraintDisconnectedRate -
        trial.conditions[candidate].constraintDisconnectedRate,
    ),
    objectiveReduction: paired(
      (trial) => trial.conditions[baseline].objective - trial.conditions[candidate].objective,
    ),
    stepReduction: paired(
      (trial) => trial.conditions[baseline].steps - trial.conditions[candidate].steps,
    ),
  };
}

const conditionSummaries = (trials: readonly Trial[]) =>
  Object.fromEntries(
    CONDITIONS.map((condition) => [condition, conditionSummary(trials, condition)]),
  ) as Record<ConditionName, ReturnType<typeof conditionSummary>>;
const failures = (trials: readonly Trial[]) =>
  Object.fromEntries(
    CONDITIONS.map((condition) => [
      condition,
      trials.filter((trial) => !trial.conditions[condition].converged).length,
    ]),
  ) as Record<ConditionName, number>;
const computeMatchedBudget = (trials: readonly Trial[]) => ({
  matchedTrials: trials.filter((trial) => trial.computeMatchedSelection.budgetMatched).length,
  shortfallTrials: trials.filter((trial) => !trial.computeMatchedSelection.budgetMatched).length,
});
const contrasts = (trials: readonly Trial[]) => ({
  guidedVsSquarified: contrastSummary(trials, "guided", "squarified"),
  guidedVsWarm: contrastSummary(trials, "guided", "warm"),
  guidedVsCold: contrastSummary(trials, "guided", "cold"),
  guidedVsNeighborhoodSwap: contrastSummary(trials, "guided", "neighborhoodSwap"),
  stableNeighborhoodVsNeighborhoodSwap: contrastSummary(
    trials,
    "stableNeighborhood",
    "neighborhoodSwap",
  ),
  stableNeighborhoodVsComputeMatched: contrastSummary(
    trials.filter((trial) => trial.computeMatchedSelection.budgetMatched),
    "stableNeighborhood",
    "computeMatchedNeighborhood",
  ),
  stableNeighborhoodVsGuided: contrastSummary(trials, "stableNeighborhood", "guided"),
  guidedVsAdjacencyOnly: contrastSummary(trials, "guided", "adjacencyOnly"),
  guidedVsStabilityOnly: contrastSummary(trials, "guided", "stabilityOnly"),
});

/**
 * Deterministic paired multi-seed benchmark. Wall time is intentionally absent:
 * CI compares solver quality without machine noise; runtime belongs in a
 * separately warmed performance experiment.
 */
export function runDeltaLayoutBenchmark(options: BenchmarkOptions = {}) {
  const seeds = [...(options.seeds ?? DEFAULT_SEEDS)];
  const stableSwapPasses = [...(options.stableSwapPasses ?? DEFAULT_STABLE_SWAP_PASSES)];
  if (seeds.length === 0) throw new Error("delta benchmark requires at least one seed");
  const inputs = [...(options.cases ?? syntheticCases())];
  const scenarios = inputs.map((input) => {
    const trials = seeds.map((seed) => runTrial(input, seed, stableSwapPasses));
    return {
      name: input.name,
      nodesBefore: input.before.nodes.length,
      nodesAfter: input.after.nodes.length,
      edgesAfter: input.after.edges.length,
      trials,
      summary: {
        conditions: conditionSummaries(trials),
        contrasts: contrasts(trials),
        failures: failures(trials),
        computeMatchedBudget: computeMatchedBudget(trials),
      },
    };
  });
  const allTrials = scenarios.flatMap((scenario) => scenario.trials);
  return {
    schemaVersion: 8 as const,
    seeds,
    configuration: { stableSwapPasses },
    areaTolerance: AREA_TOLERANCE,
    statistics: {
      interval: "two-sided Student t 95%" as const,
      unit: "paired scenario-seed trial" as const,
      aggregate: "descriptive pooled trials" as const,
    },
    scenarios,
    aggregate: {
      conditions: conditionSummaries(allTrials),
      contrasts: contrasts(allTrials),
      failures: failures(allTrials),
      computeMatchedBudget: computeMatchedBudget(allTrials),
    },
  };
}
