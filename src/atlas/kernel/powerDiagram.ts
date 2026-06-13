import type { Ring } from "./polygon.js";
import { signedArea } from "./polygon.js";
import type { Vec2 } from "./vec.js";

export type PowerSite = {
  id: string;
  x: number;
  y: number;
  /** Power weight: cell of site i is { p : |p-s_i|^2 - w_i <= |p-s_j|^2 - w_j }. */
  weight: number;
};

export type CellEdge = {
  a: Vec2;
  b: Vec2;
  /** Site id whose bisector produced this edge, or null for the clip boundary. */
  neighborId: string | null;
};

export type PowerCell = {
  id: string;
  polygon: Ring;
  area: number;
  edges: CellEdge[];
};

const COINCIDENT_EPS = 1e-12;

/** Vertex whose outgoing edge (to the next vertex) carries a provenance label. */
type LabeledVertex = { x: number; y: number; edgeSource: string | null };

/**
 * Sutherland–Hodgman against nx*x + ny*y <= c, tracking which plane created
 * each edge. The newly cut edge gets `planeId`; surviving edges keep theirs.
 * Valid for convex polygons (single entry/exit per plane).
 */
function clipLabeled(
  verts: LabeledVertex[],
  nx: number,
  ny: number,
  c: number,
  planeId: string,
): LabeledVertex[] {
  if (verts.length === 0) return [];
  const out: LabeledVertex[] = [];
  for (let i = 0; i < verts.length; i++) {
    const cur = verts[i]!;
    const next = verts[(i + 1) % verts.length]!;
    const curDist = nx * cur.x + ny * cur.y - c;
    const nextDist = nx * next.x + ny * next.y - c;
    const curInside = curDist <= 0;
    const nextInside = nextDist <= 0;
    if (curInside && nextInside) {
      out.push(cur);
    } else if (curInside && !nextInside) {
      out.push(cur);
      const t = curDist / (curDist - nextDist);
      out.push({
        x: cur.x + (next.x - cur.x) * t,
        y: cur.y + (next.y - cur.y) * t,
        edgeSource: planeId,
      });
    } else if (!curInside && nextInside) {
      const t = curDist / (curDist - nextDist);
      out.push({
        x: cur.x + (next.x - cur.x) * t,
        y: cur.y + (next.y - cur.y) * t,
        edgeSource: cur.edgeSource,
      });
    }
  }
  return out.length < 3 ? [] : out;
}

/** Below this site count the O(n²) loop beats the grid's bookkeeping. */
const GRID_MIN_SITES = 64;

/**
 * Apply site `other` (index j) as a half-plane to `site`'s running cell.
 * Returns the (possibly clipped) cell and its refreshed radius²; the
 * polygon clip only runs when the bisector actually reaches the cell, so
 * far pairs cost a handful of flops. The intersection is commutative, so
 * grid and brute-force enumeration of the same sites yield the same cell.
 */
function clipAgainst(
  cell: LabeledVertex[],
  radius2: number,
  site: PowerSite,
  index: number,
  other: PowerSite,
  j: number,
): { cell: LabeledVertex[]; radius2: number } {
  const dx = other.x - site.x;
  const dy = other.y - site.y;
  const d2 = dx * dx + dy * dy;
  if (d2 < COINCIDENT_EPS) {
    // Coincident sites: the heavier weight wins everywhere; ties go to the
    // earlier site in input order.
    const loses =
      site.weight < other.weight ||
      (site.weight === other.weight && index > j);
    return { cell: loses ? [] : cell, radius2 };
  }
  // cut distance along the pair axis is (d2 + Δw) / (2d); compare squared
  // against radius2 to keep sqrt out of the hot path
  const num = d2 + site.weight - other.weight;
  if (num > 0 && num * num > 4 * d2 * radius2) return { cell, radius2 };
  const nx = 2 * dx;
  const ny = 2 * dy;
  const c =
    other.x * other.x +
    other.y * other.y -
    (site.x * site.x + site.y * site.y) +
    site.weight -
    other.weight;
  const before = cell.length;
  const clipped = clipLabeled(cell, nx, ny, c, other.id);
  return {
    cell: clipped,
    radius2:
      clipped.length !== before ? maxVertexDistance2(site, clipped) : radius2,
  };
}

function cellOf(
  site: PowerSite,
  cell: LabeledVertex[],
): PowerCell {
  const polygon: Ring = cell.map((v) => ({ x: v.x, y: v.y }));
  const edges: CellEdge[] = cell.map((v, i) => {
    const next = cell[(i + 1) % cell.length]!;
    return {
      a: { x: v.x, y: v.y },
      b: { x: next.x, y: next.y },
      neighborId: v.edgeSource,
    };
  });
  return {
    id: site.id,
    polygon,
    area: polygon.length >= 3 ? signedArea(polygon) : 0,
    edges,
  };
}

export function computePowerDiagram(
  sites: PowerSite[],
  clip: Ring,
): PowerCell[] {
  if (sites.length >= GRID_MIN_SITES) {
    return computePowerDiagramGrid(sites, clip);
  }
  return sites.map((site, index) => {
    let cell: LabeledVertex[] = clip.map((p) => ({
      x: p.x,
      y: p.y,
      edgeSource: null,
    }));
    // farthest cell vertex from the site (squared): a bisector beyond it
    // cannot cut, so most pairs skip the (allocating) polygon clip
    let radius2 = maxVertexDistance2(site, cell);
    for (let j = 0; j < sites.length && cell.length > 0; j++) {
      if (j === index) continue;
      const result = clipAgainst(cell, radius2, site, index, sites[j]!, j);
      cell = result.cell;
      radius2 = result.radius2;
    }
    return cellOf(site, cell);
  });
}

/**
 * Grid-accelerated power diagram. Sites bucket into a uniform grid; each
 * cell only clips against sites in expanding rings around its own bucket.
 * A ring at minimum distance D can hold no site able to cut once
 * (D² + w_i − w_max) / 2D ≥ radius_i (every farther site's bisector lands
 * past the cell — using the global max weight makes this a safe lower
 * bound), so the search stops early. Identical output to brute force, near
 * O(n·k) instead of O(n²) for spatially spread sites.
 */
function computePowerDiagramGrid(sites: PowerSite[], clip: Ring): PowerCell[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxWeight = -Infinity;
  for (const s of sites) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
    if (s.weight > maxWeight) maxWeight = s.weight;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  // ~1 site per bucket on average keeps ring scans short
  const cellSize = Math.max(
    Math.sqrt((spanX * spanY) / sites.length) || 1,
    1e-9,
  );
  const cols = Math.floor(spanX / cellSize) + 1;
  const rows = Math.floor(spanY / cellSize) + 1;
  const gx = (x: number) =>
    Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cellSize)));
  const gy = (y: number) =>
    Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cellSize)));
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  for (let i = 0; i < sites.length; i++) {
    buckets[gy(sites[i]!.y) * cols + gx(sites[i]!.x)]!.push(i);
  }

  const maxRing = Math.max(cols, rows);
  return sites.map((site, index) => {
    let cell: LabeledVertex[] = clip.map((p) => ({
      x: p.x,
      y: p.y,
      edgeSource: null,
    }));
    let radius2 = maxVertexDistance2(site, cell);
    const cx = gx(site.x);
    const cy = gy(site.y);
    for (let ring = 0; ring <= maxRing && cell.length > 0; ring++) {
      if (ring >= 2) {
        // nearest a site in this ring (or any farther one) can sit
        const dMin = (ring - 1) * cellSize;
        const num = dMin * dMin + site.weight - maxWeight;
        if (num > 0 && num * num >= 4 * dMin * dMin * radius2) break;
      }
      const x0 = Math.max(0, cx - ring);
      const x1 = Math.min(cols - 1, cx + ring);
      const y0 = Math.max(0, cy - ring);
      const y1 = Math.min(rows - 1, cy + ring);
      for (let by = y0; by <= y1 && cell.length > 0; by++) {
        const onYedge = by === cy - ring || by === cy + ring;
        for (let bx = x0; bx <= x1; bx++) {
          // only the perimeter of the ring is new (interior done already)
          if (!onYedge && bx !== cx - ring && bx !== cx + ring) continue;
          const bucket = buckets[by * cols + bx]!;
          for (const j of bucket) {
            if (j === index) continue;
            const result = clipAgainst(cell, radius2, site, index, sites[j]!, j);
            cell = result.cell;
            radius2 = result.radius2;
            if (cell.length === 0) break;
          }
          if (cell.length === 0) break;
        }
      }
    }
    return cellOf(site, cell);
  });
}

function maxVertexDistance2(site: PowerSite, cell: LabeledVertex[]): number {
  let max = 0;
  for (const v of cell) {
    const dx = v.x - site.x;
    const dy = v.y - site.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > max) max = d2;
  }
  return max;
}
