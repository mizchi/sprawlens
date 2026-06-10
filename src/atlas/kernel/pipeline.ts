import { locScorer, type AtlasGraph, type WeightScorer } from "../contracts/graph.js";
import {
  createCapacityLayout,
  type CapacityLayoutState,
  type CapacityOptions,
} from "./capacityLayout.js";
import type { ClipRegion } from "./clip.js";
import { createForceLayout, forceStep } from "./forceLayout.js";

export type GraphLayoutOptions = CapacityOptions & {
  /** Force iterations used to derive initial site positions. */
  forceIterations?: number;
  /** Weight derivation; defaults to LOC. */
  scorer?: WeightScorer;
};

/**
 * graph → force-directed seeding → capacity-constrained power diagram.
 * The returned state is iterated with `capacityStep` (e.g. inside rAF).
 */
export function createGraphLayout(
  graph: AtlasGraph,
  clip: ClipRegion,
  options?: GraphLayoutOptions,
): CapacityLayoutState {
  const { forceIterations = 200, scorer = locScorer, ...capacity } = options ?? {};
  const weights = scorer(graph);
  const forceNodes = graph.nodes.map((node) => ({
    id: node.id,
    weight: weights.get(node.id) ?? 0,
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
