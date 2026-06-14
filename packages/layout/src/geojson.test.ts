import { describe, expect, it } from "vitest";
import { cellsToFeatureCollection } from "./geojson.js";
import type { CellResult } from "./capacityLayout.js";

const cell: CellResult = {
  id: "a",
  site: { x: 0.5, y: 0.5 },
  polygon: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  edges: [],
  targetArea: 0.9,
  actualArea: 1,
};

describe("cellsToFeatureCollection", () => {
  it("emits RFC 7946 polygons with closed CCW rings", () => {
    const fc = cellsToFeatureCollection([cell]);
    expect(fc.type).toBe("FeatureCollection");
    const feature = fc.features[0]!;
    expect(feature.type).toBe("Feature");
    expect(feature.geometry.type).toBe("Polygon");
    const ring = feature.geometry.coordinates[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]); // closed
    expect(ring).toHaveLength(5); // 4 vertices + closing point
  });

  it("carries id, areas and relative error in properties", () => {
    const feature = cellsToFeatureCollection([cell]).features[0]!;
    expect(feature.properties.id).toBe("a");
    expect(feature.properties.targetArea).toBe(0.9);
    expect(feature.properties.actualArea).toBe(1);
    expect(feature.properties.error).toBeCloseTo((1 - 0.9) / 0.9, 10);
    expect(feature.properties.site).toEqual([0.5, 0.5]);
  });

  it("skips empty cells", () => {
    const empty: CellResult = { ...cell, id: "b", polygon: [], actualArea: 0 };
    const fc = cellsToFeatureCollection([cell, empty]);
    expect(fc.features).toHaveLength(1);
  });
});
