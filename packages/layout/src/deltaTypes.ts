import type { AtlasEdge } from "@sprawlens/contracts";
import type { Vec2 } from "./vec.ts";

/** Weights and step sizes for the delta-aware multi-objective refinement. */
export type DeltaGuidanceOptions = {
  /** Attraction applied to dependency pairs that do not share a cell border. */
  dependencyRate?: number;
  /** Pull surviving nodes back toward their pre-delta positions. */
  temporalRate?: number;
  /** Graph hops around a changed node allowed to move freely. */
  localityRadius?: number;
  areaWeight?: number;
  adjacencyWeight?: number;
  stabilityWeight?: number;
  /** Continuous edge-length term used until a discrete adjacency is formed. */
  proximityWeight?: number;
  /** Do not perturb topology until the capacity solve is close to its areas. */
  activationAreaError?: number;
  /** Capacity repair steps evaluated after each dependency-force proposal. */
  repairSteps?: number;
  minGuidedSteps?: number;
  maxGuidedSteps?: number;
  stallSteps?: number;
  improvementEpsilon?: number;
  /** Explicit temporal anchors; normally captured automatically on a delta. */
  anchors?: ReadonlyMap<string, Vec2>;
  /** Nodes directly changed by the delta. */
  changedIds?: ReadonlySet<string>;
};

export type ResolvedDeltaGuidanceOptions = Required<
  Omit<DeltaGuidanceOptions, "anchors" | "changedIds">
>;

/** Solver metadata carried with a CapacityLayoutState. */
export type DeltaGuidance = {
  edges: AtlasEdge[];
  anchors: Map<string, Vec2>;
  changedIds: Set<string>;
  options: ResolvedDeltaGuidanceOptions;
  guidedSteps: number;
  stalledSteps: number;
  lastObjective: number;
};

export type DeltaObjective = {
  meanAreaError: number;
  maxAreaError: number;
  dependencyAdjacency: number;
  adjacencyLoss: number;
  /** Mean dependency-site distance normalized by the clip scale. */
  normalizedEdgeLength: number;
  /** Mean surviving-site displacement normalized by the clip scale. */
  normalizedDisplacement: number;
  total: number;
};
