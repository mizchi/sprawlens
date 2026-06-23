import type { AtlasGraph, AtlasNode } from "@sprawlens/contracts";

/**
 * Layer classification: tests live on a separate visual layer overlaid on
 * the source map. Pluggable for other conventions (tooling, assets, ...).
 */
export type LayerOf = (fileId: string) => "source" | "test";

// Test conventions across languages: JS/TS `*.test.*`/`*.spec.*`, Go `*_test.go`,
// MoonBit blackbox `*_test.mbt` / whitebox `*_wbtest.mbt`, plus the shared
// `__tests__/` and `test(s)/` directory conventions (Rust integration tests, ...).
const TEST_PATTERN =
  /(\.(test|spec)\.[cm]?[jt]sx?$)|(_test\.go$)|(_(test|wbtest)\.mbt$)|((^|\/)(__tests__|tests?)\/)/;

/** Strip a test-file suffix back to its subject file name (idempotent if none). */
function testSubject(fileId: string): string {
  return fileId
    .replace(/\.(test|spec)(\.[cm]?[jt]sx?)$/, "$2")
    .replace(/_test\.go$/, ".go")
    .replace(/_(test|wbtest)\.mbt$/, ".mbt");
}

export const defaultLayerOf: LayerOf = (fileId) => (TEST_PATTERN.test(fileId) ? "test" : "source");

/** Node-aware layer classifier: respects a stamped `layer`, else the default. */
export type NodeLayerOf = (node: { id: string; layer?: string }) => string;

/** A node's layer: its stamped `layer` (from applyLayers), else the path/id
 * based default. The single classifier the viz and splitters should use. */
export const layerOfNode: NodeLayerOf = (node) => node.layer ?? defaultLayerOf(node.id);

export type LayerSplit = {
  /** Source-only graph: drives module derivation and the capacity layout. */
  source: AtlasGraph;
  /** Test-layer nodes, rendered as an overlay. */
  test: AtlasNode[];
};

export function splitByLayer(graph: AtlasGraph, layerOf: NodeLayerOf = layerOfNode): LayerSplit {
  const test: AtlasNode[] = [];
  const sourceNodes: AtlasNode[] = [];
  for (const node of graph.nodes) {
    const layer = layerOf(node);
    if (layer === "test") test.push(node);
    else if (layer === "source") sourceNodes.push(node);
    // other satellite layers (deps, docs, ...) are placed by their own plane
    // builders, not the source layout — drop them from both here
  }
  const sourceIds = new Set(sourceNodes.map((n) => n.id));
  return {
    source: {
      nodes: sourceNodes,
      edges: graph.edges.filter((e) => sourceIds.has(e.source) && sourceIds.has(e.target)),
    },
    test,
  };
}

/**
 * Pairs each test file with the source file it covers, so the overlay can
 * sit on top of its subject: name match (`foo.test.ts`/`foo_test.go` → `foo.*`)
 * first, then the source file it imports most. Unmatchable tests are omitted.
 */
export function matchTestTargets(
  graph: AtlasGraph,
  layerOf: NodeLayerOf = layerOfNode,
): Map<string, string> {
  const sourceIds = new Set(graph.nodes.filter((n) => layerOf(n) === "source").map((n) => n.id));
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
    if (layerOf(node) !== "test") continue;
    const nameMatch = testSubject(node.id);
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
