import type { AtlasEdge, AtlasGraph, AtlasNode, AtlasNodeKind } from "@sprawlens/schema";
import type { LevelTree } from "@sprawlens/schema";
import { minCostAssignment } from "@sprawlens/layout";
import {
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
  type ClipRegion,
} from "@sprawlens/layout";
import { clipCenter, clipToRing } from "@sprawlens/layout";
import { createForceLayout, forceStep } from "@sprawlens/layout";
import { cellAdjacency, greedySwapAssignment } from "@sprawlens/layout";
import { embedSeedHints } from "@sprawlens/layout";
import { centroid, type Ring } from "@sprawlens/layout";
import type { Vec2 } from "@sprawlens/layout";

/**
 * Shared nested subdivision: given converged top-level regions (treemap
 * cells or ring circles — the top layout is just the shape of the top
 * level's network), descend the remaining boundary levels of a LevelTree
 * and seed the leaf layouts. Leaves are placed by ONE global force
 * simulation whose nodes are confined to their top region (projected
 * gradient), so cross-boundary dependencies still pull linked leaves
 * toward shared borders.
 */

export type SolverOptions = {
  seed: number;
  adaptationRate?: number;
  lloydRate?: number;
};

export type SubdivisionLevel = {
  kind: AtlasNodeKind;
  cells: Map<string, CellResult>;
  /** The level's full network (lifted + native), for focus extraction. */
  edges: AtlasEdge[];
};

export type Subdivision = {
  /** Solved intermediate boundary levels (tree.levels[1..]). */
  innerLevels: SubdivisionLevel[];
  /** Innermost group id → the clip its leaf layout should fill. */
  leafClips: Map<string, ClipRegion>;
  /** Global constrained-force positions; similarity for leaf seeding. */
  positions: ReadonlyMap<string, Vec2>;
};

const LEVEL_CONVERGENCE = 0.01;
const LEVEL_MAX_STEPS = 240;
/** Gutter between a region border and its nested cells. */
export const NEST_INSET = 0.96;
/** When the embedding provides the structure, force only declumps. */
export const DECLUMP_ITERATIONS = 16;
/** Circle regions are approximated for point-in-region projection. */
const CIRCLE_SEGMENTS = 32;

export function insetRing(ring: Ring, factor: number): Ring {
  const c = centroid(ring);
  return ring.map((p) => ({
    x: c.x + (p.x - c.x) * factor,
    y: c.y + (p.y - c.y) * factor,
  }));
}

/** Above this many total leaves the global O(n²) force pass alone blocks
 * the build for hundreds of ms; skip it and let each region's own melt
 * arrange its leaves over the budgeted ticks. The cross-boundary
 * pre-arrangement it provides is invisible at monorepo zoom-out anyway. */
const FORCE_SKIP_ABOVE = 700;

/**
 * The constrained leaf force is O(n²) per iteration; give it more budget
 * than plain seeding (it carries the cross-boundary structure) but keep
 * monorepo-scale graphs from blocking the build for seconds — above
 * {@link FORCE_SKIP_ABOVE} leaves it is dropped entirely.
 */
function constrainedForceIterations(nodeCount: number): number {
  if (nodeCount === 0) return 0;
  if (nodeCount > FORCE_SKIP_ABOVE) return 0;
  return Math.max(8, Math.min(60, Math.floor(8_000_000 / (nodeCount * nodeCount))));
}

/** Above this the O(n³) Kuhn-Munkres assignment dominates the build; large
 * groups skip it and seed from their similarity positions. Kept low enough
 * that one big district can never block the build by itself (128³ ≈ 2M). */
const ASSIGN_NODE_CAP = 128;
const CVT_MAX_STEPS = 80;
/** Per-group CVT work budget: steps ≈ budget / n², so a big district gets
 * few relaxation steps and a small one the full count. Bounds the seeding
 * cost per group without a flat quality cut on small graphs. */
const CVT_STEP_BUDGET = 2_000_000;
const CVT_CONVERGENCE = 0.05;

/**
 * Neighborhood-preserving seeding (Paetzold et al. 2025, arXiv:2508.03445):
 * converge an equal-area CVT inside the clip to get well-shaped slots,
 * optimally match nodes onto slots by similarity-position distance
 * (Kuhn-Munkres), then greedily swap assignments so dependency edges are
 * realized as slot adjacencies. Nodes are hinted at their slot sites; the
 * later capacity melt grows cells to their LOC areas — the paper's
 * "grow only at the end" phase — keeping the neighborhood structure.
 */
export function assignedSlotHints(
  nodes: readonly AtlasNode[],
  edges: readonly AtlasEdge[],
  clip: ClipRegion,
  similarity: ReadonlyMap<string, Vec2>,
  seed: number,
): Map<string, Vec2> | null {
  const n = nodes.length;
  if (n < 2 || n > ASSIGN_NODE_CAP) return null;
  let cvt = createCapacityLayout(
    nodes.map((node) => ({ id: node.id, weight: 1 })),
    clip,
    { seed },
  );
  const cvtSteps = Math.max(12, Math.min(CVT_MAX_STEPS, Math.floor(CVT_STEP_BUDGET / (n * n))));
  for (let i = 0; i < cvtSteps && !isConverged(cvt, CVT_CONVERGENCE); i++) {
    cvt = capacityStep(cvt);
  }
  const slots = cvt.cells;
  const center = clipCenter(clip);
  const cost = nodes.map((node) => {
    const p = similarity.get(node.id) ?? center;
    return slots.map((slot) => (p.x - slot.site.x) ** 2 + (p.y - slot.site.y) ** 2);
  });
  const matched = minCostAssignment(cost);
  const slotIndexOf = new Map(slots.map((slot, i) => [slot.id, i]));
  const adjacency = cellAdjacency(slots);
  const slotAdjacency = slots.map(
    (slot) => new Set([...(adjacency.get(slot.id) ?? [])].map((id) => slotIndexOf.get(id)!)),
  );
  const swapped = greedySwapAssignment(
    matched,
    nodes.map((node) => node.id),
    slotAdjacency,
    edges,
  );
  return new Map(nodes.map((node, i) => [node.id, { ...slots[swapped[i]!]!.site }]));
}

/** Solve one capacity layout to (near) convergence synchronously. */
export function solveLevel(layout: CapacityLayoutState): CapacityLayoutState {
  let current = layout;
  for (let i = 0; i < LEVEL_MAX_STEPS && !isConverged(current, LEVEL_CONVERGENCE); i++) {
    current = capacityStep(current);
  }
  return current;
}

/** Leaves of every group (transitively), in graph order. */
function leavesOfGroups(graph: AtlasGraph, tree: LevelTree): Map<string, AtlasNode[]> {
  const leavesOf = new Map<string, AtlasNode[]>();
  for (const leaf of graph.nodes) {
    let current = tree.parentOf.get(leaf.id) ?? null;
    while (current != null) {
      const members = leavesOf.get(current);
      if (members) members.push(leaf);
      else leavesOf.set(current, [leaf]);
      current = tree.parentOf.get(current) ?? null;
    }
  }
  return leavesOf;
}

/**
 * Descend the boundary levels below the (already laid out) top level.
 * `topClips` maps each top group to the region its interior may use —
 * an inset treemap cell or a ring circle.
 */
export function subdivideUnder(
  graph: AtlasGraph,
  tree: LevelTree,
  topClips: ReadonlyMap<string, ClipRegion>,
  canvas: ClipRegion,
  options: SolverOptions,
): Subdivision {
  const solver = {
    seed: options.seed,
    adaptationRate: options.adaptationRate,
    lloydRate: options.lloydRate,
  };
  const leavesOf = leavesOfGroups(graph, tree);

  // One global force pass over ALL leaves with ALL edges: cross-boundary
  // springs act while the projection keeps every leaf in its top region.
  const regions = new Map<string, Ring>();
  for (const [groupId, clip] of topClips) {
    const ring = clipToRing(clip, CIRCLE_SEGMENTS);
    if (ring.length < 3) continue;
    for (const leaf of leavesOf.get(groupId) ?? []) {
      regions.set(leaf.id, ring);
    }
  }
  const leafHints = embedSeedHints(graph, canvas);
  let force = createForceLayout(
    graph.nodes.map((node) => ({
      id: node.id,
      weight: node.metrics.loc,
      hint: leafHints?.get(node.id),
    })),
    graph.edges,
    canvas,
    { seed: options.seed, regions },
  );
  const iterations = leafHints
    ? DECLUMP_ITERATIONS
    : constrainedForceIterations(graph.nodes.length);
  for (let i = 0; i < iterations; i++) force = forceStep(force);

  // Intermediate boundary levels: subdivide each parent region by its
  // child groups. Similarity of a child group = centroid of its member
  // leaves' force positions, so districts inherit the global structure.
  const innerLevels: SubdivisionLevel[] = [];
  let parentClips: ReadonlyMap<string, ClipRegion> = topClips;
  for (let k = 1; k < tree.levels.length; k++) {
    const cells = new Map<string, CellResult>();
    const nextClips = new Map<string, ClipRegion>();
    for (const [parentId, parentClip] of parentClips) {
      const children = tree.childrenOf.get(parentId) ?? [];
      if (children.length === 0) continue;
      const similarity = new Map<string, Vec2>();
      for (const child of children) {
        let x = 0;
        let y = 0;
        let count = 0;
        for (const member of leavesOf.get(child.id) ?? []) {
          const p = force.positions.get(member.id);
          if (!p) continue;
          x += p.x;
          y += p.y;
          count++;
        }
        if (count > 0) similarity.set(child.id, { x: x / count, y: y / count });
      }
      const slotHints = assignedSlotHints(
        children,
        tree.innerEdgesOf.get(parentId) ?? [],
        parentClip,
        similarity,
        options.seed,
      );
      const layout = solveLevel(
        createCapacityLayout(
          children.map((child) => ({
            id: child.id,
            weight: child.metrics.loc,
            hint: slotHints?.get(child.id) ?? similarity.get(child.id),
          })),
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
    innerLevels.push({
      kind: tree.levels[k]!.kind,
      cells,
      edges: tree.levels[k]!.edges,
    });
    parentClips = nextClips;
  }

  return {
    innerLevels,
    leafClips: new Map(parentClips),
    positions: force.positions,
  };
}

/**
 * Seed one innermost group's leaf layout: equal-area CVT slots + optimal
 * assignment + adjacency swaps place the leaves so that dependencies share
 * borders, then the (caller-stepped) melt grows cells to their areas.
 */
export function seedLeafLayout(
  leaves: readonly AtlasNode[],
  edges: readonly AtlasEdge[],
  clip: ClipRegion,
  similarity: ReadonlyMap<string, Vec2>,
  options: SolverOptions,
): CapacityLayoutState {
  const slotHints = assignedSlotHints(leaves, edges, clip, similarity, options.seed);
  return createCapacityLayout(
    leaves.map((leaf) => ({
      id: leaf.id,
      weight: leaf.metrics.loc,
      hint: slotHints?.get(leaf.id) ?? similarity.get(leaf.id),
    })),
    clip,
    {
      seed: options.seed,
      adaptationRate: options.adaptationRate,
      lloydRate: options.lloydRate,
    },
  );
}
