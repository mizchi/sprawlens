import { clampInto, clipCenter, clipScale, randomPointIn, type ClipRegion } from "./clip.js";
import { centroid, nearestPointInRing, signedArea, type Ring } from "./polygon.js";
import { createRng } from "./rng.js";
import type { Vec2 } from "./vec.js";

export type ForceInputNode = { id: string; weight: number; hint?: Vec2 };
export type ForceInputEdge = { source: string; target: string; weight?: number };

export type ForceOptions = {
  seed?: number;
  /** Spring constant pulling linked nodes toward their rest distance. */
  springStrength?: number;
  /** Pairwise repulsion constant (scaled by node radii). */
  repulsionStrength?: number;
  /** Pull toward the clip center. */
  gravity?: number;
  /**
   * Per-node confinement (convex CCW ring). Constrained nodes are projected
   * to the nearest point of their region every step (projected gradient), so
   * springs across regions still act while nodes stay inside their parent
   * cell. Gravity pulls these nodes toward their region centroid instead of
   * the clip center.
   */
  regions?: ReadonlyMap<string, Ring>;
};

export type ForceLayoutState = {
  positions: Map<string, Vec2>;
  nodes: ForceInputNode[];
  edges: ForceInputEdge[];
  clip: ClipRegion;
  radii: Map<string, number>;
  /** Gravity anchor per constrained node (its region centroid). */
  regionCenters: Map<string, Vec2>;
  iteration: number;
  options: Required<ForceOptions>;
};

const DEFAULT_OPTIONS: Required<ForceOptions> = {
  seed: 1,
  springStrength: 0.08,
  repulsionStrength: 0.04,
  gravity: 0.02,
  regions: new Map<string, Ring>(),
};

export function createForceLayout(
  nodes: ForceInputNode[],
  edges: ForceInputEdge[],
  clip: ClipRegion,
  options?: ForceOptions,
): ForceLayoutState {
  const opts = { ...DEFAULT_OPTIONS };
  if (options) {
    for (const key of Object.keys(options) as (keyof ForceOptions)[]) {
      const value = options[key];
      if (value !== undefined) (opts as Record<string, unknown>)[key] = value;
    }
  }
  const rng = createRng(opts.seed);
  const regionCenters = new Map<string, Vec2>();
  for (const [id, ring] of opts.regions) regionCenters.set(id, centroid(ring));
  const positions = new Map<string, Vec2>();
  for (const node of nodes) {
    const region = opts.regions.get(node.id);
    const free = node.hint
      ? clampInto(clip, node.hint)
      : region
        ? randomPointIn({ kind: "polygon", ring: region }, rng)
        : randomPointIn(clip, rng);
    positions.set(node.id, region ? nearestPointInRing(region, free) : free);
  }
  // Node radius approximates the cell it will eventually occupy, so the
  // repulsion/rest distances already reflect target areas.
  const scale = clipScale(clip);
  const clipArea =
    clip.kind === "rect"
      ? clip.width * clip.height
      : clip.kind === "circle"
        ? Math.PI * clip.r ** 2
        : Math.abs(signedArea(clip.ring));
  const totalWeight = nodes.reduce((s, n) => s + Math.max(n.weight, 0), 0) || 1;
  const radii = new Map(
    nodes.map((n) => [
      n.id,
      Math.sqrt((clipArea * Math.max(n.weight, 0)) / totalWeight / Math.PI) || scale * 1e-3,
    ]),
  );
  return {
    positions,
    nodes,
    edges,
    clip,
    radii,
    regionCenters,
    iteration: 0,
    options: opts,
  };
}

export function forceStep(state: ForceLayoutState): ForceLayoutState {
  const { nodes, edges, clip, radii, options } = state;
  const scale = clipScale(clip);
  const center = clipCenter(clip);
  const cooling = 1 / (1 + state.iteration * 0.02);
  const maxMove = scale * 0.05;

  const disp = new Map<string, Vec2>();
  for (const node of nodes) disp.set(node.id, { x: 0, y: 0 });

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const pa = state.positions.get(a.id)!;
      const pb = state.positions.get(b.id)!;
      let dx = pa.x - pb.x;
      let dy = pa.y - pb.y;
      let d = Math.hypot(dx, dy);
      if (d < scale * 1e-6) {
        // deterministic tie-break for stacked nodes
        dx = ((i + 1) % 3) - 1 || 1;
        dy = ((j + 1) % 3) - 1;
        d = Math.hypot(dx, dy);
      }
      const minDist = (radii.get(a.id)! + radii.get(b.id)!) * 1.1;
      const f = Math.min((options.repulsionStrength * minDist * minDist) / (d * d), maxMove);
      const ux = dx / d;
      const uy = dy / d;
      const da = disp.get(a.id)!;
      const db = disp.get(b.id)!;
      da.x += ux * f;
      da.y += uy * f;
      db.x -= ux * f;
      db.y -= uy * f;
    }
  }

  for (const edge of edges) {
    const pa = state.positions.get(edge.source);
    const pb = state.positions.get(edge.target);
    if (!pa || !pb) continue;
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const d = Math.hypot(dx, dy);
    if (d < scale * 1e-9) continue;
    const rest = (radii.get(edge.source)! + radii.get(edge.target)!) * 1.4;
    const f = options.springStrength * (d - rest) * (edge.weight ?? 1);
    const ux = dx / d;
    const uy = dy / d;
    const da = disp.get(edge.source)!;
    const db = disp.get(edge.target)!;
    da.x += ux * f;
    da.y += uy * f;
    db.x -= ux * f;
    db.y -= uy * f;
  }

  for (const node of nodes) {
    const p = state.positions.get(node.id)!;
    const d = disp.get(node.id)!;
    const anchor = state.regionCenters.get(node.id) ?? center;
    d.x += (anchor.x - p.x) * options.gravity;
    d.y += (anchor.y - p.y) * options.gravity;
  }

  const positions = new Map<string, Vec2>();
  for (const node of nodes) {
    const p = state.positions.get(node.id)!;
    const d = disp.get(node.id)!;
    const mag = Math.hypot(d.x, d.y);
    const limit = mag > maxMove ? maxMove / mag : 1;
    const next = {
      x: p.x + d.x * limit * cooling,
      y: p.y + d.y * limit * cooling,
    };
    const region = options.regions.get(node.id);
    positions.set(node.id, region ? nearestPointInRing(region, next) : clampInto(clip, next));
  }
  return { ...state, positions, iteration: state.iteration + 1 };
}
