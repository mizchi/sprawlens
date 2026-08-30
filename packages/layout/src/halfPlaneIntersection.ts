/**
 * Parameter of the zero crossing between two affine signed distances.
 *
 * Callers must provide distinct distances. When one distance is non-positive
 * and the other is non-negative, the result lies in [0, 1].
 */
export function halfPlaneBoundaryParameter(currentDistance: number, nextDistance: number): number {
  if (currentDistance === 0) return 0;
  return currentDistance / (currentDistance - nextDistance);
}
