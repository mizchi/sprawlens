import type { AtlasEdge } from "@sprawlens/contracts";
import { transitiveWeights } from "./transitiveWeight.js";

/**
 * Importance by reach into the dependency graph: how much transitively
 * depends *on* a node. `source → target` reads "source depends on target",
 * so reversing the edges turns transitiveWeights ("what I pull in") into
 * "who pulls me in". A foundation everything imports scores high; a leaf
 * consumer that nothing imports scores `baseOf(self)` alone. Shared
 * dependents (diamonds) count once and cycles share a closure, inherited
 * from transitiveWeights.
 */
export function dependentWeights(
  ids: readonly string[],
  edges: readonly AtlasEdge[],
  baseOf: (id: string) => number,
): Map<string, number> {
  const reversed = edges.map((e) => ({ source: e.target, target: e.source }));
  return transitiveWeights(ids, reversed, baseOf);
}

/**
 * Importance for center placement: transitive dependents scaled by the
 * square root of area. Pure dependent-count degenerates on the shallow,
 * near-tree dependency graphs real monorepos produce — counts tie and the
 * center pick falls to chance. Folding in √area lets a large foundation
 * (the module everything leans on) win the center while keeping centrality
 * as the tie-breaker between similar-sized modules. Dependents include the
 * node itself, so an unreferenced leaf still ranks by its own size.
 */
export function importanceScore(dependents: number, area: number): number {
  return Math.max(dependents, 1) * Math.sqrt(Math.max(area, 1));
}

export type CentralityModule = {
  id: string;
  /** Visual area; circle radius = sqrt(area / pi). */
  area: number;
  /** Higher = more depended upon = nearer the center. */
  centrality: number;
};

export type CentralityRingsOptions = {
  /** Clearance between circles, as a fraction of the mean radius. */
  gapRatio?: number;
};

/**
 * Assign each module to a concentric ring by centrality: the single most
 * depended-upon module takes the center (ring 0), the rest fall into rings
 * of decreasing centrality. Each ring is filled to its angular budget — a
 * coarse estimate of how many circles fit at that radius — so inner rings
 * stay dense and importance decreases monotonically outward. ringLayout
 * recomputes the exact radius from this assignment; the estimate here only
 * decides which shell a module lands in.
 */
export function centralityRings(
  modules: readonly CentralityModule[],
  options?: CentralityRingsOptions,
): Map<string, number> {
  const { gapRatio = 0.25 } = options ?? {};
  const result = new Map<string, number>();
  if (modules.length === 0) return result;

  const radiusOf = (m: CentralityModule) => Math.sqrt(Math.max(m.area, 1e-12) / Math.PI);
  const meanRadius = modules.reduce((s, m) => s + radiusOf(m), 0) / modules.length;
  const gap = meanRadius * gapRatio;
  const meanWidth = 2 * meanRadius + gap;

  const sorted = [...modules].sort(
    (a, b) =>
      b.centrality - a.centrality || b.area - a.area || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  // ring 0 = the lone hub; outer rings fill to their circumference budget
  result.set(sorted[0]!.id, 0);
  let outer = radiusOf(sorted[0]!); // outer extent of the placed rings
  let ring = 1;
  let i = 1;
  while (i < sorted.length) {
    const radius = outer + meanRadius + gap;
    const slots = Math.max(1, Math.round((2 * Math.PI * radius) / meanWidth));
    for (let s = 0; s < slots && i < sorted.length; s++, i++) {
      result.set(sorted[i]!.id, ring);
    }
    outer = radius + meanRadius;
    ring++;
  }
  return result;
}
