import type { AtlasEdge, AtlasGraph } from "../contracts/graph.js";
import { deriveModules, type ModuleIdOf } from "../contracts/modules.js";
import {
  capacityStep,
  createCapacityLayout,
  isConverged,
  type CapacityLayoutState,
  type CellResult,
} from "../kernel/capacityLayout.js";
import { createForceLayout, forceStep } from "../kernel/forceLayout.js";
import {
  createGraphLayout,
  embedSeedHints,
  forceIterationsFor,
} from "../kernel/pipeline.js";
import { centroid, type Ring } from "../kernel/polygon.js";

/**
 * Full-canvas Voronoi treemap (expert-suggested layout): module cells tile
 * the viewport as a capacity-constrained power diagram, files are placed by
 * ONE global force simulation whose nodes are confined to their module cell
 * (projected gradient), so cross-module dependencies still pull linked files
 * toward shared borders. File cells then subdivide each module cell.
 */

export type TreemapOptions = {
  width: number;
  height: number;
  seed: number;
  adaptationRate?: number;
  lloydRate?: number;
  /** Node → module assignment; defaults to the path heuristic. */
  moduleIdOf?: ModuleIdOf;
};

export type TreemapState = {
  /** Converged top-level module cells keyed by module id. */
  moduleCells: Map<string, CellResult>;
  fileLayouts: Map<string, CapacityLayoutState>;
  moduleEdges: AtlasEdge[];
  /** file → module, module → null; feeds hierarchical edge bundling. */
  parentOf: Map<string, string | null>;
};

const MODULE_CONVERGENCE = 0.01;
const FILE_CONVERGENCE = 0.005;
const MODULE_MAX_STEPS = 240;
/** Gutter between a module border and its file cells. */
const FILE_INSET = 0.96;
/** When the embedding provides the structure, force only declumps. */
const DECLUMP_ITERATIONS = 16;

function insetRing(ring: Ring, factor: number): Ring {
  const c = centroid(ring);
  return ring.map((p) => ({
    x: c.x + (p.x - c.x) * factor,
    y: c.y + (p.y - c.y) * factor,
  }));
}

/**
 * The constrained file force is O(n²) per iteration; give it more budget
 * than plain seeding (it carries the cross-module structure) but keep
 * monorepo-scale graphs from blocking the build for seconds.
 */
function constrainedForceIterations(nodeCount: number): number {
  if (nodeCount === 0) return 0;
  return Math.max(8, Math.min(60, Math.floor(8_000_000 / (nodeCount * nodeCount))));
}

export function createTreemapState(
  graph: AtlasGraph,
  options: TreemapOptions,
): TreemapState {
  const derived = deriveModules(graph, options.moduleIdOf);
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

  // Top level: modules tile the viewport; small n, solved at creation so the
  // nested layouts start from stable parent geometry.
  const moduleGraph = { nodes: derived.modules, edges: derived.moduleEdges };
  const moduleHints = embedSeedHints(moduleGraph, clip);
  let moduleLayout = createGraphLayout(moduleGraph, clip, {
    ...solver,
    hints: moduleHints ?? undefined,
    forceIterations: moduleHints
      ? DECLUMP_ITERATIONS
      : forceIterationsFor(derived.modules.length),
  });
  for (
    let i = 0;
    i < MODULE_MAX_STEPS && !isConverged(moduleLayout, MODULE_CONVERGENCE);
    i++
  ) {
    moduleLayout = capacityStep(moduleLayout);
  }
  const moduleCells = new Map(moduleLayout.cells.map((c) => [c.id, c]));

  // Hierarchy + per-file confinement region (the inset module polygon).
  const parentOf = new Map<string, string | null>();
  const regions = new Map<string, Ring>();
  for (const module of derived.modules) parentOf.set(module.id, null);
  for (const [moduleId, files] of derived.filesByModule) {
    const cell = moduleCells.get(moduleId);
    if (!cell || cell.polygon.length < 3) continue;
    const region = insetRing(cell.polygon, FILE_INSET);
    for (const file of files) {
      parentOf.set(file.id, moduleId);
      regions.set(file.id, region);
    }
  }

  // One global force pass over ALL files with ALL edges: cross-module
  // springs act while the projection keeps every file in its module.
  const fileHints = embedSeedHints(graph, clip);
  const forceNodes = graph.nodes.map((node) => ({
    id: node.id,
    weight: node.metrics.loc,
    hint: fileHints?.get(node.id),
  }));
  let force = createForceLayout(forceNodes, graph.edges, clip, {
    seed: options.seed,
    regions,
  });
  const iterations = fileHints
    ? DECLUMP_ITERATIONS
    : constrainedForceIterations(graph.nodes.length);
  for (let i = 0; i < iterations; i++) force = forceStep(force);

  // Bottom level: capacity subdivision of each module cell, seeded with the
  // constrained force positions.
  const fileLayouts = new Map<string, CapacityLayoutState>();
  for (const [moduleId, files] of derived.filesByModule) {
    const cell = moduleCells.get(moduleId);
    if (!cell || cell.polygon.length < 3 || files.length === 0) continue;
    fileLayouts.set(
      moduleId,
      createCapacityLayout(
        files.map((file) => ({
          id: file.id,
          weight: file.metrics.loc,
          hint: force.positions.get(file.id),
        })),
        { kind: "polygon", ring: insetRing(cell.polygon, FILE_INSET) },
        solver,
      ),
    );
  }

  return {
    moduleCells,
    fileLayouts,
    moduleEdges: derived.moduleEdges,
    parentOf,
  };
}

/** Advance unconverged file layouts; active=false once everything settled. */
export function stepTreemapState(
  state: TreemapState,
  stepsPerFrame: number,
): { state: TreemapState; active: boolean } {
  let active = false;
  let fileLayouts: Map<string, CapacityLayoutState> | null = null;
  for (const [moduleId, layout] of state.fileLayouts) {
    if (isConverged(layout, FILE_CONVERGENCE)) continue;
    active = true;
    let next = layout;
    for (let i = 0; i < stepsPerFrame; i++) next = capacityStep(next);
    if (!fileLayouts) fileLayouts = new Map(state.fileLayouts);
    fileLayouts.set(moduleId, next);
  }
  return {
    state: fileLayouts ? { ...state, fileLayouts } : state,
    active,
  };
}
