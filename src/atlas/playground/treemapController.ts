import type {
  AtlasEdge,
  AtlasGraph,
  AtlasNodeKind,
} from "../contracts/graph.js";
import {
  deriveLevels,
  moduleGrouping,
  type Grouping,
} from "../contracts/hierarchy.js";
import type { ModuleIdOf } from "../contracts/modules.js";
import {
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type ClipRegion,
} from "../kernel/capacityLayout.js";
import {
  createGraphLayout,
  embedSeedHints,
  forceIterationsFor,
} from "../kernel/pipeline.js";
import {
  assignedSlotHints,
  DECLUMP_ITERATIONS,
  insetRing,
  NEST_INSET,
  seedLeafLayout,
  solveLevel,
  subdivideUnder,
  type SubdivisionLevel,
} from "./subdivision.js";

/**
 * Full-canvas Voronoi treemap over an arbitrary boundary chain: the top
 * boundary level tiles the viewport as a capacity-constrained power
 * diagram, then the shared nested subdivision descends the remaining
 * levels (see subdivision.ts).
 */

export type TreemapOptions = {
  width: number;
  height: number;
  seed: number;
  adaptationRate?: number;
  lloydRate?: number;
  /**
   * Display boundary chain, outer → inner; defaults to a single module
   * level. Must not be empty.
   */
  boundaries?: readonly Grouping[];
  /** Level-native edges (service communication etc.), keyed by level kind. */
  nativeEdges?: ReadonlyMap<string, readonly AtlasEdge[]>;
  /** Module assignment for the default boundary; path heuristic otherwise. */
  moduleIdOf?: ModuleIdOf;
};

export type TreemapLevelCells = SubdivisionLevel;

export type TreemapState = {
  /** Boundary levels, outer → inner; levels[0] tiles the whole viewport. */
  levels: TreemapLevelCells[];
  /** Innermost group id → its (animated) leaf subdivision. */
  leafLayouts: Map<string, CapacityLayoutState>;
  /** The top level's network (lifted + native edges). */
  topEdges: AtlasEdge[];
  /** Any id (group or leaf) → parent group id; top groups → null. */
  parentOf: Map<string, string | null>;
  /** Group id → its boundary level kind. */
  kindOf: Map<string, AtlasNodeKind>;
};

const LEAF_CONVERGENCE = 0.005;

export function createTreemapState(
  graph: AtlasGraph,
  options: TreemapOptions,
): TreemapState {
  const boundaries =
    options.boundaries && options.boundaries.length > 0
      ? options.boundaries
      : [moduleGrouping(options.moduleIdOf)];
  const tree = deriveLevels(graph, boundaries, {
    nativeEdges: options.nativeEdges,
  });
  const clip = {
    kind: "rect" as const,
    x: 0,
    y: 0,
    width: options.width,
    height: options.height,
  };
  const solver = {
    seed: options.seed,
    adaptationRate: options.adaptationRate,
    lloydRate: options.lloydRate,
  };

  // Top level tiles the viewport; small n, solved at creation so nested
  // layouts start from stable parent geometry. The embedding gives
  // similarity positions; CVT slots + assignment turn them into a layout
  // whose adjacencies follow the level's dependencies.
  const top = tree.levels[0]!;
  const topGraph = { nodes: top.nodes, edges: top.edges };
  const topHints = embedSeedHints(topGraph, clip);
  const topSlots = topHints
    ? assignedSlotHints(top.nodes, top.edges, clip, topHints, options.seed)
    : null;
  const topLayout = solveLevel(
    topSlots
      ? createCapacityLayout(
          top.nodes.map((node) => ({
            id: node.id,
            weight: node.metrics.loc,
            hint: topSlots.get(node.id),
          })),
          clip,
          solver,
        )
      : createGraphLayout(topGraph, clip, {
          ...solver,
          hints: topHints ?? undefined,
          forceIterations: topHints
            ? DECLUMP_ITERATIONS
            : forceIterationsFor(top.nodes.length),
        }),
  );
  const levels: TreemapLevelCells[] = [
    {
      kind: top.kind,
      cells: new Map(topLayout.cells.map((c) => [c.id, c])),
      edges: top.edges,
    },
  ];

  const topClips = new Map<string, ClipRegion>();
  for (const cell of topLayout.cells) {
    if (cell.polygon.length < 3) continue;
    topClips.set(cell.id, {
      kind: "polygon",
      ring: insetRing(cell.polygon, NEST_INSET),
    });
  }
  const sub = subdivideUnder(graph, tree, topClips, clip, solver);
  levels.push(...sub.innerLevels);

  const leafLayouts = new Map<string, CapacityLayoutState>();
  for (const [groupId, leafClip] of sub.leafClips) {
    const leaves = tree.childrenOf.get(groupId) ?? [];
    if (leaves.length === 0) continue;
    leafLayouts.set(
      groupId,
      seedLeafLayout(
        leaves,
        tree.innerEdgesOf.get(groupId) ?? [],
        leafClip,
        sub.positions,
        solver,
      ),
    );
  }

  return {
    levels,
    leafLayouts,
    topEdges: top.edges,
    parentOf: tree.parentOf,
    kindOf: tree.kindOf,
  };
}

/** Advance unconverged leaf layouts; active=false once everything settled. */
export function stepTreemapState(
  state: TreemapState,
  stepsPerFrame: number,
): { state: TreemapState; active: boolean } {
  let active = false;
  let leafLayouts: Map<string, CapacityLayoutState> | null = null;
  for (const [groupId, layout] of state.leafLayouts) {
    if (isConverged(layout, LEAF_CONVERGENCE)) continue;
    active = true;
    let next = layout;
    for (let i = 0; i < stepsPerFrame; i++) next = capacityStep(next);
    if (!leafLayouts) leafLayouts = new Map(state.leafLayouts);
    leafLayouts.set(groupId, next);
  }
  return {
    state: leafLayouts ? { ...state, leafLayouts } : state,
    active,
  };
}
