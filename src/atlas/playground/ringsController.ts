import type { AtlasEdge, AtlasGraph } from "../contracts/graph.js";
import { deriveModules } from "../contracts/modules.js";
import {
  applyGraphChanges,
  capacityStep,
  isConverged,
  type CapacityLayoutState,
} from "../kernel/capacityLayout.js";
import { createGraphLayout } from "../kernel/pipeline.js";
import { ringLayout, type PlacedCircle } from "../kernel/ringLayout.js";
import { topoRank } from "../kernel/topoRank.js";

export type RingsOptions = {
  width: number;
  height: number;
  seed: number;
  invert?: boolean;
  adaptationRate?: number;
  lloydRate?: number;
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
  const derived = deriveModules(graph);
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
      createGraphLayout(
        {
          nodes: files,
          edges: base.fileEdgesByModule.get(moduleId) ?? [],
        },
        { kind: "circle", cx: circle.cx, cy: circle.cy, r: circle.r * CLIP_INSET },
        {
          seed: options.seed,
          adaptationRate: options.adaptationRate,
          lloydRate: options.lloydRate,
          forceIterations: 80,
        },
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
        createGraphLayout(
          { nodes: files, edges: base.fileEdgesByModule.get(moduleId) ?? [] },
          clip,
          {
            seed: options.seed,
            adaptationRate: options.adaptationRate,
            lloydRate: options.lloydRate,
            forceIterations: 80,
          },
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
