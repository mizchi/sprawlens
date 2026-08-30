import type { Vec2 } from "./vec.ts";

export type WeightedPoint = {
  point: Vec2;
  weight: number;
};

/**
 * Normalized non-negative weighted center. Exact affine laws belong to the
 * rational Lean model; this IEEE-754 implementation is checked with tolerance.
 */
export function weightedBarycenter(samples: readonly WeightedPoint[]): Vec2 | undefined {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (const { point, weight } of samples) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(weight)) {
      throw new Error("weighted barycenter inputs must be finite");
    }
    if (weight < 0) throw new Error("weighted barycenter weights must be non-negative");
    totalWeight += weight;
    weightedX += weight * point.x;
    weightedY += weight * point.y;
  }
  if (totalWeight === 0) return undefined;
  return { x: weightedX / totalWeight, y: weightedY / totalWeight };
}

/** `historyMix=0` selects current; `historyMix=1` selects previous. */
export function affineBarycenter(current: Vec2, previous: Vec2, historyMix: number): Vec2 {
  if (!Number.isFinite(historyMix) || historyMix < 0 || historyMix > 1) {
    throw new Error("history mix must be finite and inside 0..1");
  }
  if (
    !Number.isFinite(current.x) ||
    !Number.isFinite(current.y) ||
    !Number.isFinite(previous.x) ||
    !Number.isFinite(previous.y)
  ) {
    throw new Error("affine barycenter inputs must be finite");
  }
  return {
    x: current.x + (previous.x - current.x) * historyMix,
    y: current.y + (previous.y - current.y) * historyMix,
  };
}
