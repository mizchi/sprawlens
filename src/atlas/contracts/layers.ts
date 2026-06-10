import type { AtlasGraph, AtlasNode } from "./graph.js";

/**
 * Layer classification: tests live on a separate visual layer overlaid on
 * the source map. Pluggable for other conventions (tooling, assets, ...).
 */
export type LayerOf = (fileId: string) => "source" | "test";

const TEST_PATTERN = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(__tests__|tests?)\//;

export const defaultLayerOf: LayerOf = (fileId) =>
  TEST_PATTERN.test(fileId) ? "test" : "source";

export type LayerSplit = {
  /** Source-only graph: drives module derivation and the capacity layout. */
  source: AtlasGraph;
  /** Test-layer nodes, rendered as an overlay. */
  test: AtlasNode[];
};

export function splitByLayer(
  graph: AtlasGraph,
  layerOf: LayerOf = defaultLayerOf,
): LayerSplit {
  const test: AtlasNode[] = [];
  const sourceNodes: AtlasNode[] = [];
  for (const node of graph.nodes) {
    if (layerOf(node.id) === "test") test.push(node);
    else sourceNodes.push(node);
  }
  const sourceIds = new Set(sourceNodes.map((n) => n.id));
  return {
    source: {
      nodes: sourceNodes,
      edges: graph.edges.filter(
        (e) => sourceIds.has(e.source) && sourceIds.has(e.target),
      ),
    },
    test,
  };
}

/**
 * Pairs each test file with the source file it covers, so the overlay can
 * sit on top of its subject: name match (`foo.test.ts` → `foo.ts`) first,
 * then the source file it imports most. Unmatchable tests are omitted.
 */
export function matchTestTargets(
  graph: AtlasGraph,
  layerOf: LayerOf = defaultLayerOf,
): Map<string, string> {
  const sourceIds = new Set(
    graph.nodes.filter((n) => layerOf(n.id) === "source").map((n) => n.id),
  );
  // single pass over edges; per-test scans don't scale to monorepo sizes
  const importCounts = new Map<string, Map<string, number>>();
  for (const edge of graph.edges) {
    if (!sourceIds.has(edge.target)) continue;
    let counts = importCounts.get(edge.source);
    if (!counts) {
      counts = new Map();
      importCounts.set(edge.source, counts);
    }
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  const result = new Map<string, string>();
  for (const node of graph.nodes) {
    if (layerOf(node.id) !== "test") continue;
    const nameMatch = node.id.replace(/\.(test|spec)(\.[cm]?[jt]sx?)$/, "$2");
    if (nameMatch !== node.id && sourceIds.has(nameMatch)) {
      result.set(node.id, nameMatch);
      continue;
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [target, count] of importCounts.get(node.id) ?? []) {
      if (count > bestCount) {
        best = target;
        bestCount = count;
      }
    }
    if (best) result.set(node.id, best);
  }
  return result;
}
