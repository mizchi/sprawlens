import { locScorer, type AtlasGraph, type WeightScorer } from "../contracts/graph.js";
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

/**
 * Multilevel seeding (the FM³ idea with communities as the coarse graph):
 * embed the aggregated community graph first, init every member at its
 * community's position, then refine with the full embedding. Clusters end
 * up spatially contiguous, which the boundary rendering depends on.
 */
const GOLDEN_ANGLE = 2.399963229728653;

export function clusteredSeedHints(
  graph: AtlasGraph,
  clip: ClipRegion,
  communityOf: ReadonlyMap<string, number>,
): Map<string, Vec2> | null {
  const n = graph.nodes.length;
  if (n === 0) return null;
  // aggregated community graph, edge weight = inter-community link count
  const communityIds = [...new Set(communityOf.values())].sort(
    (a, b) => a - b,
  );
  const linkWeights = new Map<string, number>();
  for (const edge of graph.edges) {
    const a = communityOf.get(edge.source);
    const b = communityOf.get(edge.target);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a} ${b}` : `${b} ${a}`;
    linkWeights.set(key, (linkWeights.get(key) ?? 0) + 1);
  }
  const communityPos = embedGraph(
    communityIds.map(String),
    [...linkWeights.entries()].map(([key, weight]) => {
      const [a, b] = key.split(" ");
      return { source: a!, target: b!, weight };
    }),
    { iterations: 200 },
  );
  const centroidOf = (id: string): Vec2 | undefined => {
    const c = communityOf.get(id);
    return c === undefined ? undefined : communityPos.get(String(c));
  };

  if (n <= EMBED_NODE_CAP) {
    // small enough: centroid-initialized full embedding refines locally
    const hints = new Map<string, Vec2>();
    for (const node of graph.nodes) {
      const pos = centroidOf(node.id);
      if (pos) hints.set(node.id, pos);
    }
    const positions = embedGraph(
      graph.nodes.map((node) => node.id),
      graph.edges,
      { iterations: embedIterationsFor(n), hints },
    );
    return mapToClip(positions, clip);
  }

  // too big for the O(n²) embedding: sunflower-pack each community's
  // members around its centroid instead — clusters stay contiguous at
  // any node count, and the capacity solver resolves the local detail
  const memberCount = new Map<number, number>();
  for (const c of communityOf.values()) {
    memberCount.set(c, (memberCount.get(c) ?? 0) + 1);
  }
  const placed = new Map<number, number>();
  const positions = new Map<string, Vec2>();
  for (const node of graph.nodes) {
    const c = communityOf.get(node.id);
    const centroid = centroidOf(node.id);
    if (c === undefined || !centroid) continue;
    const k = placed.get(c) ?? 0;
    placed.set(c, k + 1);
    const count = memberCount.get(c)!;
    // community disc radius ∝ sqrt(member share) in the RMS-1 frame
    const radius = Math.sqrt(count / n) * 0.8;
    const r = radius * Math.sqrt((k + 0.5) / count);
    const theta = k * GOLDEN_ANGLE;
    positions.set(node.id, {
      x: centroid.x + Math.cos(theta) * r,
      y: centroid.y + Math.sin(theta) * r,
    });
  }
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
