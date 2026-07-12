import type { AtlasEdge, AtlasGraph, AtlasNodeKind } from "@sprawlens/schema";
import { deriveLevels, moduleGrouping, type Grouping } from "@sprawlens/schema";
import type { ModuleIdOf } from "@sprawlens/schema";
import {
  capacityStep,
  createCapacityLayout,
  deltaAwareStep,
  isDeltaConverged,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
  type ClipRegion,
  type DeltaGuidanceOptions,
  type StableNeighborhoodResult,
} from "@sprawlens/layout";
import { nearestPointInRing } from "@sprawlens/layout";
import { createGraphLayout, embedSeedHints, forceIterationsFor } from "@sprawlens/layout";
import {
  assignedSlotHints,
  DECLUMP_ITERATIONS,
  insetRing,
  guideLevel,
  NEST_INSET,
  seedLeafLayout,
  solveLevel,
  subdivideUnder,
  type SubdivisionLevel,
} from "./subdivision.ts";
import {
  leafGraphKey,
  nodeInsertionHint,
  preRollCapacityLayout,
  updateLeafLayout,
  type LeafUpdateStrategy,
  type StableNeighborhoodUpdateConfig,
} from "./incrementalLayout.ts";

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
  /** Dependency/temporal multi-objective refinement; false disables it. */
  delta?: DeltaGuidanceOptions | false;
  /** Bounded stable-NPVT update for existing leaf groups; experimental. */
  stableNeighborhood?: StableNeighborhoodUpdateConfig | false;
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

type TreemapLevelCells = SubdivisionLevel;

export type TreemapState = {
  /** Boundary levels, outer → inner; levels[0] tiles the whole viewport. */
  levels: TreemapLevelCells[];
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
  /** Any id (group or leaf) → parent group id; top groups → null. */
  parentOf: Map<string, string | null>;
  /** Group id → its boundary level kind. */
  kindOf: Map<string, AtlasNodeKind>;
};

const LEAF_CONVERGENCE = 0.005;
const PRE_ROLL_STEPS = 8;

export function createTreemapState(graph: AtlasGraph, options: TreemapOptions): TreemapState {
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
    delta: options.delta,
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
    guideLevel(
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
            forceIterations: topHints ? DECLUMP_ITERATIONS : forceIterationsFor(top.nodes.length),
          }),
      top.edges,
      solver,
    ),
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
  const leafGraphKeys = new Map<string, string>();
  const lastLeafUpdateStrategies = new Map<string, LeafUpdateStrategy>();
  const lastStableNeighborhoodResults = new Map<string, StableNeighborhoodResult>();
  for (const [groupId, leafClip] of sub.leafClips) {
    const leaves = tree.childrenOf.get(groupId) ?? [];
    if (leaves.length === 0) continue;
    const edges = tree.innerEdgesOf.get(groupId) ?? [];
    leafLayouts.set(groupId, seedLeafLayout(leaves, edges, leafClip, sub.positions, solver));
    leafGraphKeys.set(groupId, leafGraphKey(leaves, edges));
    lastLeafUpdateStrategies.set(groupId, "cold");
  }

  return {
    levels,
    leafLayouts,
    leafGraphKeys,
    lastLeafUpdateStrategies,
    lastStableNeighborhoodResults,
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
    if (
      layout.guidance
        ? isDeltaConverged(layout, LEAF_CONVERGENCE)
        : isConverged(layout, LEAF_CONVERGENCE)
    )
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
 * Warm-start after the graph changed (PowerHierarchy's updating scheme):
 * every level re-solves from the previous frame's sites instead of a
 * fresh embedding, so the same element stays where it was. Sites whose
 * parent region moved are projected back inside (external-site
 * projection), surviving leaf layouts keep their full solver state via
 * the shared incremental updater, and new entries start at the minimum neighbor
 * weight. Structural view changes (boundaries, granularity, canvas size)
 * still rebuild cold — this path is for data mutations.
 */
export function applyTreemapChanges(
  state: TreemapState,
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
    delta: options.delta,
  };
  /** Previous site of an id, wherever it lived. */
  const previousSiteOf = (id: string) => {
    for (const level of state.levels) {
      const cell = level.cells.get(id);
      if (cell) return cell.site;
    }
    return undefined;
  };

  // top level: previous district sites carry over as hints
  const top = tree.levels[0]!;
  const topAnchors = new Map<string, { x: number; y: number }>();
  for (const node of top.nodes) {
    const previous = previousSiteOf(node.id);
    if (previous) topAnchors.set(node.id, previous);
  }
  const topLayout = solveLevel(
    guideLevel(
      createCapacityLayout(
        top.nodes.map((node) => ({
          id: node.id,
          weight: node.metrics.loc,
          hint: nodeInsertionHint(node.id, top.edges, previousSiteOf),
        })),
        clip,
        solver,
      ),
      top.edges,
      solver,
      topAnchors,
    ),
  );
  const levels: TreemapLevelCells[] = [
    {
      kind: top.kind,
      cells: new Map(topLayout.cells.map((c) => [c.id, c])),
      edges: top.edges,
    },
  ];

  // intermediate levels: previous sites, projected into the parent's new
  // region when it moved out from under them
  let parentClips = new Map<string, ClipRegion>();
  for (const cell of topLayout.cells) {
    if (cell.polygon.length < 3) continue;
    parentClips.set(cell.id, {
      kind: "polygon",
      ring: insetRing(cell.polygon, NEST_INSET),
    });
  }
  for (let k = 1; k < tree.levels.length; k++) {
    const cells = new Map<string, CellResult>();
    const nextClips = new Map<string, ClipRegion>();
    for (const [parentId, parentClip] of parentClips) {
      const children = tree.childrenOf.get(parentId) ?? [];
      if (children.length === 0) continue;
      const ring = parentClip.kind === "polygon" ? parentClip.ring : null;
      const anchors = new Map<string, { x: number; y: number }>();
      for (const child of children) {
        const previous = previousSiteOf(child.id);
        if (previous) anchors.set(child.id, previous);
      }
      const layout = solveLevel(
        guideLevel(
          createCapacityLayout(
            children.map((child) => {
              const previous = nodeInsertionHint(child.id, tree.levels[k]!.edges, previousSiteOf);
              return {
                id: child.id,
                weight: child.metrics.loc,
                hint: previous && ring ? nearestPointInRing(ring, previous) : previous,
              };
            }),
            parentClip,
            solver,
          ),
          tree.levels[k]!.edges,
          solver,
          anchors,
        ),
      );
      for (const cell of layout.cells) {
        cells.set(cell.id, cell);
        if (cell.polygon.length >= 3) {
          nextClips.set(cell.id, {
            kind: "polygon",
            ring: insetRing(cell.polygon, NEST_INSET),
          });
        }
      }
    }
    levels.push({ kind: tree.levels[k]!.kind, cells, edges: tree.levels[k]!.edges });
    parentClips = nextClips;
  }

  // leaves: surviving group layouts keep their solver state; new groups
  // start from the previous leaf sites where any exist
  const leafLayouts = new Map<string, CapacityLayoutState>();
  const leafGraphKeys = new Map<string, string>();
  const lastLeafUpdateStrategies = new Map<string, LeafUpdateStrategy>();
  const lastStableNeighborhoodResults = new Map<string, StableNeighborhoodResult>();
  for (const [groupId, leafClip] of parentClips) {
    const leaves = tree.childrenOf.get(groupId) ?? [];
    if (leaves.length === 0) continue;
    const edges = tree.innerEdgesOf.get(groupId) ?? [];
    const graphKey = leafGraphKey(leaves, edges);
    leafGraphKeys.set(groupId, graphKey);
    const existing = state.leafLayouts.get(groupId);
    if (existing) {
      const stable = options.stableNeighborhood;
      const update = updateLeafLayout(existing, leaves, edges, leafClip, {
        seed: options.seed,
        adaptationRate: options.adaptationRate,
        lloydRate: options.lloydRate,
        stableNeighborhood: state.leafGraphKeys.get(groupId) === graphKey ? false : stable,
        preRollWarm: stable ? { steps: PRE_ROLL_STEPS, tolerance: LEAF_CONVERGENCE } : false,
      });
      leafLayouts.set(groupId, update.state);
      lastLeafUpdateStrategies.set(groupId, update.strategy);
      if (update.strategy === "stableNeighborhood") {
        lastStableNeighborhoodResults.set(groupId, update.result);
      }
      continue;
    }
    const prevLeafSiteOf = (id: string) => {
      for (const layout of state.leafLayouts.values()) {
        const cell = layout.cells.find((c) => c.id === id);
        if (cell) return cell.site;
      }
      return undefined;
    };
    const ring = leafClip.kind === "polygon" ? leafClip.ring : null;
    leafLayouts.set(
      groupId,
      preRollCapacityLayout(
        guideLevel(
          createCapacityLayout(
            leaves.map((leaf) => {
              const previous = nodeInsertionHint(leaf.id, edges, prevLeafSiteOf);
              return {
                id: leaf.id,
                weight: leaf.metrics.loc,
                hint: previous && ring ? nearestPointInRing(ring, previous) : previous,
              };
            }),
            leafClip,
            solver,
          ),
          edges,
          solver,
          new Map(
            leaves.flatMap((leaf) => {
              const previous = prevLeafSiteOf(leaf.id);
              return previous ? [[leaf.id, previous] as const] : [];
            }),
          ),
        ),
        { steps: PRE_ROLL_STEPS, tolerance: LEAF_CONVERGENCE },
      ),
    );
    lastLeafUpdateStrategies.set(groupId, "cold");
  }

  return {
    levels,
    leafLayouts,
    leafGraphKeys,
    lastLeafUpdateStrategies,
    lastStableNeighborhoodResults,
    topEdges: top.edges,
    parentOf: tree.parentOf,
    kindOf: tree.kindOf,
  };
}
