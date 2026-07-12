import type { AtlasEdge, AtlasGraph, AtlasNodeKind } from "@sprawlens/schema";
import { deriveLevels, moduleGrouping, type Grouping, type LevelTree } from "@sprawlens/schema";
import type { ModuleIdOf } from "@sprawlens/schema";
import {
  capacityStep,
  deltaAwareStep,
  isDeltaConverged,
  isConverged,
  type CapacityLayoutState,
  type ClipRegion,
  type DeltaGuidanceOptions,
  type StableNeighborhoodResult,
} from "@sprawlens/layout";
import { createGraphLayout, embedSeedHints, forceIterationsFor } from "@sprawlens/layout";
import { centralityRings, dependentWeights, importanceScore } from "@sprawlens/layout";
import { ringLayout, type PlacedCircle } from "@sprawlens/layout";
import {
  DECLUMP_ITERATIONS,
  guideLevel,
  seedLeafLayout,
  subdivideUnder,
  type SubdivisionLevel,
} from "./subdivision.ts";
import {
  leafGraphKey,
  updateLeafLayout,
  type LeafUpdateStrategy,
  type StableNeighborhoodUpdateConfig,
} from "./incrementalLayout.ts";

/**
 * Concentric-ring layout: the top boundary level's network is placed as
 * circles on topological-rank rings, then the shared nested subdivision
 * descends the remaining boundary levels inside each circle (see
 * subdivision.ts). Rings and treemap are just two shapes for the top
 * level's network.
 */

export type RingsOptions = {
  width: number;
  height: number;
  seed: number;
  adaptationRate?: number;
  lloydRate?: number;
  /** Dependency/temporal multi-objective refinement; false disables it. */
  delta?: DeltaGuidanceOptions | false;
  /** Bounded stable-NPVT update for existing leaf groups; experimental. */
  stableNeighborhood?: StableNeighborhoodUpdateConfig | false;
  /** Display boundary chain, outer → inner; defaults to module level. */
  boundaries?: readonly Grouping[];
  /** Level-native edges (service communication etc.), keyed by level kind. */
  nativeEdges?: ReadonlyMap<string, readonly AtlasEdge[]>;
  /** Module assignment for the default boundary; path heuristic otherwise. */
  moduleIdOf?: ModuleIdOf;
};

export type RingsState = {
  /** Top-level circles in viewport pixels. */
  circles: Map<string, PlacedCircle>;
  /** Solved intermediate boundary levels nested inside the circles. */
  innerLevels: SubdivisionLevel[];
  /** Innermost group id → its (animated) leaf subdivision. */
  leafLayouts: Map<string, CapacityLayoutState>;
  /** Layout-relevant signatures used to skip unchanged stable solves. */
  leafGraphKeys: Map<string, string>;
  /** Strategy used by the latest create/apply operation per leaf group. */
  lastLeafUpdateStrategies: Map<string, LeafUpdateStrategy>;
  /** Full paper-envelope diagnostics for stable groups in the latest update. */
  lastStableNeighborhoodResults: Map<string, StableNeighborhoodResult>;
  /** The top level's network (lifted + native edges). */
  topEdges: AtlasEdge[];
  ranks: Map<string, number>;
  /** Any id (group or leaf) → parent group id; top groups → null. */
  parentOf: Map<string, string | null>;
  /** Group id → its boundary level kind. */
  kindOf: Map<string, AtlasNodeKind>;
};

const CONVERGENCE = 0.005;
const CLIP_INSET = 0.94;

function resolvedBoundaries(options: RingsOptions): readonly Grouping[] {
  return options.boundaries && options.boundaries.length > 0
    ? options.boundaries
    : [moduleGrouping(options.moduleIdOf)];
}

function canvasOf(options: RingsOptions): ClipRegion {
  return {
    kind: "rect",
    x: 0,
    y: 0,
    width: options.width,
    height: options.height,
  };
}

function solverOf(options: RingsOptions) {
  return {
    seed: options.seed,
    adaptationRate: options.adaptationRate,
    lloydRate: options.lloydRate,
    delta: options.delta,
  };
}

function placeCircles(
  graph: AtlasGraph,
  options: RingsOptions,
): {
  circles: Map<string, PlacedCircle>;
  tree: LevelTree;
  ranks: Map<string, number>;
} {
  const tree = deriveLevels(graph, resolvedBoundaries(options), {
    nativeEdges: options.nativeEdges,
  });
  const top = tree.levels[0]!;
  // importance = transitive dependents scaled by √area (importanceScore):
  // the foundation everything leans on wins the center, the rest fall into
  // rings of decreasing importance
  const dependents = dependentWeights(
    top.nodes.map((m) => m.id),
    top.edges,
    () => 1,
  );
  const ranks = centralityRings(
    top.nodes.map((m) => ({
      id: m.id,
      area: m.metrics.loc,
      centrality: importanceScore(dependents.get(m.id) ?? 1, m.metrics.loc),
    })),
  );
  const placed = ringLayout(
    top.nodes.map((m) => ({
      id: m.id,
      area: m.metrics.loc,
      rank: ranks.get(m.id) ?? 0,
    })),
    top.edges,
  );
  const scale =
    placed.totalRadius > 0
      ? (Math.min(options.width, options.height) * 0.475) / placed.totalRadius
      : 1;
  const circles = new Map<string, PlacedCircle>();
  for (const [id, c] of placed.circles) {
    circles.set(id, {
      cx: options.width / 2 + c.cx * scale,
      cy: options.height / 2 + c.cy * scale,
      r: c.r * scale,
      rank: c.rank,
    });
  }
  return { circles, tree, ranks };
}

function circleClips(circles: ReadonlyMap<string, PlacedCircle>): Map<string, ClipRegion> {
  const clips = new Map<string, ClipRegion>();
  for (const [id, circle] of circles) {
    clips.set(id, {
      kind: "circle",
      cx: circle.cx,
      cy: circle.cy,
      r: circle.r * CLIP_INSET,
    });
  }
  return clips;
}

export function createRingsState(graph: AtlasGraph, options: RingsOptions): RingsState {
  const base = placeCircles(graph, options);
  const solver = solverOf(options);
  const sub = subdivideUnder(
    graph,
    base.tree,
    circleClips(base.circles),
    canvasOf(options),
    solver,
  );
  const leafLayouts = new Map<string, CapacityLayoutState>();
  const leafGraphKeys = new Map<string, string>();
  const lastLeafUpdateStrategies = new Map<string, LeafUpdateStrategy>();
  const lastStableNeighborhoodResults = new Map<string, StableNeighborhoodResult>();
  for (const [groupId, leafClip] of sub.leafClips) {
    const leaves = base.tree.childrenOf.get(groupId) ?? [];
    if (leaves.length === 0) continue;
    const edges = base.tree.innerEdgesOf.get(groupId) ?? [];
    leafLayouts.set(groupId, seedLeafLayout(leaves, edges, leafClip, sub.positions, solver));
    leafGraphKeys.set(groupId, leafGraphKey(leaves, edges));
    lastLeafUpdateStrategies.set(groupId, "cold");
  }
  return {
    circles: base.circles,
    innerLevels: sub.innerLevels,
    leafLayouts,
    leafGraphKeys,
    lastLeafUpdateStrategies,
    lastStableNeighborhoodResults,
    topEdges: base.tree.levels[0]!.edges,
    ranks: base.ranks,
    parentOf: base.tree.parentOf,
    kindOf: base.tree.kindOf,
  };
}

/** Advance unconverged leaf layouts; active=false once everything settled. */
export function stepRingsState(
  state: RingsState,
  stepsPerFrame: number,
): { state: RingsState; active: boolean } {
  let active = false;
  let leafLayouts: Map<string, CapacityLayoutState> | null = null;
  for (const [groupId, layout] of state.leafLayouts) {
    if (layout.guidance ? isDeltaConverged(layout, CONVERGENCE) : isConverged(layout, CONVERGENCE))
      continue;
    active = true;
    let next = layout;
    for (let i = 0; i < stepsPerFrame; i++) {
      next = next.guidance ? deltaAwareStep(next) : capacityStep(next);
    }
    if (!leafLayouts) leafLayouts = new Map(state.leafLayouts);
    leafLayouts.set(groupId, next);
  }
  return {
    state: leafLayouts ? { ...state, leafLayouts } : state,
    active,
  };
}

/**
 * Warm-start after the graph changed: the top level is re-derived and
 * re-placed, existing leaf layouts keep their sites via the shared updater
 * (new clip, refreshed weights, removed leaves dropped); brand-new groups
 * start cold. With a single boundary the (cheap) path skips the global
 * force entirely; deeper chains re-solve the intermediate levels.
 */
export function applyRingsChanges(
  state: RingsState,
  graph: AtlasGraph,
  options: RingsOptions,
): RingsState {
  const base = placeCircles(graph, options);
  const solver = solverOf(options);
  const topClips = circleClips(base.circles);

  let innerLevels: SubdivisionLevel[] = [];
  let leafClips: ReadonlyMap<string, ClipRegion> = topClips;
  let positions: ReadonlyMap<string, { x: number; y: number }> | null = null;
  if (base.tree.levels.length > 1) {
    const sub = subdivideUnder(graph, base.tree, topClips, canvasOf(options), solver);
    innerLevels = sub.innerLevels;
    leafClips = sub.leafClips;
    positions = sub.positions;
  }

  const leafLayouts = new Map<string, CapacityLayoutState>();
  const leafGraphKeys = new Map<string, string>();
  const lastLeafUpdateStrategies = new Map<string, LeafUpdateStrategy>();
  const lastStableNeighborhoodResults = new Map<string, StableNeighborhoodResult>();
  for (const [groupId, clip] of leafClips) {
    const leaves = base.tree.childrenOf.get(groupId) ?? [];
    if (leaves.length === 0) continue;
    const edges = base.tree.innerEdgesOf.get(groupId) ?? [];
    const graphKey = leafGraphKey(leaves, edges);
    leafGraphKeys.set(groupId, graphKey);
    const existing = state.leafLayouts.get(groupId);
    if (existing) {
      const update = updateLeafLayout(existing, leaves, edges, clip, {
        seed: options.seed,
        adaptationRate: options.adaptationRate,
        lloydRate: options.lloydRate,
        stableNeighborhood:
          state.leafGraphKeys.get(groupId) === graphKey ? false : options.stableNeighborhood,
      });
      leafLayouts.set(groupId, update.state);
      lastLeafUpdateStrategies.set(groupId, update.strategy);
      if (update.strategy === "stableNeighborhood") {
        lastStableNeighborhoodResults.set(groupId, update.result);
      }
      continue;
    }
    if (positions) {
      leafLayouts.set(groupId, seedLeafLayout(leaves, edges, clip, positions, solver));
      lastLeafUpdateStrategies.set(groupId, "cold");
      continue;
    }
    // cold group on the fast path: embedding seeds inside its own clip
    const subgraph = { nodes: [...leaves], edges: [...edges] };
    const hints = embedSeedHints(subgraph, clip);
    leafLayouts.set(
      groupId,
      guideLevel(
        createGraphLayout(subgraph, clip, {
          ...solver,
          hints: hints ?? undefined,
          forceIterations: hints
            ? Math.min(DECLUMP_ITERATIONS, forceIterationsFor(leaves.length))
            : forceIterationsFor(leaves.length),
        }),
        edges,
        solver,
      ),
    );
    lastLeafUpdateStrategies.set(groupId, "cold");
  }

  return {
    circles: base.circles,
    innerLevels,
    leafLayouts,
    leafGraphKeys,
    lastLeafUpdateStrategies,
    lastStableNeighborhoodResults,
    topEdges: base.tree.levels[0]!.edges,
    ranks: base.ranks,
    parentOf: base.tree.parentOf,
    kindOf: base.tree.kindOf,
  };
}
