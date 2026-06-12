/**
 * Kuhn-Munkres (Hungarian) minimum-cost assignment, O(n³) shortest
 * augmenting path formulation with row/column potentials. Used to match
 * data nodes onto equal-area CVT slots by embedding distance
 * (neighborhood-preserving Voronoi treemaps, Paetzold et al. 2025).
 */

/**
 * Returns `assign` where row i is matched to column `assign[i]`, minimizing
 * the total cost over all perfect matchings. The matrix must be square.
 */
export function minCostAssignment(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  // 1-based internals: p[j] = row matched to column j, 0 = free
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!] = u[p[j]!]! + delta;
          v[j] = v[j]! - delta;
        } else {
          minv[j] = minv[j]! - delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0);
  }
  const assign = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j]! > 0) assign[p[j]! - 1] = j - 1;
  }
  return assign;
}
