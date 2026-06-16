import {
  capacityStep,
  createCapacityLayout,
  isConverged,
} from "@sprawlens/layout";
import {
  centralityRings,
  importanceScore,
} from "@sprawlens/layout";
import { ringLayout } from "@sprawlens/layout";
import type { Vec2 } from "@sprawlens/layout";

/**
 * Stacked-plane layers. Each layer is laid out on its own tilted plane by a
 * swappable `PlaneLayout` strategy: the tests plane fills its plane as a
 * capacity Voronoi (area ∝ weight, like the source plane); the deps plane
 * arranges packages in concentric rings (rank ∝ how depended-upon they are).
 * New layers are added by pairing nodes with a layout — the renderer only
 * sees the placed result, so the structure is fully pluggable.
 */

export type LayerNode = {
  id: string;
  label: string;
  /** Area weight (capacity) and circle area (ring). */
  weight: number;
  /** Concentric-ring rank: 0 = center. Higher = more depended-upon → outer. */
  rank?: number;
  /** Related source files, for the correspondence lines up to the source plane. */
  sourceIds: string[];
};

export type PlacedNode = {
  id: string;
  label: string;
  site: Vec2;
  /** Capacity cell boundary (capacity layout only). */
  polygon?: Vec2[];
  /** Circle radius (ring layout only). */
  r?: number;
  sourceIds: string[];
};

type Extent = { w: number; h: number };
export type PlaneLayout = (nodes: readonly LayerNode[], extent: Extent) => PlacedNode[];

const SOLVE_MAX_STEPS = 200;
const SOLVE_CONVERGENCE = 0.02;

/** Capacity Voronoi: each node gets area ∝ weight inside the plane rect. */
export const capacityPlane: PlaneLayout = (nodes, extent) => {
  if (nodes.length === 0) return [];
  let state = createCapacityLayout(
    nodes.map((n) => ({ id: n.id, weight: Math.max(n.weight, 1) })),
    { kind: "rect", x: 0, y: 0, width: extent.w, height: extent.h },
    { seed: 1 },
  );
  for (
    let i = 0;
    i < SOLVE_MAX_STEPS && !isConverged(state, SOLVE_CONVERGENCE);
    i++
  )
    state = capacityStep(state);
  const meta = new Map(nodes.map((n) => [n.id, n]));
  return state.cells.map((c) => ({
    id: c.id,
    label: meta.get(c.id)?.label ?? c.id,
    site: c.site,
    polygon: c.polygon,
    sourceIds: meta.get(c.id)?.sourceIds ?? [],
  }));
};

/** Concentric rings: rank drives the shell, weight the circle area. Recentered
 * and scaled to fit the plane extent. */
export const ringPlane: PlaneLayout = (nodes, extent) => {
  if (nodes.length === 0) return [];
  // rank from the supplied rank, or derive shells from weight as centrality
  const ranks =
    nodes.every((n) => n.rank === undefined)
      ? centralityRings(
          nodes.map((n) => ({
            id: n.id,
            area: Math.max(n.weight, 1),
            centrality: importanceScore(n.weight, n.weight),
          })),
        )
      : new Map(nodes.map((n) => [n.id, n.rank ?? 0]));
  const result = ringLayout(
    nodes.map((n) => ({
      id: n.id,
      area: Math.max(n.weight, 1),
      rank: ranks.get(n.id) ?? 0,
    })),
    [],
  );
  // ringLayout centers rank 0 at the origin; keep that center (so low rank
  // stays central) and scale the whole ring (up or down) to fill ~90% of the
  // plane — package circle areas are tiny (import counts), so this scales up
  const scale = result.totalRadius
    ? Math.min((extent.w * 0.45) / result.totalRadius, (extent.h * 0.45) / result.totalRadius)
    : 1;
  const meta = new Map(nodes.map((n) => [n.id, n]));
  return [...result.circles].map(([id, c]) => ({
    id,
    label: meta.get(id)?.label ?? id,
    site: { x: c.cx * scale + extent.w / 2, y: c.cy * scale + extent.h / 2 },
    r: c.r * scale,
    sourceIds: meta.get(id)?.sourceIds ?? [],
  }));
};
