import type { AtlasEdge, AtlasGraph, AtlasNodeKind } from "@sprawlens/schema";
import { deriveLevels, moduleGrouping, type Grouping } from "@sprawlens/schema";
import type { ModuleIdOf } from "@sprawlens/schema";
import {
  applyGraphChanges,
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
  type ClipRegion,
} from "@sprawlens/layout";
import { nearestPointInRing } from "@sprawlens/layout";
import { createGraphLayout, embedSeedHints, forceIterationsFor } from "@sprawlens/layout";
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

type TreemapLevelCells = SubdivisionLevel;

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
          forceIterations: topHints ? DECLUMP_ITERATIONS : forceIterationsFor(top.nodes.length),
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
      seedLeafLayout(leaves, tree.innerEdgesOf.get(groupId) ?? [], leafClip, sub.positions, solver),
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

/**
 * Warm-start after the graph changed (PowerHierarchy's updating scheme):
 * every level re-solves from the previous frame's sites instead of a
 * fresh embedding, so the same element stays where it was. Sites whose
 * parent region moved are projected back inside (external-site
 * projection), surviving leaf layouts keep their full solver state via
 * applyGraphChanges, and new entries start at the minimum neighbor
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
  const topLayout = solveLevel(
    createCapacityLayout(
      top.nodes.map((node) => ({
        id: node.id,
        weight: node.metrics.loc,
        hint: previousSiteOf(node.id),
      })),
      clip,
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
      const layout = solveLevel(
        createCapacityLayout(
          children.map((child) => {
            const previous = previousSiteOf(child.id);
            return {
              id: child.id,
              weight: child.metrics.loc,
              hint: previous && ring ? nearestPointInRing(ring, previous) : previous,
            };
          }),
          parentClip,
          solver,
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
  for (const [groupId, leafClip] of parentClips) {
    const leaves = tree.childrenOf.get(groupId) ?? [];
    if (leaves.length === 0) continue;
    const existing = state.leafLayouts.get(groupId);
    if (existing) {
      const leafIds = new Set(leaves.map((leaf) => leaf.id));
      const remove = existing.cells.map((c) => c.id).filter((id) => !leafIds.has(id));
      leafLayouts.set(
        groupId,
        applyGraphChanges(existing, {
          clip: leafClip,
          upsert: leaves.map((leaf) => ({
            id: leaf.id,
            weight: leaf.metrics.loc,
          })),
          remove,
        }),
      );
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
      createCapacityLayout(
        leaves.map((leaf) => {
          const previous = prevLeafSiteOf(leaf.id);
          return {
            id: leaf.id,
            weight: leaf.metrics.loc,
            hint: previous && ring ? nearestPointInRing(ring, previous) : previous,
          };
        }),
        leafClip,
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
