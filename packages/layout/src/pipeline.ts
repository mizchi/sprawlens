import { locScorer, type AtlasGraph, type WeightScorer } from "@sprawlens/schema";
import {
  createCapacityLayout,
  type CapacityLayoutState,
  type CapacityOptions,
} from "./capacityLayout.js";
import { clampInto, clipCenter, clipScale, type ClipRegion } from "./clip.js";
import { embedGraph } from "./embed.js";
import { createForceLayout, forceStep } from "./forceLayout.js";
import type { Vec2 } from "./vec.js";

export type GraphLayoutOptions = CapacityOptions & {
  /** Force iterations used to derive initial site positions. */
  forceIterations?: number;
  /** Weight derivation; defaults to LOC. */
  scorer?: WeightScorer;
  /**
   * Pre-computed seed positions (e.g., `embedSeedHints`). Force then only
   * declumps locally instead of discovering the global structure.
   */
  hints?: ReadonlyMap<string, Vec2>;
};

/**
 * Embedding cost is O(n²) per iteration, so the budget shrinks with node
 * count; the embedding is a seed, the capacity solver owns final geometry.
 */
export function embedIterationsFor(nodeCount: number): number {
  if (nodeCount === 0) return 0;
  return Math.max(
    30,
    Math.min(200, Math.floor(20_000_000 / (nodeCount * nodeCount))),
  );
}

/**
 * Force seeding is O(n²) per iteration too — without a budget a few
 * thousand nodes freeze the page for seconds. Seeding quality only
 * matters loosely, the capacity solver owns the final geometry.
 */
export function forceIterationsFor(nodeCount: number): number {
  if (nodeCount === 0) return 0;
  return Math.max(
    4,
    Math.min(80, Math.floor(2_000_000 / (nodeCount * nodeCount))),
  );
}

/** Above this the O(n²) embedding setup itself gets too slow; use force. */
const EMBED_NODE_CAP = 800;

/**
 * Deterministic seed positions from the neighborhood-preserving embedding,
 * mapped into the clip region. Returns null when the graph is empty or too
 * large for the O(n²) embedding (callers fall back to force seeding).
 */
export function embedSeedHints(
  graph: AtlasGraph,
  clip: ClipRegion,
): Map<string, Vec2> | null {
  const n = graph.nodes.length;
  if (n === 0 || n > EMBED_NODE_CAP) return null;
  const positions = embedGraph(
    graph.nodes.map((node) => node.id),
    graph.edges,
    { iterations: embedIterationsFor(n) },
  );
  return mapToClip(positions, clip);
}

/** Embedding space is centered with RMS radius 1; place that radius at
 * ~30% of the clip extent and clamp outliers inside. */
function mapToClip(
  positions: ReadonlyMap<string, Vec2>,
  clip: ClipRegion,
): Map<string, Vec2> {
  const center = clipCenter(clip);
  const scale = clipScale(clip) * 0.3;
  const mapped = new Map<string, Vec2>();
  for (const [id, p] of positions) {
    mapped.set(
      id,
      clampInto(clip, { x: center.x + p.x * scale, y: center.y + p.y * scale }),
    );
  }
  return mapped;
}

/**
 * graph → force-directed seeding → capacity-constrained power diagram.
 * The returned state is iterated with `capacityStep` (e.g. inside rAF).
 */
export function createGraphLayout(
  graph: AtlasGraph,
  clip: ClipRegion,
  options?: GraphLayoutOptions,
): CapacityLayoutState {
  // with explicit hints, force only declumps — long runs would erase the
  // structure the embedding provided
  const {
    forceIterations = options?.hints ? 16 : 200,
    scorer = locScorer,
    hints,
    ...capacity
  } = options ?? {};
  const weights = scorer(graph);
  const forceNodes = graph.nodes.map((node) => ({
    id: node.id,
    weight: weights.get(node.id) ?? 0,
    hint: hints?.get(node.id),
  }));
  let force = createForceLayout(forceNodes, graph.edges, clip, {
    seed: capacity.seed,
  });
  for (let i = 0; i < forceIterations; i++) {
    force = forceStep(force);
  }
  const cellNodes = graph.nodes.map((node) => ({
    id: node.id,
    weight: weights.get(node.id) ?? 0,
    hint: force.positions.get(node.id),
  }));
  return createCapacityLayout(cellNodes, clip, capacity);
}
