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

export function computePowerDiagram(
  sites: PowerSite[],
  clip: Ring,
): PowerCell[] {
  return sites.map((site, index) => {
    let cell: LabeledVertex[] = clip.map((p) => ({
      x: p.x,
      y: p.y,
      edgeSource: null,
    }));
    for (let j = 0; j < sites.length && cell.length > 0; j++) {
      if (j === index) continue;
      const other = sites[j]!;
      const nx = 2 * (other.x - site.x);
      const ny = 2 * (other.y - site.y);
      if (Math.abs(nx) < COINCIDENT_EPS && Math.abs(ny) < COINCIDENT_EPS) {
        // Coincident sites: the heavier weight wins everywhere; ties go to
        // the earlier site in input order.
        const loses =
          site.weight < other.weight ||
          (site.weight === other.weight && index > j);
        if (loses) cell = [];
        continue;
      }
      const c =
        other.x * other.x +
        other.y * other.y -
        (site.x * site.x + site.y * site.y) +
        site.weight -
        other.weight;
      cell = clipLabeled(cell, nx, ny, c, other.id);
    }
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
  });
}
