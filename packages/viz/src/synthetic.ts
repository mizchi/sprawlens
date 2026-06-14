import type { AtlasEdge, AtlasGraph, AtlasNode } from "@sprawlens/schema";
import { createRng } from "@sprawlens/layout";

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
      kind: "symbol" as const,
      // display name carries no path — the map shows location spatially
      label: `s${i}`,
      metrics: { loc: Math.max(1, symbolLoc) },
      // first symbol is always part of the public surface
      exported: i === 0 || rng() < 0.3,
    };
  });
}

/**
 * Symbol→symbol reference edges: cross-file references follow the file
 * dependency edges; a few intra-file references link symbols within a file.
 * Symbol ids match `synthesizeSymbols(fileId, loc, 1)`.
 */
export function synthesizeSymbolEdges(
  graph: AtlasGraph,
  seed: number,
): AtlasEdge[] {
  const rng = createRng(seed ^ 0x5f3759df);
  const symbolIds = new Map<string, string[]>(
    graph.nodes.map((n) => [
      n.id,
      synthesizeSymbols(n.id, n.metrics.loc, 1).map((s) => s.id),
    ]),
  );
  const edges: AtlasEdge[] = [];
  for (const node of graph.nodes) {
    const symbols = symbolIds.get(node.id)!;
    for (let i = 1; i < symbols.length; i++) {
      if (rng() < 0.4) {
        edges.push({
          source: symbols[i]!,
          target: symbols[Math.floor(rng() * i)]!,
        });
      }
    }
  }
  for (const edge of graph.edges) {
    const sources = symbolIds.get(edge.source);
    const targets = symbolIds.get(edge.target);
    if (!sources?.length || !targets?.length) continue;
    const links = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < links; i++) {
      edges.push({
        source: sources[Math.floor(rng() * sources.length)]!,
        target: targets[Math.floor(rng() * targets.length)]!,
      });
    }
  }
  return edges;
}

export function createSyntheticGraph(options: SyntheticOptions): AtlasGraph {
  const { count, seed, edgeDensity = 0.15 } = options;
  const rng = createRng(seed);
  // module DAG first: several modules per level so the ring layout gets
  // populated rings instead of one module per rank
  const moduleCount = Math.max(3, Math.round(Math.sqrt(count)));
  const levelCount = Math.max(2, Math.round(Math.sqrt(moduleCount)));
  const levelOfModule = (m: number) =>
    Math.floor((m / moduleCount) * levelCount);
  const moduleDeps: number[][] = [];
  for (let m = 0; m < moduleCount; m++) {
    const lower: number[] = [];
    for (let other = 0; other < m; other++) {
      if (levelOfModule(other) < levelOfModule(m)) lower.push(other);
    }
    const deps = new Set<number>();
    const want = Math.min(lower.length, 1 + Math.floor(rng() * 3));
    while (deps.size < want) {
      deps.add(lower[Math.floor(rng() * lower.length)]!);
    }
    moduleDeps.push([...deps]);
  }

  // contiguous index spans per module keep the file DAG ordered by index
  const moduleOf = (index: number) =>
    Math.min(moduleCount - 1, Math.floor((index / count) * moduleCount));
  const idOf = (index: number) => `mod${moduleOf(index)}/f${index}.ts`;
  const nodes: AtlasNode[] = Array.from({ length: count }, (_, i) => ({
    id: idOf(i),
    kind: "file",
    label: `f${i}.ts`,
    metrics: { loc: Math.round(20 + 980 * rng() ** 3) },
  }));

  const edges: AtlasGraph["edges"] = [];
  for (let i = 0; i < count; i++) {
    const m = moduleOf(i);
    const deps = new Set(moduleDeps[m]);
    let linked = false;
    const candidates: number[] = [];
    for (let j = 0; j < i; j++) {
      const mj = moduleOf(j);
      if (mj !== m && !deps.has(mj)) continue;
      candidates.push(j);
      const probability = mj === m ? edgeDensity * 0.6 : edgeDensity;
      if (rng() < probability) {
        edges.push({ source: idOf(i), target: idOf(j) });
        linked = true;
      }
    }
    if (!linked && candidates.length > 0) {
      // keep the DAG connected within the module dependency structure
      const j = candidates[Math.floor(rng() * candidates.length)]!;
      edges.push({ source: idOf(i), target: idOf(j) });
    }
  }

  // test layer: roughly a quarter of the files get a name-matched unit test
  for (let i = 0; i < count; i++) {
    if (rng() >= 0.25) continue;
    const subject = nodes[i]!;
    const testId = subject.id.replace(/\.ts$/, ".test.ts");
    nodes.push({
      id: testId,
      kind: "file",
      label: `f${i}.test.ts`,
      metrics: {
        loc: Math.max(10, Math.round(subject.metrics.loc * (0.3 + rng() * 0.6))),
      },
    });
    edges.push({ source: testId, target: subject.id });
  }
  return { nodes, edges };
}
