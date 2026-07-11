import type { AtlasEdge } from "@sprawlens/contracts";
import {
  capacityStep,
  isConverged,
  relocateCapacitySites,
  type CapacityLayoutState,
} from "./capacityLayout.ts";
import { clampInto, clipScale } from "./clip.ts";
import type {
  DeltaGuidance,
  DeltaGuidanceOptions,
  DeltaObjective,
  ResolvedDeltaGuidanceOptions,
} from "./deltaTypes.ts";
import { cellAdjacency, realizedEdgeRate } from "./neighborhood.ts";
import type { Vec2 } from "./vec.ts";

export type { DeltaGuidanceOptions, DeltaObjective } from "./deltaTypes.ts";

const DEFAULTS: ResolvedDeltaGuidanceOptions = {
  dependencyRate: 0.08,
  temporalRate: 0.32,
  localityRadius: 2,
  areaWeight: 1,
  adjacencyWeight: 1,
  stabilityWeight: 0.7,
  proximityWeight: 0.18,
  activationAreaError: 0.08,
  repairSteps: 1,
  minGuidedSteps: 24,
  maxGuidedSteps: 160,
  stallSteps: 10,
  improvementEpsilon: 1e-5,
};

function resolveOptions(options: DeltaGuidanceOptions = {}): ResolvedDeltaGuidanceOptions {
  const resolved = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof ResolvedDeltaGuidanceOptions)[]) {
    const value = options[key];
    if (value !== undefined) resolved[key] = value;
  }
  return resolved;
}

function eligibleEdges(state: CapacityLayoutState, edges: readonly AtlasEdge[]): AtlasEdge[] {
  const ids = new Set(state.cells.map((cell) => cell.id));
  const seen = new Set<string>();
  const result: AtlasEdge[] = [];
  for (const edge of edges) {
    if (edge.source === edge.target || !ids.has(edge.source) || !ids.has(edge.target)) continue;
    const pair =
      edge.source < edge.target
        ? `${edge.source}\0${edge.target}`
        : `${edge.target}\0${edge.source}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    result.push(edge);
  }
  return result;
}

/** Attach the dependency and temporal objective without changing geometry. */
export function attachDeltaGuidance(
  state: CapacityLayoutState,
  edges: readonly AtlasEdge[],
  options: DeltaGuidanceOptions = {},
): CapacityLayoutState {
  const guidance: DeltaGuidance = {
    edges: [...edges],
    anchors: new Map(
      [...(options.anchors ?? [])].map(
        ([id, point]) => [id, clampInto(state.clip, point)] as const,
      ),
    ),
    changedIds: new Set(options.changedIds ?? []),
    options: resolveOptions(options),
    guidedSteps: 0,
    stalledSteps: 0,
    lastObjective: Number.POSITIVE_INFINITY,
  };
  const guided = { ...state, guidance };
  return {
    ...guided,
    guidance: { ...guidance, lastObjective: measureDeltaObjective(guided).total },
  };
}

/** Compute every term used by the line search; also suitable for benchmarks. */
export function measureDeltaObjective(state: CapacityLayoutState): DeltaObjective {
  const guidance = state.guidance;
  const options = guidance?.options ?? DEFAULTS;
  const edges = guidance ? eligibleEdges(state, guidance.edges) : [];
  let meanAreaError = 0;
  for (const cell of state.cells) {
    meanAreaError += Math.abs(cell.actualArea - cell.targetArea) / Math.max(cell.targetArea, 1e-12);
  }
  if (state.cells.length > 0) meanAreaError /= state.cells.length;

  const adjacency = cellAdjacency(state.cells);
  const dependencyAdjacency = realizedEdgeRate(adjacency, edges);
  const adjacencyLoss = 1 - dependencyAdjacency;
  const scale = Math.max(clipScale(state.clip), 1e-12);
  const siteOf = new Map(state.cells.map((cell) => [cell.id, cell.site]));

  let normalizedEdgeLength = 0;
  let edgeWeight = 0;
  for (const edge of edges) {
    const source = siteOf.get(edge.source)!;
    const target = siteOf.get(edge.target)!;
    const weight = Math.max(edge.weight ?? 1, 0);
    normalizedEdgeLength += (weight * Math.hypot(target.x - source.x, target.y - source.y)) / scale;
    edgeWeight += weight;
  }
  if (edgeWeight > 0) normalizedEdgeLength /= edgeWeight;

  let normalizedDisplacement = 0;
  let anchored = 0;
  for (const [id, anchor] of guidance?.anchors ?? []) {
    const site = siteOf.get(id);
    if (!site) continue;
    normalizedDisplacement += Math.hypot(site.x - anchor.x, site.y - anchor.y) / scale;
    anchored++;
  }
  if (anchored > 0) normalizedDisplacement /= anchored;

  const dependencyLoss = adjacencyLoss + options.proximityWeight * normalizedEdgeLength;
  const total =
    options.areaWeight * meanAreaError +
    options.adjacencyWeight * dependencyLoss +
    options.stabilityWeight * normalizedDisplacement;
  return {
    meanAreaError,
    maxAreaError: state.maxRelativeError,
    dependencyAdjacency,
    adjacencyLoss,
    normalizedEdgeLength,
    normalizedDisplacement,
    total,
  };
}

/** Undirected hop distance from the directly changed delta frontier. */
function changeDistances(guidance: DeltaGuidance, ids: ReadonlySet<string>): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of guidance.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) continue;
    (adjacency.get(edge.source) ?? adjacency.set(edge.source, new Set()).get(edge.source)!).add(
      edge.target,
    );
    (adjacency.get(edge.target) ?? adjacency.set(edge.target, new Set()).get(edge.target)!).add(
      edge.source,
    );
  }
  const distance = new Map<string, number>();
  const queue: string[] = [];
  for (const id of guidance.changedIds) {
    if (!ids.has(id)) continue;
    distance.set(id, 0);
    queue.push(id);
  }
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    const d = distance.get(id)!;
    for (const next of adjacency.get(id) ?? []) {
      if (distance.has(next)) continue;
      distance.set(next, d + 1);
      queue.push(next);
    }
  }
  return distance;
}

function guidedPositions(state: CapacityLayoutState, factor: number): Map<string, Vec2> {
  const guidance = state.guidance!;
  const options = guidance.options;
  const sites = new Map(state.cells.map((cell) => [cell.id, cell.site]));
  const adjacency = cellAdjacency(state.cells);
  const ids = new Set(sites.keys());
  const distances = changeDistances(guidance, ids);
  const force = new Map<string, { x: number; y: number; weight: number }>();
  const add = (id: string, x: number, y: number, weight: number) => {
    const current = force.get(id);
    if (current) {
      current.x += x;
      current.y += y;
      current.weight += weight;
    } else {
      force.set(id, { x, y, weight });
    }
  };

  for (const edge of eligibleEdges(state, guidance.edges)) {
    if (adjacency.get(edge.source)?.has(edge.target)) continue;
    const source = sites.get(edge.source)!;
    const target = sites.get(edge.target)!;
    const weight = Math.max(edge.weight ?? 1, 0.1);
    add(edge.source, target.x - source.x, target.y - source.y, weight);
    add(edge.target, source.x - target.x, source.y - target.y, weight);
  }

  const scale = Math.max(clipScale(state.clip), 1e-12);
  const maxMove = scale * 0.06 * factor;
  const positions = new Map<string, Vec2>();
  for (const [id, site] of sites) {
    const d = distances.get(id);
    const hasDelta = guidance.changedIds.size > 0;
    const localMobility = !hasDelta
      ? 1
      : d === undefined
        ? 0.08
        : Math.max(0.08, 1 - d / Math.max(1, options.localityRadius + 1));
    const f = force.get(id);
    let x = site.x;
    let y = site.y;
    if (f && f.weight > 0) {
      let dx = (f.x / f.weight) * options.dependencyRate * factor * localMobility;
      let dy = (f.y / f.weight) * options.dependencyRate * factor * localMobility;
      const length = Math.hypot(dx, dy);
      if (length > maxMove) {
        dx *= maxMove / length;
        dy *= maxMove / length;
      }
      x += dx;
      y += dy;
    }

    const anchor = guidance.anchors.get(id);
    if (anchor) {
      const anchorStrength = !hasDelta
        ? 1
        : d === undefined
          ? 1
          : Math.min(1, d / Math.max(1, options.localityRadius));
      const rate = options.temporalRate * factor * anchorStrength;
      x += (anchor.x - x) * rate;
      y += (anchor.y - y) * rate;
    }
    positions.set(id, { x, y });
  }
  return positions;
}

/**
 * One capacity step followed by a deterministic multi-objective line search.
 * The unperturbed area step is always a candidate, so dependency refinement is
 * accepted only when its area/adjacency/stability score is better.
 */
export function deltaAwareStep(state: CapacityLayoutState): CapacityLayoutState {
  if (!state.guidance) return capacityStep(state);
  const base = capacityStep(state);
  const guidance = base.guidance!;
  if (base.maxRelativeError > guidance.options.activationAreaError) return base;

  let best = base;
  let bestScore = measureDeltaObjective(base);
  for (const factor of [1, 0.5, 0.25, 0.125]) {
    let candidate = relocateCapacitySites(base, guidedPositions(base, factor));
    for (let i = 0; i < guidance.options.repairSteps; i++) candidate = capacityStep(candidate);
    const score = measureDeltaObjective(candidate);
    if (score.total + 1e-12 < bestScore.total) {
      best = candidate;
      bestScore = score;
    }
  }

  const improved = guidance.lastObjective - bestScore.total > guidance.options.improvementEpsilon;
  return {
    ...best,
    guidance: {
      ...guidance,
      guidedSteps: guidance.guidedSteps + 1,
      stalledSteps: improved ? 0 : guidance.stalledSteps + 1,
      lastObjective: bestScore.total,
    },
  };
}

/** Area convergence plus an explicit stopping rule for the guided objective. */
export function isDeltaConverged(state: CapacityLayoutState, areaTolerance: number): boolean {
  if (!state.guidance) return isConverged(state, areaTolerance);
  if (!isConverged(state, areaTolerance)) return false;
  const { guidedSteps, stalledSteps, options } = state.guidance;
  if (guidedSteps >= options.maxGuidedSteps) return true;
  return guidedSteps >= options.minGuidedSteps && stalledSteps >= options.stallSteps;
}
