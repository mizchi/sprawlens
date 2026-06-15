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
  // Flatten the cost matrix into one contiguous Float64Array (c[i*n + j]) for
  // cache locality, and keep every working vector in a typed array. The inner
  // augmenting-path loop is O(n³) overall, so the per-row scratch (minv/used)
  // is reset in place rather than reallocated each row.
  const c = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    const row = cost[i]!;
    for (let j = 0; j < n; j++) c[i * n + j] = row[j]!;
  }
  // 1-based internals: p[j] = row matched to column j, 0 = free
  const u = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1);
  const way = new Int32Array(n + 1);
  const minv = new Float64Array(n + 1);
  const used = new Uint8Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    minv.fill(Infinity);
    used.fill(0);
    do {
      used[j0] = 1;
      const i0 = p[j0]!;
      const rowBase = (i0 - 1) * n;
      const ui0 = u[i0]!;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = c[rowBase + j - 1]! - ui0 - v[j]!;
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
