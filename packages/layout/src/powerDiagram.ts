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

/**
 * Below this site count the O(n²) loop beats the grid's bookkeeping. Tuned
 * against the real build workload (rings/treemap on the 1.4k-file playwright
 * snapshot, whose cells cluster at 16–120 sites): the spatially-pruned grid
 * already wins from ~20 sites up, where most per-step diagrams land, so the
 * old threshold of 64 was leaving the medium cells on the brute-force path.
 */
const GRID_MIN_SITES = 20;

/**
 * A site's running cell as a struct-of-arrays convex polygon. Sutherland–
 * Hodgman ping-pongs the vertices from the `a` buffers into the `b` buffers
 * and swaps, so a clip allocates nothing — only the final PowerCell is built.
 * xs/ys are flat Float64Arrays for locality; `src[i]` labels the edge leaving
 * vertex i (the bisecting site id, or null for the clip boundary).
 */
type Cell = {
  ax: Float64Array;
  ay: Float64Array;
  as: (string | null)[];
  bx: Float64Array;
  by: Float64Array;
  bs: (string | null)[];
  /** Live vertex count in the `a` buffers (0 means the cell was clipped away). */
  n: number;
  /** Farthest vertex from the site (squared); a bisector beyond it cannot cut. */
  radius2: number;
};

/** Two ping-pong vertex buffers, reused across every site in one diagram. */
function makeCell(capacity: number): Cell {
  return {
    ax: new Float64Array(capacity),
    ay: new Float64Array(capacity),
    as: new Array<string | null>(capacity).fill(null),
    bx: new Float64Array(capacity),
    by: new Float64Array(capacity),
    bs: new Array<string | null>(capacity).fill(null),
    n: 0,
    radius2: 0,
  };
}

/**
 * Seed the cell with the clip ring and refresh its bounding radius². The clip
 * is the same for every site in a diagram, so its vertices are pre-unpacked
 * into flat `clipX`/`clipY` arrays once by the caller — reading those typed
 * arrays here (instead of the `{x,y}` ring objects) keeps this per-site reset,
 * which the profile shows is a hot 8%, off the object-property path.
 */
function resetCell(
  cell: Cell,
  clipX: Float64Array,
  clipY: Float64Array,
  clipLen: number,
  site: PowerSite,
): void {
  const { ax, ay, as } = cell;
  const sx = site.x;
  const sy = site.y;
  let max = 0;
  for (let i = 0; i < clipLen; i++) {
    const x = clipX[i]!;
    const y = clipY[i]!;
    ax[i] = x;
    ay[i] = y;
    as[i] = null;
    const dx = x - sx;
    const dy = y - sy;
    const d2 = dx * dx + dy * dy;
    if (d2 > max) max = d2;
  }
  cell.n = clipLen;
  cell.radius2 = max;
}

/** Unpack the clip ring into flat arrays reused across all of a diagram's sites. */
function unpackClip(clip: Ring): { clipX: Float64Array; clipY: Float64Array } {
  const clipX = new Float64Array(clip.length);
  const clipY = new Float64Array(clip.length);
  for (let i = 0; i < clip.length; i++) {
    clipX[i] = clip[i]!.x;
    clipY[i] = clip[i]!.y;
  }
  return { clipX, clipY };
}

function maxVertexDistance2(cell: Cell, site: PowerSite): number {
  let max = 0;
  const { ax, ay, n } = cell;
  for (let i = 0; i < n; i++) {
    const dx = ax[i]! - site.x;
    const dy = ay[i]! - site.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > max) max = d2;
  }
  return max;
}

/**
 * Sutherland–Hodgman of the `a` buffers against nx*x + ny*y <= c, tracking
 * which plane created each edge, writing into `b` and swapping. The newly cut
 * edge gets `planeId`; surviving edges keep theirs. Valid for convex polygons
 * (single entry/exit per plane). A result under 3 vertices clears the cell.
 */
function clipPlane(
  cell: Cell,
  nx: number,
  ny: number,
  c: number,
  planeId: string,
): void {
  const { ax, ay, as, bx, by, bs, n } = cell;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const k = i + 1 === n ? 0 : i + 1;
    const cx = ax[i]!;
    const cy = ay[i]!;
    const nxt = ax[k]!;
    const nyt = ay[k]!;
    const curDist = nx * cx + ny * cy - c;
    const nextDist = nx * nxt + ny * nyt - c;
    const curInside = curDist <= 0;
    const nextInside = nextDist <= 0;
    if (curInside) {
      bx[m] = cx;
      by[m] = cy;
      bs[m] = as[i] ?? null;
      m++;
    }
    if (curInside !== nextInside) {
      const t = curDist / (curDist - nextDist);
      bx[m] = cx + (nxt - cx) * t;
      by[m] = cy + (nyt - cy) * t;
      bs[m] = curInside ? planeId : (as[i] ?? null);
      m++;
    }
  }
  cell.ax = bx;
  cell.ay = by;
  cell.as = bs;
  cell.bx = ax;
  cell.by = ay;
  cell.bs = as;
  cell.n = m < 3 ? 0 : m;
}

/**
 * Apply site `other` (index j) as a half-plane to `site`'s running cell.
 * The polygon clip only runs when the bisector actually reaches the cell, so
 * far pairs cost a handful of flops. The intersection is commutative, so grid
 * and brute-force enumeration of the same sites yield the same cell.
 */
function clipAgainst(
  cell: Cell,
  site: PowerSite,
  index: number,
  other: PowerSite,
  j: number,
): void {
  const dx = other.x - site.x;
  const dy = other.y - site.y;
  const d2 = dx * dx + dy * dy;
  if (d2 < COINCIDENT_EPS) {
    // Coincident sites: the heavier weight wins everywhere; ties go to the
    // earlier site in input order.
    const loses =
      site.weight < other.weight ||
      (site.weight === other.weight && index > j);
    if (loses) cell.n = 0;
    return;
  }
  // cut distance along the pair axis is (d2 + Δw) / (2d); compare squared
  // against radius2 to keep sqrt out of the hot path
  const num = d2 + site.weight - other.weight;
  if (num > 0 && num * num > 4 * d2 * cell.radius2) return;
  const nx = 2 * dx;
  const ny = 2 * dy;
  const c =
    other.x * other.x +
    other.y * other.y -
    (site.x * site.x + site.y * site.y) +
    site.weight -
    other.weight;
  const before = cell.n;
  clipPlane(cell, nx, ny, c, other.id);
  if (cell.n > 0 && cell.n !== before) {
    cell.radius2 = maxVertexDistance2(cell, site);
  }
}

/** Materialize the running cell into the output polygon + labeled edges. */
function finishCell(cell: Cell, site: PowerSite): PowerCell {
  const n = cell.n;
  const { ax, ay, as } = cell;
  const polygon: Ring = new Array(n);
  for (let i = 0; i < n; i++) polygon[i] = { x: ax[i]!, y: ay[i]! };
  // edge i runs vertex i -> i+1, so reuse the polygon point objects rather
  // than allocating fresh copies (consumers only ever read them)
  const edges: CellEdge[] = new Array(n);
  for (let i = 0; i < n; i++) {
    edges[i] = {
      a: polygon[i]!,
      b: polygon[i + 1 === n ? 0 : i + 1]!,
      neighborId: as[i] ?? null,
    };
  }
  return {
    id: site.id,
    polygon,
    area: n >= 3 ? signedArea(polygon) : 0,
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
  // a cell can grow by at most one vertex per clip, so this bounds the peak
  const cell = makeCell(clip.length + sites.length + 4);
  const { clipX, clipY } = unpackClip(clip);
  return sites.map((site, index) => {
    resetCell(cell, clipX, clipY, clip.length, site);
    for (let j = 0; j < sites.length && cell.n > 0; j++) {
      if (j === index) continue;
      clipAgainst(cell, site, index, sites[j]!, j);
    }
    return finishCell(cell, site);
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

  const cell = makeCell(clip.length + sites.length + 4);
  const { clipX, clipY } = unpackClip(clip);
  const maxRing = Math.max(cols, rows);
  return sites.map((site, index) => {
    resetCell(cell, clipX, clipY, clip.length, site);
    const cx = gx(site.x);
    const cy = gy(site.y);
    for (let ring = 0; ring <= maxRing && cell.n > 0; ring++) {
      if (ring >= 2) {
        // nearest a site in this ring (or any farther one) can sit
        const dMin = (ring - 1) * cellSize;
        const num = dMin * dMin + site.weight - maxWeight;
        if (num > 0 && num * num >= 4 * dMin * dMin * cell.radius2) break;
      }
      const x0 = Math.max(0, cx - ring);
      const x1 = Math.min(cols - 1, cx + ring);
      const y0 = Math.max(0, cy - ring);
      const y1 = Math.min(rows - 1, cy + ring);
      for (let by = y0; by <= y1 && cell.n > 0; by++) {
        const onYedge = by === cy - ring || by === cy + ring;
        for (let bx = x0; bx <= x1; bx++) {
          // only the perimeter of the ring is new (interior done already)
          if (!onYedge && bx !== cx - ring && bx !== cx + ring) continue;
          const bucket = buckets[by * cols + bx]!;
          for (const j of bucket) {
            if (j === index) continue;
            clipAgainst(cell, site, index, sites[j]!, j);
            if (cell.n === 0) break;
          }
          if (cell.n === 0) break;
        }
      }
    }
    return finishCell(cell, site);
  });
}
