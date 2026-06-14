import type { AtlasGraph } from "../contracts/graph.js";
import { defaultLayerOf } from "../contracts/layers.js";
import { circleToPolygon } from "../kernel/polygon.js";
import type { Vec2 } from "../kernel/vec.js";
import { ringPlane, type PlacedNode } from "./planeLayers.ts";
import { createRingsState, stepRingsState } from "./ringsController.ts";
import type { ExternalDep } from "./fixtureAdapter.ts";

/**
 * A solved stacked plane: source is plane 0 (rendered rich by the map itself),
 * the satellites (tests, deps, ...) are plane 1+. Every layer reduces to the
 * same shape — placed Voronoi/ring nodes, optional district outlines, a plane
 * index and a tint — so the renderer treats them uniformly and new layers are
 * a matter of adding one builder, not a new code path.
 */
export type SolvedLayer = {
  id: string;
  /** Stacking index below the source plane (1 = first satellite). */
  planeIndex: number;
  placed: PlacedNode[];
  /** Intermediate boundary (module) outlines for the layer's own layout. */
  districts: Vec2[][];
  extent: { w: number; h: number };
};

const SOLVER = {
  seed: 1,
  adaptationRate: 0.8,
  lloydRate: 0.7,
};

/** Concentric-ring layout of the test files — the same engine as the source
 * map — modules as rings, files as weighted cells inside. Cross-plane links
 * follow the real test→source imports. */
function solveTestLayer(
  graph: AtlasGraph,
  ext: { width: number; height: number },
  labelOf: (id: string) => string,
  planeIndex: number,
): SolvedLayer | null {
  const testNodes = graph.nodes.filter((n) => defaultLayerOf(n.id) === "test");
  if (testNodes.length === 0) return null;
  const testIds = new Set(testNodes.map((n) => n.id));
  const testEdges = graph.edges.filter(
    (e) => testIds.has(e.source) && testIds.has(e.target),
  );
  let state = createRingsState(
    { nodes: testNodes, edges: testEdges },
    { width: ext.width, height: ext.height, ...SOLVER },
  );
  for (let i = 0; i < 200; i++) {
    const stepped = stepRingsState(state, 6);
    state = stepped.state;
    if (!stepped.active) break;
  }
  const importsBy = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!testIds.has(e.source) || testIds.has(e.target)) continue;
    let set = importsBy.get(e.source);
    if (!set) importsBy.set(e.source, (set = new Set()));
    set.add(e.target);
  }
  const placed: PlacedNode[] = [];
  for (const layout of state.leafLayouts.values())
    for (const c of layout.cells) {
      if (c.polygon.length < 3) continue;
      placed.push({
        id: c.id,
        label: labelOf(c.id),
        site: c.site,
        polygon: c.polygon,
        sourceIds: [...(importsBy.get(c.id) ?? [])],
      });
    }
  // districts trace the module circles and any inner boundary cells
  const districts: Vec2[][] = [];
  for (const circle of state.circles.values())
    districts.push(
      circleToPolygon({ cx: circle.cx, cy: circle.cy, r: circle.r }, 48),
    );
  for (const level of state.innerLevels)
    for (const c of level.cells.values())
      if (c.polygon.length >= 3) districts.push(c.polygon);
  return {
    id: "tests",
    planeIndex,
    placed,
    districts,
    extent: { w: ext.width, h: ext.height },
  };
}

/** External packages on concentric rings, rank/size by how depended-upon they
 * are (their importer count); cross-plane links go to every importer. */
function solveDepLayer(
  externalDeps: readonly ExternalDep[],
  ext: { width: number; height: number },
  planeIndex: number,
): SolvedLayer | null {
  if (externalDeps.length === 0) return null;
  const byPkg = new Map<string, string[]>();
  for (const { source, specifier } of externalDeps) {
    const list = byPkg.get(specifier);
    if (list) list.push(source);
    else byPkg.set(specifier, [source]);
  }
  const placed = ringPlane(
    [...byPkg].map(([spec, srcs]) => ({
      id: `external:${spec}`,
      label: spec,
      weight: srcs.length,
      sourceIds: srcs,
    })),
    { w: ext.width, h: ext.height },
  );
  if (placed.length === 0) return null;
  return {
    id: "deps",
    planeIndex,
    placed,
    districts: [],
    extent: { w: ext.width, h: ext.height },
  };
}

/**
 * Build the enabled satellite layers in stacking order. Each toggle adds the
 * next plane index; adding a new layer type means one more builder call here.
 */
export function buildSatelliteLayers(opts: {
  showTests: boolean;
  showDeps: boolean;
  graph: AtlasGraph;
  externalDeps: readonly ExternalDep[];
  ext: { width: number; height: number };
  labelOf: (id: string) => string;
}): SolvedLayer[] {
  const layers: SolvedLayer[] = [];
  let index = 1;
  if (opts.showTests) {
    const layer = solveTestLayer(opts.graph, opts.ext, opts.labelOf, index);
    if (layer) {
      layers.push(layer);
      index++;
    }
  }
  if (opts.showDeps) {
    const layer = solveDepLayer(opts.externalDeps, opts.ext, index);
    if (layer) {
      layers.push(layer);
      index++;
    }
  }
  return layers;
}
