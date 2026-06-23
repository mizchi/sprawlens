import type {
  CodeEdge,
  CodeNode,
  FileGraphMetric,
  FileNode,
  ImportsEdge,
  MetricsComputation,
  SnapshotMetrics,
} from "@sprawlens/contracts";

function isFileNode(node: CodeNode): node is FileNode {
  return node.type === "file";
}

function isImportEdge(edge: CodeEdge): edge is ImportsEdge {
  return edge.type === "imports";
}

export function computeGraphMetrics(nodes: CodeNode[], edges: CodeEdge[]): MetricsComputation {
  const fileNodes = nodes.filter(isFileNode);
  const fileIdToPath = new Map(fileNodes.map((node) => [node.id, node.path] as const));
  const fileIds = new Set(fileIdToPath.keys());
  const importEdges = edges.filter(isImportEdge);
  const resolvedImportEdges = importEdges.filter(
    (edge) => edge.resolved && fileIds.has(edge.from) && fileIds.has(edge.to),
  );

  const fileMetrics: Record<string, FileGraphMetric> = {};
  for (const file of fileNodes) {
    fileMetrics[file.path] = { fanIn: 0, fanOut: 0, inCycle: false };
  }

  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  const undirected = new Map<string, Set<string>>();
  for (const id of fileIds) {
    adjacency.set(id, []);
    reverseAdjacency.set(id, []);
    undirected.set(id, new Set());
  }

  for (const edge of resolvedImportEdges) {
    adjacency.get(edge.from)?.push(edge.to);
    reverseAdjacency.get(edge.to)?.push(edge.from);
    undirected.get(edge.from)?.add(edge.to);
    undirected.get(edge.to)?.add(edge.from);

    const fromPath = fileIdToPath.get(edge.from);
    const toPath = fileIdToPath.get(edge.to);
    if (fromPath && fileMetrics[fromPath]) {
      fileMetrics[fromPath].fanOut += 1;
    }
    if (toPath && fileMetrics[toPath]) {
      fileMetrics[toPath].fanIn += 1;
    }
  }

  const { cycleCount, cycleFiles, cyclicNodeIds } = findCyclicComponents(adjacency, fileIdToPath);
  for (const path of cycleFiles) {
    if (fileMetrics[path]) {
      fileMetrics[path].inCycle = true;
    }
  }

  const fanValues = Object.values(fileMetrics);
  const metrics: SnapshotMetrics = {
    loc: fileNodes.reduce((sum, node) => sum + node.loc, 0),
    fileCount: fileNodes.length,
    dirCount: nodes.filter((node) => node.type === "dir").length,
    // external (bare-package) imports are tracked separately; these counts
    // stay about imports between project files
    importEdgeCount: importEdges.filter((edge) => !edge.external).length,
    unresolvedImportCount: importEdges.filter((edge) => !edge.resolved && !edge.external).length,
    cycleCount,
    largestComponentSize: largestConnectedComponentSize(undirected),
    maxFanIn: fanValues.reduce((max, metric) => Math.max(max, metric.fanIn), 0),
    maxFanOut: fanValues.reduce((max, metric) => Math.max(max, metric.fanOut), 0),
  };

  return {
    metrics,
    fileMetrics,
    cycleFiles,
    cyclicNodeIds,
  };
}

function largestConnectedComponentSize(graph: Map<string, Set<string>>): number {
  const seen = new Set<string>();
  let largest = 0;

  for (const node of graph.keys()) {
    if (seen.has(node)) {
      continue;
    }

    let size = 0;
    const stack = [node];
    seen.add(node);

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      size += 1;

      for (const next of graph.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }

    largest = Math.max(largest, size);
  }

  return largest;
}

function findCyclicComponents(
  graph: Map<string, string[]>,
  fileIdToPath: Map<string, string>,
): { cycleCount: number; cycleFiles: string[]; cyclicNodeIds: string[] } {
  let index = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cyclicNodeIds = new Set<string>();
  let cycleCount = 0;

  function strongConnect(node: string) {
    indices.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of graph.get(node) ?? []) {
      if (!indices.has(next)) {
        strongConnect(next);
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, lowLinks.get(next) ?? 0));
      } else if (onStack.has(next)) {
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, indices.get(next) ?? 0));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) {
      return;
    }

    const component: string[] = [];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        break;
      }
      onStack.delete(current);
      component.push(current);
      if (current === node) {
        break;
      }
    }

    const hasSelfLoop =
      component.length === 1 && (graph.get(component[0] ?? "") ?? []).includes(component[0] ?? "");
    if (component.length > 1 || hasSelfLoop) {
      cycleCount += 1;
      for (const id of component) {
        cyclicNodeIds.add(id);
      }
    }
  }

  for (const node of graph.keys()) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }

  const cycleFiles = [...cyclicNodeIds]
    .map((id) => fileIdToPath.get(id))
    .filter((path): path is string => Boolean(path))
    .sort();

  return {
    cycleCount,
    cycleFiles,
    cyclicNodeIds: [...cyclicNodeIds].sort(),
  };
}
