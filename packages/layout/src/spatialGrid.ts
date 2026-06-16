/**
 * Uniform-grid nearest-neighbor for 2D points. The capacity layout needs each
 * site's nearest-neighbor distance every iteration to bound weight moves; the
 * naive all-pairs scan is O(n²) and dominated the inner loop. A uniform grid
 * sized to ~one point per cell answers each query by expanding rings of cells
 * until no nearer point can exist, giving the *exact* same distances in O(n)
 * average time.
 */

/**
 * Squared distance from each point to its nearest other point. Exact (matches
 * a brute-force all-pairs scan). Points with no neighbor (n < 2) get Infinity.
 * Inputs are structure-of-arrays for cache-friendly scanning.
 */
export function nearestNeighborSquared(
  xs: Float64Array,
  ys: Float64Array,
): Float64Array {
  const n = xs.length;
  const out = new Float64Array(n).fill(Infinity);
  if (n < 2) return out;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (xs[i]! < minX) minX = xs[i]!;
    if (xs[i]! > maxX) maxX = xs[i]!;
    if (ys[i]! < minY) minY = ys[i]!;
    if (ys[i]! > maxY) maxY = ys[i]!;
  }
  const width = Math.max(maxX - minX, 1e-12);
  const height = Math.max(maxY - minY, 1e-12);
  // ~one point per cell keeps both bucketing and ring scans O(n) on average
  const cell = Math.max(Math.sqrt((width * height) / n), 1e-12);
  const cols = Math.max(1, Math.floor(width / cell) + 1);
  const rows = Math.max(1, Math.floor(height / cell) + 1);
  const colOf = (x: number) =>
    Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cell)));
  const rowOf = (y: number) =>
    Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cell)));

  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  for (let i = 0; i < n; i++) buckets[rowOf(ys[i]!) * cols + colOf(xs[i]!)]!.push(i);

  const maxRing = cols + rows;
  for (let i = 0; i < n; i++) {
    const gx = colOf(xs[i]!);
    const gy = rowOf(ys[i]!);
    let best = Infinity;
    for (let r = 0; r <= maxRing; r++) {
      // the closest a point in ring r can be is (r-1) cells away; once best
      // beats that, no further ring can improve it
      if (r > 0 && (r - 1) * cell * ((r - 1) * cell) > best) break;
      const y0 = Math.max(gy - r, 0);
      const y1 = Math.min(gy + r, rows - 1);
      const x0 = Math.max(gx - r, 0);
      const x1 = Math.min(gx + r, cols - 1);
      for (let yy = y0; yy <= y1; yy++) {
        const onYEdge = yy === gy - r || yy === gy + r;
        for (let xx = x0; xx <= x1; xx++) {
          // only the shell at Chebyshev distance exactly r (interior already done)
          if (r > 0 && !onYEdge && xx !== gx - r && xx !== gx + r) continue;
          const bucket = buckets[yy * cols + xx]!;
          for (const j of bucket) {
            if (j === i) continue;
            const dx = xs[i]! - xs[j]!;
            const dy = ys[i]! - ys[j]!;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) best = d2;
          }
        }
      }
    }
    out[i] = best;
  }
  return out;
}
