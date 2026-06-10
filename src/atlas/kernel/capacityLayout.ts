import {
  clampInto,
  clipScale,
  clipToRing,
  randomPointIn,
  type ClipRegion,
} from "./clip.js";
import { centroid, signedArea, type Ring } from "./polygon.js";
import {
  computePowerDiagram,
  type CellEdge,
  type PowerSite,
} from "./powerDiagram.js";
import { createRng, type Rng } from "./rng.js";
import type { Vec2 } from "./vec.js";

export type { ClipRegion } from "./clip.js";

export type CellInputNode = {
  id: string;
  /** Raw weight (e.g. LOC); target area is proportional to it. */
  weight: number;
  hint?: Vec2;
};

export type CapacityOptions = {
  seed?: number;
  /** Fraction of the area error converted into a power-weight delta per step. */
  adaptationRate?: number;
  /** Fraction of the site→centroid distance moved per step (Lloyd relaxation). */
  lloydRate?: number;
  /** Raw weights are clamped to maxRawWeight * this ratio. */
  weightFloorRatio?: number;
  /** Segment count used to polygonize circle clips. */
  circleSegments?: number;
};

export type CellResult = {
  id: string;
  site: Vec2;
  polygon: Ring;
  edges: CellEdge[];
  targetArea: number;
  actualArea: number;
};

type SiteState = PowerSite & {
  targetArea: number;
  rawWeight: number;
};

export type CapacityLayoutState = {
  clip: ClipRegion;
  clipRing: Ring;
  clipArea: number;
  sites: SiteState[];
  cells: CellResult[];
  iteration: number;
  maxRelativeError: number;
  options: Required<CapacityOptions>;
};

const DEFAULT_OPTIONS: Required<CapacityOptions> = {
  seed: 1,
  adaptationRate: 0.8,
  lloydRate: 0.7,
  weightFloorRatio: 1e-3,
  circleSegments: 64,
};

/** Nudge exactly/near coincident sites apart so power bisectors are defined. */
function separateCoincident(sites: SiteState[], scale: number, rng: Rng): void {
  const eps = scale * 1e-9;
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const a = sites[i]!;
      const b = sites[j]!;
      if (Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps) {
        const angle = rng() * Math.PI * 2;
        const r = scale * 1e-4 * (1 + rng());
        sites[j] = {
          ...b,
          x: b.x + Math.cos(angle) * r,
          y: b.y + Math.sin(angle) * r,
        };
      }
    }
  }
}

function flooredWeights(nodes: readonly CellInputNode[], ratio: number): number[] {
  const maxRaw = Math.max(...nodes.map((n) => n.weight), 0);
  const floor = maxRaw > 0 ? maxRaw * ratio : 1;
  return nodes.map((n) => Math.max(n.weight, floor));
}

function computeCells(
  sites: SiteState[],
  clipRing: Ring,
): { cells: CellResult[]; maxRelativeError: number } {
  const diagram = computePowerDiagram(sites, clipRing);
  let maxRelativeError = 0;
  const cells = diagram.map((cell, i) => {
    const site = sites[i]!;
    const error = Math.abs(cell.area - site.targetArea) / site.targetArea;
    if (error > maxRelativeError) maxRelativeError = error;
    return {
      id: cell.id,
      site: { x: site.x, y: site.y },
      polygon: cell.polygon,
      edges: cell.edges,
      targetArea: site.targetArea,
      actualArea: cell.area,
    };
  });
  return { cells, maxRelativeError };
}

function buildState(
  clip: ClipRegion,
  sites: SiteState[],
  iteration: number,
  options: Required<CapacityOptions>,
): CapacityLayoutState {
  const clipRing = clipToRing(clip, options.circleSegments);
  const { cells, maxRelativeError } = computeCells(sites, clipRing);
  return {
    clip,
    clipRing,
    clipArea: signedArea(clipRing),
    sites,
    cells,
    iteration,
    maxRelativeError,
    options,
  };
}

function assignTargets(
  sites: SiteState[],
  clipArea: number,
): SiteState[] {
  const totalRaw = sites.reduce((sum, s) => sum + s.rawWeight, 0);
  return sites.map((s) => ({
    ...s,
    targetArea: (clipArea * s.rawWeight) / totalRaw,
  }));
}

export function createCapacityLayout(
  nodes: CellInputNode[],
  clip: ClipRegion,
  options?: CapacityOptions,
): CapacityLayoutState {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rng = createRng(opts.seed);
  const clipRing = clipToRing(clip, opts.circleSegments);
  const clipArea = signedArea(clipRing);
  const raws = flooredWeights(nodes, opts.weightFloorRatio);
  let sites: SiteState[] = nodes.map((node, i) => {
    const position = node.hint
      ? clampInto(clip, node.hint)
      : randomPointIn(clip, rng);
    return {
      id: node.id,
      x: position.x,
      y: position.y,
      weight: 0,
      rawWeight: raws[i]!,
      targetArea: 0,
    };
  });
  separateCoincident(sites, clipScale(clip), rng);
  sites = assignTargets(sites, clipArea);
  // Seed power weights near the analytic scale of the desired cell size
  // (inscribed radius squared ~ targetArea / pi); starting from zero leaves
  // tiny-target cells massively oversized and stretches the transient.
  sites = sites.map((s) => ({ ...s, weight: s.targetArea / Math.PI }));
  return buildState(clip, sites, 0, opts);
}

function adaptWeights(
  sites: SiteState[],
  cells: CellResult[],
  adaptationRate: number,
  clipArea: number,
): SiteState[] {
  const n = sites.length;
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const siteById = new Map(sites.map((s) => [s.id, s]));

  // Nearest-neighbor distance per site; bounds every weight move so a single
  // step can never swallow a neighbor (Nocaj & Brandes-style stabilization).
  const nearest = new Array<number>(n).fill(Infinity);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = sites[i]!;
      const b = sites[j]!;
      const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (d2 < nearest[i]!) nearest[i] = d2;
      if (d2 < nearest[j]!) nearest[j] = d2;
    }
  }

  const weights = sites.map((site, i) => {
    const cell = cellById.get(site.id)!;
    if (cell.actualArea <= 0) {
      // Empty cell: crawling back via bounded steps can take thousands of
      // iterations when a heavy neighbor towers over this site. Jump straight
      // to the exact weight at which the site re-enters its own cell
      // (w_i >= w_j - d_ij^2 for all j), plus a margin sized to its target.
      let required = -Infinity;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const other = sites[j]!;
        const d2 = (other.x - site.x) ** 2 + (other.y - site.y) ** 2;
        const bound = other.weight - d2;
        if (bound > required) required = bound;
      }
      const margin = Math.min(site.targetArea / Math.PI, 0.45 * nearest[i]!);
      return required + margin;
    }
    const error = site.targetArea - cell.actualArea;
    // Diagonal Newton step: dArea/dWeight of cell i is the sum over its
    // bisector edges of edgeLength / (2 * distanceToNeighbor). Dividing the
    // area error by this sensitivity equalizes convergence speed between
    // tiny and huge cells; a fixed rate leaves the smallest cells crawling.
    let sensitivity = 0;
    for (const edge of cell.edges) {
      if (edge.neighborId === null) continue;
      const neighbor = siteById.get(edge.neighborId);
      if (!neighbor) continue;
      const edgeLength = Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y);
      const dist = Math.hypot(neighbor.x - site.x, neighbor.y - site.y);
      if (dist > 0) sensitivity += edgeLength / (2 * dist);
    }
    const cap = 0.45 * (Number.isFinite(nearest[i]!) ? nearest[i]! : clipArea);
    let delta = sensitivity > 0 ? (adaptationRate * error) / sensitivity : cap;
    if (delta > cap) delta = cap;
    if (delta < -cap) delta = -cap;
    return site.weight + delta;
  });

  let meanWeight = 0;
  for (const w of weights) meanWeight += w / n;
  return sites.map((site, i) => ({ ...site, weight: weights[i]! - meanWeight }));
}

export function capacityStep(
  state: CapacityLayoutState,
): CapacityLayoutState {
  const { options, clip, clipRing } = state;

  // Phase 1: Lloyd relaxation on the current diagram. Damped as area errors
  // shrink — capacity convergence is limited by geometry churn (classic CVT
  // tails are O(1/k)) and we only need sites near their cell centers, not an
  // exact centroidal diagram.
  const lloydRate =
    options.lloydRate * Math.min(1, 10 * state.maxRelativeError);
  const cellById = new Map(state.cells.map((c) => [c.id, c]));
  const rng = createRng(options.seed + state.iteration + 1);
  const moved = state.sites.map((site) => {
    const cell = cellById.get(site.id)!;
    let x = site.x;
    let y = site.y;
    if (cell.polygon.length >= 3) {
      const c = centroid(cell.polygon);
      x += (c.x - x) * lloydRate;
      y += (c.y - y) * lloydRate;
    }
    const clamped = clampInto(clip, { x, y });
    return { ...site, x: clamped.x, y: clamped.y };
  });
  separateCoincident(moved, clipScale(clip), rng);

  // Phase 2: adapt weights against the post-move diagram. Adapting on the
  // pre-move geometry feeds a stale gradient into the update and was the
  // main source of slow, oscillating convergence.
  const midway = computeCells(moved, clipRing);
  const adapted = adaptWeights(
    moved,
    midway.cells,
    options.adaptationRate,
    state.clipArea,
  );

  const { cells, maxRelativeError } = computeCells(adapted, clipRing);
  return {
    ...state,
    sites: adapted,
    cells,
    iteration: state.iteration + 1,
    maxRelativeError,
  };
}

export function isConverged(
  state: CapacityLayoutState,
  tolerance: number,
): boolean {
  return state.maxRelativeError < tolerance;
}

export type GraphChanges = {
  upsert?: CellInputNode[];
  remove?: string[];
  clip?: ClipRegion;
};

/**
 * Warm-start entry point: existing sites keep their position and power
 * weight, removed sites disappear, new sites are inserted into the roomiest
 * cell. Target areas are re-normalized against the (possibly new) clip.
 */
export function applyGraphChanges(
  state: CapacityLayoutState,
  changes: GraphChanges,
): CapacityLayoutState {
  const { options } = state;
  const clip = changes.clip ?? state.clip;
  const clipRing = clipToRing(clip, options.circleSegments);
  const clipArea = signedArea(clipRing);
  const removed = new Set(changes.remove ?? []);
  const upserts = new Map((changes.upsert ?? []).map((n) => [n.id, n]));

  const kept: { node: CellInputNode; site: SiteState | null }[] = [];
  for (const site of state.sites) {
    if (removed.has(site.id)) continue;
    const upsert = upserts.get(site.id);
    upserts.delete(site.id);
    kept.push({
      node: upsert ?? { id: site.id, weight: site.rawWeight },
      site,
    });
  }
  for (const node of upserts.values()) {
    kept.push({ node, site: null });
  }

  const raws = flooredWeights(
    kept.map((k) => k.node),
    options.weightFloorRatio,
  );
  const rng = createRng(options.seed + state.iteration + 7919);
  const roomiest = [...state.cells]
    .filter((c) => !removed.has(c.id))
    .sort((a, b) => b.actualArea - a.actualArea)[0];
  let sites: SiteState[] = kept.map((k, i) => {
    if (k.site) {
      const clamped = clampInto(clip, { x: k.site.x, y: k.site.y });
      return { ...k.site, x: clamped.x, y: clamped.y, rawWeight: raws[i]! };
    }
    const base = k.node.hint
      ? clampInto(clip, k.node.hint)
      : roomiest
        ? centroid(roomiest.polygon)
        : randomPointIn(clip, rng);
    const jitter = clipScale(clip) * 1e-3;
    return {
      id: k.node.id,
      x: base.x + (rng() - 0.5) * jitter,
      y: base.y + (rng() - 0.5) * jitter,
      weight: 0,
      rawWeight: raws[i]!,
      targetArea: 0,
    };
  });
  separateCoincident(sites, clipScale(clip), rng);
  sites = assignTargets(sites, clipArea);
  return buildState(clip, sites, state.iteration, options);
}
