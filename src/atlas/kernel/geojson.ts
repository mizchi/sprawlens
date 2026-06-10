import type { CellResult } from "./capacityLayout.js";

/**
 * GeoJSON boundary types (RFC 7946 shapes over planar coordinates). The
 * kernel keeps flat rings internally; this conversion is for persistence,
 * fixtures, turf-based verification and deck.gl interop.
 */
export type CellFeatureProperties = {
  id: string;
  targetArea: number;
  actualArea: number;
  /** Signed relative error: (actual - target) / target. */
  error: number;
  site: [number, number];
};

export type CellFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: CellFeatureProperties;
};

export type CellFeatureCollection = {
  type: "FeatureCollection";
  features: CellFeature[];
};

export function cellsToFeatureCollection(
  cells: readonly CellResult[],
): CellFeatureCollection {
  const features: CellFeature[] = [];
  for (const cell of cells) {
    if (cell.polygon.length < 3) continue;
    const ring = cell.polygon.map((p): number[] => [p.x, p.y]);
    ring.push([cell.polygon[0]!.x, cell.polygon[0]!.y]);
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: {
        id: cell.id,
        targetArea: cell.targetArea,
        actualArea: cell.actualArea,
        error: (cell.actualArea - cell.targetArea) / cell.targetArea,
        site: [cell.site.x, cell.site.y],
      },
    });
  }
  return { type: "FeatureCollection", features };
}
