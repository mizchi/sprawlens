import { elevationFromEntry } from "@sprawlens/layout";
import type { AtlasGraph, ModuleIdOf } from "@sprawlens/schema";
import { parentFileOf } from "@sprawlens/schema";

type ModuleEdge = { source: string; target: string };

export function moduleDependencyEdges(graph: AtlasGraph, moduleIdOf: ModuleIdOf): ModuleEdge[] {
  const seen = new Set<string>();
  const edges: ModuleEdge[] = [];
  for (const edge of graph.edges) {
    const source = moduleIdOf(parentFileOf(edge.source));
    const target = moduleIdOf(parentFileOf(edge.target));
    if (source === target) continue;
    const key = `${source}\0${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ source, target });
  }
  return edges;
}

export function moduleDependencyElevation(
  graph: AtlasGraph,
  moduleIdOf: ModuleIdOf,
): Map<string, number> {
  const moduleEdges = moduleDependencyEdges(graph, moduleIdOf);
  if (moduleEdges.length === 0) return new Map();

  const moduleIds = new Set<string>();
  for (const edge of moduleEdges) {
    moduleIds.add(edge.source);
    moduleIds.add(edge.target);
  }

  const targets = new Set(moduleEdges.map((edge) => edge.target));
  let entries = [...moduleIds].filter((id) => !targets.has(id));
  if (entries.length === 0) entries = [...moduleIds];

  const raw = elevationFromEntry(entries, moduleEdges);
  let max = 0;
  for (const value of raw.values()) max = Math.max(max, value);
  if (max <= 0) return new Map();

  const elevation = new Map<string, number>();
  for (const [id, value] of raw) elevation.set(id, value / max);
  for (const node of graph.nodes) {
    const file = parentFileOf(node.id);
    const value = elevation.get(moduleIdOf(file));
    if (value === undefined) continue;
    elevation.set(node.id, value);
    if (!elevation.has(file)) elevation.set(file, value);
  }
  return elevation;
}
