import { bench, describe } from "vitest";
import {
  approximateBoundaryHausdorff,
  approximateBoundaryHausdorffByEdge,
  approximateBoundaryHausdorffWithinTolerance,
} from "./boundaryHausdorff.ts";
import type { Ring } from "./polygon.ts";

const regularPolygon = (edgeCount: number, offsetX: number): Ring =>
  Array.from({ length: edgeCount }, (_, index) => {
    const angle = (index * 2 * Math.PI) / edgeCount;
    return { x: Math.cos(angle) + offsetX, y: Math.sin(angle) };
  });

describe("boundary Hausdorff samplers at comparable geometric error", () => {
  for (const [edgeCount, subdivisionsPerEdge] of [
    [4, 8],
    [16, 2],
    [64, 1],
  ] as const) {
    const before = regularPolygon(edgeCount, 0);
    const after = regularPolygon(edgeCount, 0.01);

    bench(`fixed-total edges=${edgeCount} samples=32`, () => {
      approximateBoundaryHausdorff(before, after, 32);
    });

    bench(`edge-local edges=${edgeCount} subdivisions=${subdivisionsPerEdge}`, () => {
      approximateBoundaryHausdorffByEdge(before, after, subdivisionsPerEdge);
    });

    bench(`adaptive edge-local edges=${edgeCount} target-error=0.2`, () => {
      approximateBoundaryHausdorffWithinTolerance(before, after, 0.2);
    });
  }
});
