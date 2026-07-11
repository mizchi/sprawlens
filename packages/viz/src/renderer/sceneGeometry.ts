import type { CellResult } from "@sprawlens/layout";
import type { MapScene } from "./contract.ts";

const precision = 1_000_000;
const number = (value: number): number => {
  const rounded = Math.round(value * precision) / precision;
  return Object.is(rounded, -0) ? 0 : rounded;
};
const point = (value: { x: number; y: number }) => [number(value.x), number(value.y)];

function cells(values: readonly CellResult[]) {
  return [...values]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((cell) => ({
      id: cell.id,
      site: point(cell.site),
      polygon: cell.polygon.map(point),
    }));
}

function capacityLayouts(layouts: ReadonlyMap<string, { cells: CellResult[] }>) {
  return [...layouts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, layout]) => ({ id, cells: cells(layout.cells) }));
}

/** Canonical world-space geometry, excluding colors, evidence, selection, and camera. */
function sceneGeometrySnapshot(scene: MapScene): unknown {
  const common = {
    version: 1,
    kind: scene.kind,
    width: number(scene.width),
    height: number(scene.height),
    innerCells: cells(scene.innerCells),
    layers: [...scene.layers]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((layer) => ({
        id: layer.id,
        planeIndex: layer.planeIndex,
        extent: [number(layer.extent.w), number(layer.extent.h)],
        placed: [...layer.placed]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((placed) => ({
            id: placed.id,
            site: point(placed.site),
            polygon: placed.polygon?.map(point),
            r: placed.r === undefined ? undefined : number(placed.r),
          })),
        districts: layer.districts.map((district) => district.map(point)),
      })),
  };
  if (scene.kind === "rings") {
    return {
      ...common,
      circles: [...scene.rings.circles]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, circle]) => ({
          id,
          cx: number(circle.cx),
          cy: number(circle.cy),
          r: number(circle.r),
          rank: circle.rank,
        })),
      levels: scene.rings.innerLevels.map((level) => ({
        kind: level.kind,
        cells: cells([...level.cells.values()]),
      })),
      leaves: capacityLayouts(scene.rings.leafLayouts),
    };
  }
  return {
    ...common,
    levels: scene.state.levels.map((level) => ({
      kind: level.kind,
      cells: cells([...level.cells.values()]),
    })),
    leaves: capacityLayouts(scene.state.leafLayouts),
  };
}

/** Stable 64-bit FNV-1a digest used as a browser/headless geometry golden key. */
export function sceneGeometryFingerprint(scene: MapScene): string {
  const serialized = JSON.stringify(sceneGeometrySnapshot(scene));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= BigInt(serialized.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `sg1-${hash.toString(16).padStart(16, "0")}`;
}
