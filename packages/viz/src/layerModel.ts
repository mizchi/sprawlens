import type {
  AtlasGraph,
  LayerLayout,
  LayerManifestEntry,
  TestNode,
  TestTree,
} from "@sprawlens/schema";
import { layerOfNode } from "@sprawlens/schema";
import { circleToPolygon, squarify, type Rect } from "@sprawlens/layout";
import type { Vec2 } from "@sprawlens/layout";
import { capacityPlane, ringPlane, type PlacedNode } from "./planeLayers.ts";
import { createRingsState, stepRingsState } from "./ringsController.ts";
import type { ExternalDep } from "@sprawlens/schema";

/**
 * A solved stacked plane: source is plane 0 (rendered rich by the map itself),
 * the satellites (test, deps, docs, ...) are plane 1+. Every layer reduces to
 * the same shape — placed Voronoi/ring nodes, optional district outlines, a
 * plane index — so the renderer treats them uniformly. Which layers exist and
 * how each is laid out comes from the LayerManifest (sprawlens.toml), not a
 * hardcoded list: a custom layer is data, not a new code path.
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

/** Cross-plane links: edges from a layer's nodes to nodes outside it (the
 * source files a test/doc references). */
function outboundLinks(
  graph: AtlasGraph,
  ids: ReadonlySet<string>,
): Map<string, Set<string>> {
  const importsBy = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!ids.has(e.source) || ids.has(e.target)) continue;
    let set = importsBy.get(e.source);
    if (!set) importsBy.set(e.source, (set = new Set()));
    set.add(e.target);
  }
  return importsBy;
}

/**
 * Lay out the files stamped with `layerName` on their own plane. "rings" runs
 * the same module-grouped engine as the source map (modules as rings, files as
 * weighted cells); "capacity" packs them as a flat capacity Voronoi. Cross-plane
 * links follow the real layer→source imports.
 */
function solveNodeLayer(
  graph: AtlasGraph,
  layerName: string,
  ext: { width: number; height: number },
  labelOf: (id: string) => string,
  planeIndex: number,
  layout: LayerLayout,
): SolvedLayer | null {
  const nodes = graph.nodes.filter((n) => layerOfNode(n) === layerName);
  if (nodes.length === 0) return null;
  const ids = new Set(nodes.map((n) => n.id));
  const importsBy = outboundLinks(graph, ids);

  if (layout === "capacity") {
    const placed = capacityPlane(
      nodes.map((n) => ({
        id: n.id,
        label: labelOf(n.id),
        weight: Math.max(n.metrics.loc, 1),
        sourceIds: [...(importsBy.get(n.id) ?? [])],
      })),
      { w: ext.width, h: ext.height },
    );
    if (placed.length === 0) return null;
    return { id: layerName, planeIndex, placed, districts: [], extent: { w: ext.width, h: ext.height } };
  }

  // rings: module-grouped concentric layout, same as the source map
  const layerEdges = graph.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  );
  let state = createRingsState(
    { nodes, edges: layerEdges },
    { width: ext.width, height: ext.height, ...SOLVER },
  );
  for (let i = 0; i < 200; i++) {
    const stepped = stepRingsState(state, 6);
    state = stepped.state;
    if (!stepped.active) break;
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
  const districts: Vec2[][] = [];
  for (const circle of state.circles.values())
    districts.push(circleToPolygon({ cx: circle.cx, cy: circle.cy, r: circle.r }, 48));
  for (const level of state.innerLevels)
    for (const c of level.cells.values())
      if (c.polygon.length >= 3) districts.push(c.polygon);
  if (placed.length === 0) return null;
  return { id: layerName, planeIndex, placed, districts, extent: { w: ext.width, h: ext.height } };
}

/**
 * A deps-style plane: external packages on concentric rings, ranked by how
 * depended-upon they are (importer count), plus any local files stamped with
 * this layer (e.g. vendored code routed here by a glob). Cross-plane links go
 * to every importer / referenced source file.
 */
function solveDepLayer(
  layerName: string,
  externalDeps: readonly ExternalDep[],
  graph: AtlasGraph,
  ext: { width: number; height: number },
  labelOf: (id: string) => string,
  planeIndex: number,
): SolvedLayer | null {
  const byPkg = new Map<string, string[]>();
  for (const { source, specifier } of externalDeps) {
    const list = byPkg.get(specifier);
    if (list) list.push(source);
    else byPkg.set(specifier, [source]);
  }
  const localNodes = graph.nodes.filter((n) => layerOfNode(n) === layerName);
  const importsBy = outboundLinks(graph, new Set(localNodes.map((n) => n.id)));

  const input = [
    ...[...byPkg].map(([spec, srcs]) => ({
      id: `external:${spec}`,
      label: spec,
      weight: srcs.length,
      sourceIds: srcs,
    })),
    ...localNodes.map((n) => ({
      id: n.id,
      label: labelOf(n.id),
      weight: Math.max(n.metrics.loc, 1),
      sourceIds: [...(importsBy.get(n.id) ?? [])],
    })),
  ];
  if (input.length === 0) return null;
  const placed = ringPlane(input, { w: ext.width, h: ext.height });
  if (placed.length === 0) return null;
  return { id: layerName, planeIndex, placed, districts: [], extent: { w: ext.width, h: ext.height } };
}

/** Weight a test node by lines of code (cases) or by its subtree (suites). */
function testWeight(node: TestNode): number {
  if (node.children.length === 0) {
    const loc =
      node.startLine !== undefined && node.endLine !== undefined
        ? node.endLine - node.startLine + 1
        : 1;
    return Math.max(loc, 1);
  }
  return Math.max(
    node.children.reduce((sum, child) => sum + testWeight(child), 0),
    1,
  );
}

const rectPolygon = (r: Rect): Vec2[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];

/** Recursively treemap a test forest into `rect`: leaf cases become placed
 * cells, the dir/file/suite nodes that hold them become inset district
 * outlines, so the nesting reads as boxes-within-boxes. */
function layoutTestNodes(
  nodes: readonly TestNode[],
  rect: Rect,
  placed: PlacedNode[],
  districts: Vec2[][],
  coversOf?: ReadonlyMap<string, readonly string[]>,
): void {
  const tiles = squarify(
    nodes.map((node) => ({ id: node.id, weight: testWeight(node), node })),
    rect,
  );
  for (const tile of tiles) {
    const { node } = tile.item;
    const tileRect: Rect = { x: tile.x, y: tile.y, w: tile.w, h: tile.h };
    if (node.children.length === 0) {
      placed.push({
        id: node.id,
        label: node.name,
        site: { x: tile.x + tile.w / 2, y: tile.y + tile.h / 2 },
        polygon: rectPolygon(tileRect),
        // the source symbols this case exercised (per-test trace), so the
        // existing cross-layer ropes draw test → code on hover / selection
        sourceIds: [...(coversOf?.get(node.id) ?? [])],
      });
      continue;
    }
    districts.push(rectPolygon(tileRect));
    const pad = Math.min(tile.w, tile.h) * 0.06;
    layoutTestNodes(
      node.children,
      {
        x: tile.x + pad,
        y: tile.y + pad,
        w: Math.max(tile.w - pad * 2, 1),
        h: Math.max(tile.h - pad * 2, 1),
      },
      placed,
      districts,
      coversOf,
    );
  }
}

/**
 * Lay out the test-case tree as a nested treemap on its plane: directories,
 * files and suites are nested district boxes; the individual test cases are the
 * leaf cells (their names are what the plane shows). Replaces the file-granular
 * test plane when the analyzer extracted a case tree.
 */
function solveTestTree(
  tree: TestTree,
  ext: { width: number; height: number },
  planeIndex: number,
  coversOf?: ReadonlyMap<string, readonly string[]>,
): SolvedLayer | null {
  const placed: PlacedNode[] = [];
  const districts: Vec2[][] = [];
  layoutTestNodes(
    tree.root.children,
    { x: 0, y: 0, w: ext.width, h: ext.height },
    placed,
    districts,
    coversOf,
  );
  if (placed.length === 0) return null;
  return { id: "test", planeIndex, placed, districts, extent: { w: ext.width, h: ext.height } };
}

/**
 * Build the enabled satellite layers in manifest order. Each entry the user
 * enables adds the next plane index; `includeExternal` entries (deps) draw the
 * external-package ring, the rest lay out their stamped files. The `test` layer
 * deepens to a nested case treemap when a test tree is supplied. Driven by the
 * manifest — adding a layer in sprawlens.toml needs no code here.
 */
export function buildSatelliteLayers(opts: {
  manifest: readonly LayerManifestEntry[];
  enabled: ReadonlySet<string>;
  graph: AtlasGraph;
  externalDeps: readonly ExternalDep[];
  /** Test-case tree from the analyzer; deepens the test plane when present. */
  testTree?: TestTree | null;
  /** Per-test-case covered symbol ids (from a per-test trace); links each case
   * cell to the source it exercised. */
  coversOf?: ReadonlyMap<string, readonly string[]>;
  ext: { width: number; height: number };
  labelOf: (id: string) => string;
}): SolvedLayer[] {
  const layers: SolvedLayer[] = [];
  let index = 1;
  for (const entry of opts.manifest) {
    if (!opts.enabled.has(entry.name)) continue;
    const layer =
      entry.name === "test" && opts.testTree
        ? solveTestTree(opts.testTree, opts.ext, index, opts.coversOf)
        : entry.includeExternal
          ? solveDepLayer(entry.name, opts.externalDeps, opts.graph, opts.ext, opts.labelOf, index)
          : solveNodeLayer(opts.graph, entry.name, opts.ext, opts.labelOf, index, entry.layout);
    if (layer) {
      layers.push(layer);
      index++;
    }
  }
  return layers;
}

/** The default manifest when no server config is present (demo / fixtures):
 * the two built-in presets, so behavior matches the zero-config CLI. */
export const DEFAULT_LAYER_MANIFEST: LayerManifestEntry[] = [
  { name: "test", layout: "rings", includeExternal: false },
  { name: "deps", layout: "rings", includeExternal: true },
];
