import type { AtlasEdge, AtlasGraph } from "../contracts/graph.js";
import { deriveModules, type ModuleIdOf } from "../contracts/modules.js";
import {
  applyGraphChanges,
  capacityStep,
  isConverged,
  type CapacityLayoutState,
} from "../kernel/capacityLayout.js";
import {
  createGraphLayout,
  embedSeedHints,
  forceIterationsFor,
} from "../kernel/pipeline.js";
import { ringLayout, type PlacedCircle } from "../kernel/ringLayout.js";
import { topoRank } from "../kernel/topoRank.js";

export type RingsOptions = {
  width: number;
  height: number;
  seed: number;
  invert?: boolean;
  adaptationRate?: number;
  lloydRate?: number;
  /** Node → module assignment; defaults to the path heuristic. */
  moduleIdOf?: ModuleIdOf;
};

export type RingsState = {
  /** Module circles in viewport pixels. */
  circles: Map<string, PlacedCircle>;
  moduleLayouts: Map<string, CapacityLayoutState>;
  moduleEdges: AtlasEdge[];
  ranks: Map<string, number>;
};

const CONVERGENCE = 0.005;
const CLIP_INSET = 0.94;

/** When the embedding provides the structure, force only declumps. */
const DECLUMP_ITERATIONS = 16;

/**
 * Cold per-module layout: deterministic embedding seeds when the module is
 * small enough, force fallback above the cap. With embedding seeds the
 * layout no longer depends on the seed parameter at all.
 */
function createModuleLayout(
  files: AtlasGraph["nodes"],
  edges: AtlasEdge[],
  clip: { kind: "circle"; cx: number; cy: number; r: number },
  options: RingsOptions,
): CapacityLayoutState {
  const graph = { nodes: files, edges };
  const hints = embedSeedHints(graph, clip);
  return createGraphLayout(graph, clip, {
    seed: options.seed,
    adaptationRate: options.adaptationRate,
    lloydRate: options.lloydRate,
    hints: hints ?? undefined,
    forceIterations: hints
      ? Math.min(DECLUMP_ITERATIONS, forceIterationsFor(files.length))
      : forceIterationsFor(files.length),
  });
}

function placeCircles(
  graph: AtlasGraph,
  options: RingsOptions,
): {
  circles: Map<string, PlacedCircle>;
  moduleEdges: AtlasEdge[];
  ranks: Map<string, number>;
  filesByModule: ReturnType<typeof deriveModules>["filesByModule"];
  fileEdgesByModule: ReturnType<typeof deriveModules>["fileEdgesByModule"];
} {
  const derived = deriveModules(graph, options.moduleIdOf);
  const ranks = topoRank(
    derived.modules.map((m) => m.id),
    derived.moduleEdges,
  );
  const placed = ringLayout(
    derived.modules.map((m) => ({
      id: m.id,
      area: m.metrics.loc,
      rank: ranks.get(m.id) ?? 0,
    })),
    derived.moduleEdges,
    { invert: options.invert },
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
  return {
    circles,
    moduleEdges: derived.moduleEdges,
    ranks,
    filesByModule: derived.filesByModule,
    fileEdgesByModule: derived.fileEdgesByModule,
  };
}

export function createRingsState(
  graph: AtlasGraph,
  options: RingsOptions,
): RingsState {
  const base = placeCircles(graph, options);
  const moduleLayouts = new Map<string, CapacityLayoutState>();
  for (const [moduleId, circle] of base.circles) {
    const files = base.filesByModule.get(moduleId) ?? [];
    moduleLayouts.set(
      moduleId,
      createModuleLayout(
        files,
        base.fileEdgesByModule.get(moduleId) ?? [],
        { kind: "circle", cx: circle.cx, cy: circle.cy, r: circle.r * CLIP_INSET },
        options,
      ),
    );
  }
  return {
    circles: base.circles,
    moduleLayouts,
    moduleEdges: base.moduleEdges,
    ranks: base.ranks,
  };
}

/** Advance unconverged module layouts; active=false once everything settled. */
export function stepRingsState(
  state: RingsState,
  stepsPerFrame: number,
): { state: RingsState; active: boolean } {
  let active = false;
  let moduleLayouts: Map<string, CapacityLayoutState> | null = null;
  for (const [moduleId, layout] of state.moduleLayouts) {
    if (isConverged(layout, CONVERGENCE)) continue;
    active = true;
    let next = layout;
    for (let i = 0; i < stepsPerFrame; i++) next = capacityStep(next);
    if (!moduleLayouts) moduleLayouts = new Map(state.moduleLayouts);
    moduleLayouts.set(moduleId, next);
  }
  return {
    state: moduleLayouts ? { ...state, moduleLayouts } : state,
    active,
  };
}

/**
 * Warm-start after the graph changed: modules are re-derived and re-placed,
 * existing module layouts keep their sites via applyGraphChanges (new clip,
 * refreshed weights, removed files dropped); brand-new modules start cold.
 */
export function applyRingsChanges(
  state: RingsState,
  graph: AtlasGraph,
  options: RingsOptions,
): RingsState {
  const base = placeCircles(graph, options);
  const moduleLayouts = new Map<string, CapacityLayoutState>();
  for (const [moduleId, circle] of base.circles) {
    const files = base.filesByModule.get(moduleId) ?? [];
    const clip = {
      kind: "circle" as const,
      cx: circle.cx,
      cy: circle.cy,
      r: circle.r * CLIP_INSET,
    };
    const existing = state.moduleLayouts.get(moduleId);
    if (!existing) {
      moduleLayouts.set(
        moduleId,
        createModuleLayout(
          files,
          base.fileEdgesByModule.get(moduleId) ?? [],
          clip,
          options,
        ),
      );
      continue;
    }
    const fileIds = new Set(files.map((f) => f.id));
    const remove = existing.cells
      .map((c) => c.id)
      .filter((id) => !fileIds.has(id));
    moduleLayouts.set(
      moduleId,
      applyGraphChanges(existing, {
        clip,
        upsert: files.map((f) => ({ id: f.id, weight: f.metrics.loc })),
        remove,
      }),
    );
  }
  return {
    circles: base.circles,
    moduleLayouts,
    moduleEdges: base.moduleEdges,
    ranks: base.ranks,
  };
}
