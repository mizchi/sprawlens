import type { Vec2 } from "./vec.ts";

/**
 * Deterministic neighborhood-preserving graph embedding (tsNET-style):
 * all-pairs BFS distances → classical MDS init → t-SNE gradient descent.
 * No RNG anywhere — the same graph always yields the same coordinates, so
 * layouts stop depending on a seed lottery. Re-embedding over time passes
 * `previous`: it warm-starts the optimization, anchors points with a
 * temporal penalty λ‖y − y_prev‖², and Procrustes-aligns the result back
 * into the previous frame, which keeps timeline playback continuous.
 *
 * O(n²) memory and time per iteration; intended as a layout *seed* for up
 * to a few thousand nodes (the capacity solver owns final geometry).
 */
export type EmbedEdge = { source: string; target: string; weight?: number };

export type EmbedOptions = {
  /** Effective neighborhood size for the affinity kernel. */
  perplexity?: number;
  iterations?: number;
  /** Previous embedding: warm init + temporal anchor + alignment target. */
  previous?: ReadonlyMap<string, Vec2>;
  /** λ pulling each point toward its previous position (default 0.1 warm). */
  temporalStrength?: number;
  /** Init positions (e.g., parent-module centroids); also pin orientation. */
  hints?: ReadonlyMap<string, Vec2>;
};

const GOLDEN_ANGLE = 2.399963229728653;

export function embedGraph(
  nodes: readonly string[],
  edges: readonly EmbedEdge[],
  options: EmbedOptions = {},
): Map<string, Vec2> {
  const n = nodes.length;
  if (n === 0) return new Map();
  if (n === 1) return new Map([[nodes[0]!, { x: 0, y: 0 }]]);

  const indexOf = new Map(nodes.map((id, i) => [id, i]));
  const neighbors: number[][] = nodes.map(() => []);
  for (const edge of edges) {
    const a = indexOf.get(edge.source);
    const b = indexOf.get(edge.target);
    if (a === undefined || b === undefined || a === b) continue;
    neighbors[a]!.push(b);
    neighbors[b]!.push(a);
  }

  const dist = bfsAllPairs(n, neighbors);
  const p = affinities(n, dist, options.perplexity ?? 10);

  // --- initial positions -------------------------------------------------
  let init = classicalMds(n, dist);
  const { previous, hints } = options;
  const anchor = previous ?? hints;
  if (anchor) {
    // rigid-align the cold init into the anchor frame so orientation is
    // inherited instead of arbitrary
    const asMap = new Map(nodes.map((id, i) => [id, init[i]!]));
    const aligned = procrustesAlign(anchor, asMap);
    init = nodes.map((id) => aligned.get(id)!);
  }
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const prevIdx: (Vec2 | null)[] = nodes.map(() => null);
  for (let i = 0; i < n; i++) {
    const id = nodes[i]!;
    const prev = previous?.get(id);
    if (prev) prevIdx[i] = prev;
    const pos =
      prev ??
      hints?.get(id) ??
      (previous ? neighborMean(i, neighbors, previous, nodes) : null) ??
      init[i]!;
    // deterministic micro-jitter separates coincident inits (e.g., many
    // nodes hinted at the same centroid)
    xs[i] = pos.x + Math.cos(i * GOLDEN_ANGLE) * 1e-3;
    ys[i] = pos.y + Math.sin(i * GOLDEN_ANGLE) * 1e-3;
  }

  // --- t-SNE gradient descent --------------------------------------------
  const iterations = options.iterations ?? 250;
  const lambda = options.temporalStrength ?? (previous ? 0.1 : 0);
  const eta = n;
  const maxStep = 0.1;
  const exaggerationUntil = previous ? 0 : Math.floor(iterations / 4);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const w = new Float64Array(n * n);
  const gx = new Float64Array(n);
  const gy = new Float64Array(n);

  for (let iter = 0; iter < iterations; iter++) {
    const exaggeration = iter < exaggerationUntil ? 4 : 1;
    const momentum = iter < exaggerationUntil ? 0.5 : 0.8;
    let z = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = xs[i]! - xs[j]!;
        const dy = ys[i]! - ys[j]!;
        const wij = 1 / (1 + dx * dx + dy * dy);
        w[i * n + j] = wij;
        z += 2 * wij;
      }
    }
    gx.fill(0);
    gy.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const wij = w[i * n + j]!;
        const pij = p[i * n + j]! * exaggeration;
        const qij = wij / z;
        const f = 4 * (pij - qij) * wij;
        const dx = xs[i]! - xs[j]!;
        const dy = ys[i]! - ys[j]!;
        gx[i]! += f * dx;
        gy[i]! += f * dy;
        gx[j]! -= f * dx;
        gy[j]! -= f * dy;
      }
    }
    for (let i = 0; i < n; i++) {
      const prev = prevIdx[i];
      if (prev && lambda > 0) {
        gx[i]! += 2 * lambda * (xs[i]! - prev.x);
        gy[i]! += 2 * lambda * (ys[i]! - prev.y);
      }
      let sx = -eta * gx[i]! + momentum * vx[i]!;
      let sy = -eta * gy[i]! + momentum * vy[i]!;
      const mag = Math.hypot(sx, sy);
      if (mag > maxStep) {
        sx *= maxStep / mag;
        sy *= maxStep / mag;
      }
      vx[i] = sx;
      vy[i] = sy;
      xs[i]! += sx;
      ys[i]! += sy;
    }
  }

  // --- output frame -------------------------------------------------------
  if (previous) {
    const raw = new Map(nodes.map((id, i): [string, Vec2] => [id, { x: xs[i]!, y: ys[i]! }]));
    return procrustesAlign(previous, raw);
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += xs[i]!;
    cy += ys[i]!;
  }
  cx /= n;
  cy /= n;
  let rms = 0;
  for (let i = 0; i < n; i++) {
    rms += (xs[i]! - cx) ** 2 + (ys[i]! - cy) ** 2;
  }
  rms = Math.sqrt(rms / n) || 1;
  return new Map(
    nodes.map((id, i): [string, Vec2] => [id, { x: (xs[i]! - cx) / rms, y: (ys[i]! - cy) / rms }]),
  );
}

/**
 * Rigid similarity alignment (rotation, reflection, uniform scale,
 * translation) of `points` onto `reference`, fitted over shared ids and
 * applied to every point. Used to cancel the rotation/flip freedom of
 * embeddings between frames.
 */
export function procrustesAlign(
  reference: ReadonlyMap<string, Vec2>,
  points: ReadonlyMap<string, Vec2>,
): Map<string, Vec2> {
  const shared: [Vec2, Vec2][] = [];
  for (const [id, pt] of points) {
    const ref = reference.get(id);
    if (ref) shared.push([ref, pt]);
  }
  if (shared.length === 0) return new Map(points);
  let refCx = 0;
  let refCy = 0;
  let ptCx = 0;
  let ptCy = 0;
  for (const [ref, pt] of shared) {
    refCx += ref.x;
    refCy += ref.y;
    ptCx += pt.x;
    ptCy += pt.y;
  }
  refCx /= shared.length;
  refCy /= shared.length;
  ptCx /= shared.length;
  ptCy /= shared.length;

  // best rotation vs best rotation-after-reflection, in closed form
  let a = 0;
  let b = 0;
  let aR = 0;
  let bR = 0;
  let ptNorm = 0;
  for (const [ref, pt] of shared) {
    const rx = ref.x - refCx;
    const ry = ref.y - refCy;
    const px = pt.x - ptCx;
    const py = pt.y - ptCy;
    a += rx * px + ry * py;
    b += ry * px - rx * py;
    // reflected candidate: (px, -py)
    aR += rx * px - ry * py;
    bR += ry * px + rx * py;
    ptNorm += px * px + py * py;
  }
  const plain = Math.hypot(a, b);
  const reflected = Math.hypot(aR, bR);
  const reflect = reflected > plain;
  const theta = reflect ? Math.atan2(bR, aR) : Math.atan2(b, a);
  const scale = ptNorm > 0 ? Math.max(plain, reflected) / ptNorm : 1;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const out = new Map<string, Vec2>();
  for (const [id, pt] of points) {
    let px = pt.x - ptCx;
    let py = pt.y - ptCy;
    if (reflect) py = -py;
    out.set(id, {
      x: refCx + scale * (px * cos - py * sin),
      y: refCy + scale * (px * sin + py * cos),
    });
  }
  return out;
}

/** Hop distances between all pairs; disconnected pairs get diameter + 2. */
function bfsAllPairs(n: number, neighbors: readonly number[][]): Float64Array {
  const dist = new Float64Array(n * n).fill(-1);
  const queue = new Int32Array(n);
  let maxFinite = 1;
  for (let s = 0; s < n; s++) {
    const row = s * n;
    dist[row + s] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    while (head < tail) {
      const u = queue[head++]!;
      const du = dist[row + u]!;
      for (const v of neighbors[u]!) {
        if (dist[row + v]! >= 0) continue;
        dist[row + v] = du + 1;
        if (du + 1 > maxFinite) maxFinite = du + 1;
        queue[tail++] = v;
      }
    }
  }
  const sentinel = maxFinite + 2;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i]! < 0) dist[i] = sentinel;
  }
  return dist;
}

/** Symmetric t-SNE affinities with per-point entropy calibration. */
function affinities(n: number, dist: Float64Array, perplexity: number): Float64Array {
  const target = Math.log(Math.max(Math.min(perplexity, (n - 1) / 2), 1.3));
  const conditional = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    let beta = 1;
    let betaMin = -Infinity;
    let betaMax = Infinity;
    for (let attempt = 0; attempt < 50; attempt++) {
      let sum = 0;
      let weighted = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const d2 = dist[i * n + j]! ** 2;
        const e = Math.exp(-(d2 * beta));
        sum += e;
        weighted += d2 * e;
      }
      const entropy = sum > 0 ? Math.log(sum) + (beta * weighted) / sum : 0;
      const diff = entropy - target;
      if (Math.abs(diff) < 1e-5 || sum === 0) break;
      if (diff > 0) {
        betaMin = beta;
        beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2;
      } else {
        betaMax = beta;
        beta = betaMin === -Infinity ? beta / 2 : (beta + betaMin) / 2;
      }
    }
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const e = Math.exp(-(dist[i * n + j]! ** 2) * beta);
      conditional[i * n + j] = e;
      sum += e;
    }
    if (sum > 0) {
      for (let j = 0; j < n; j++) conditional[i * n + j]! /= sum;
    }
  }
  // symmetrize; store only as full matrix for simple indexing
  const p = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = (conditional[i * n + j]! + conditional[j * n + i]!) / (2 * n);
      const floored = Math.max(v, 1e-12);
      p[i * n + j] = floored;
      p[j * n + i] = floored;
    }
  }
  return p;
}

/**
 * Classical MDS on the distance matrix: deterministic global init.
 * Top-2 eigenvectors of the double-centered Gram matrix via power
 * iteration with fixed start vectors.
 */
function classicalMds(n: number, dist: Float64Array): Vec2[] {
  // B = -1/2 J D² J via double centering
  const d2 = new Float64Array(n * n);
  for (let i = 0; i < d2.length; i++) d2[i] = dist[i]! ** 2;
  const rowMean = new Float64Array(n);
  let grand = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += d2[i * n + j]!;
    rowMean[i] = sum / n;
    grand += sum;
  }
  grand /= n * n;
  const gram = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      gram[i * n + j] = -0.5 * (d2[i * n + j]! - rowMean[i]! - rowMean[j]! + grand);
    }
  }

  const multiply = (v: Float64Array, out: Float64Array) => {
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += gram[i * n + j]! * v[j]!;
      out[i] = sum;
    }
  };
  const normalize = (v: Float64Array) => {
    let norm = 0;
    for (let i = 0; i < n; i++) norm += v[i]! ** 2;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < n; i++) v[i]! /= norm;
    return norm;
  };
  const powerIterate = (start: (i: number) => number, deflate?: Float64Array) => {
    let v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = start(i);
    let next = new Float64Array(n);
    let value = 0;
    for (let step = 0; step < 100; step++) {
      if (deflate) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += v[i]! * deflate[i]!;
        for (let i = 0; i < n; i++) v[i]! -= dot * deflate[i]!;
      }
      normalize(v);
      multiply(v, next);
      value = normalize(next);
      [v, next] = [next, v];
    }
    return { vector: v, value };
  };

  const first = powerIterate((i) => Math.cos((i + 1) * GOLDEN_ANGLE));
  const second = powerIterate((i) => Math.sin((i + 1) * GOLDEN_ANGLE + 1), first.vector);
  const s1 = Math.sqrt(Math.max(first.value, 1e-9));
  const s2 = Math.sqrt(Math.max(second.value, 1e-9));
  return Array.from({ length: n }, (_, i) => ({
    x: first.vector[i]! * s1,
    y: second.vector[i]! * s2,
  }));
}

function neighborMean(
  index: number,
  neighbors: readonly number[][],
  previous: ReadonlyMap<string, Vec2>,
  nodes: readonly string[],
): Vec2 | null {
  let x = 0;
  let y = 0;
  let count = 0;
  for (const j of neighbors[index]!) {
    const prev = previous.get(nodes[j]!);
    if (!prev) continue;
    x += prev.x;
    y += prev.y;
    count++;
  }
  return count > 0 ? { x: x / count, y: y / count } : null;
}
