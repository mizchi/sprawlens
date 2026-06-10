import type { AtlasGraph, AtlasNode } from "../contracts/graph.js";
import { createRng } from "../kernel/rng.js";

export type SyntheticOptions = {
  count: number;
  seed: number;
  /** Probability of an edge from a node to each candidate in earlier layers. */
  edgeDensity?: number;
};

/**
 * Layered DAG with a pareto-ish LOC distribution, mimicking module
 * dependency graphs: later nodes import earlier ones.
 */
/** Cheap deterministic string hash for per-file symbol seeds. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Splits a file's LOC into 2..8 symbol nodes with a skewed distribution.
 * Deterministic per (fileId, seed) so nested layouts are reproducible.
 */
export function synthesizeSymbols(
  fileId: string,
  loc: number,
  seed: number,
): AtlasNode[] {
  const rng = createRng(hashString(fileId) ^ seed);
  const count = 2 + Math.floor(rng() * 7);
  const shares = Array.from({ length: count }, () => 0.1 + rng() ** 2);
  const totalShare = shares.reduce((s, v) => s + v, 0);
  let remaining = loc;
  return shares.map((share, i) => {
    const isLast = i === count - 1;
    const symbolLoc = isLast
      ? remaining
      : Math.max(1, Math.round((loc * share) / totalShare));
    remaining -= symbolLoc;
    return {
      id: `${fileId}#s${i}`,
      kind: "symbol",
      label: `${fileId}#s${i}`,
      metrics: { loc: Math.max(1, symbolLoc) },
    };
  });
}

export function createSyntheticGraph(options: SyntheticOptions): AtlasGraph {
  const { count, seed, edgeDensity = 0.15 } = options;
  const rng = createRng(seed);
  const layerCount = Math.max(2, Math.round(Math.sqrt(count)));
  const nodes: AtlasNode[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    kind: "file",
    label: `n${i}.ts`,
    metrics: { loc: Math.round(20 + 980 * rng() ** 3) },
  }));
  const layerOf = (index: number) =>
    Math.floor((index / count) * layerCount);
  const edges: AtlasGraph["edges"] = [];
  for (let i = 0; i < count; i++) {
    const layer = layerOf(i);
    if (layer === 0) continue;
    let linked = false;
    for (let j = 0; j < i; j++) {
      if (layerOf(j) >= layer) continue;
      if (rng() < edgeDensity) {
        edges.push({ source: `n${i}`, target: `n${j}` });
        linked = true;
      }
    }
    if (!linked) {
      // keep the DAG connected: link to a random earlier node
      const j = Math.floor(rng() * i);
      edges.push({ source: `n${i}`, target: `n${j}` });
    }
  }
  return { nodes, edges };
}
