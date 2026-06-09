import { computeGraphMetrics } from "./metrics.js";
import type { FileNode, GraphDiff, ImportsEdge, Snapshot } from "./types.js";

export type ReviewGraphLayer = "runtime" | "test" | "tooling" | "asset";
export type ReviewGraphStatus = "stable" | "added" | "removed" | "changed" | "hotspot";

export type ReviewGraphNode = {
  id: string;
  path: string;
  label: string;
  group: string;
  layer: ReviewGraphLayer;
  x: number;
  y: number;
  z: number;
  size: number;
  loc: number;
  fanIn: number;
  fanOut: number;
  inCycle: boolean;
  status: ReviewGraphStatus;
  hotspotScore: number;
  alpha: number;
};

export type ReviewGraphEdge = {
  id: string;
  from: string;
  to: string;
  status: ReviewGraphStatus;
  alpha: number;
};

export type ReviewGraphFrame = {
  schemaVersion: 1;
  commitHash: string;
  nodes: ReviewGraphNode[];
  edges: ReviewGraphEdge[];
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
};

export type ReviewGraphFeatureCollection = {
  type: "FeatureCollection";
  features: ReviewGraphFeature[];
};

export type ReviewGraphFeature =
  | {
      type: "Feature";
      geometry: {
        type: "Point";
        coordinates: [number, number, number];
      };
      properties: Omit<ReviewGraphNode, "x" | "y" | "z"> & { kind: "node" };
    }
  | {
      type: "Feature";
      geometry: {
        type: "LineString";
        coordinates: [[number, number, number], [number, number, number]];
      };
      properties: Omit<ReviewGraphEdge, "from" | "to"> & { kind: "edge"; from: string; to: string };
    };

export type BuildReviewGraphOptions = {
  diff?: Pick<GraphDiff, "addedNodes" | "removedNodes" | "addedEdges" | "removedEdges" | "changedFiles" | "hotspots"> | null;
  maxNodes?: number;
  focusPath?: string;
};

const GROUP_WIDTH = 920;
const GROUP_HEIGHT = 620;
const CELL_WIDTH = 76;
const CELL_HEIGHT = 58;
const LAYER_Z: Record<ReviewGraphLayer, number> = {
  runtime: 0,
  test: 120,
  tooling: 240,
  asset: 360,
};

export function buildReviewGraphFrame(snapshot: Snapshot, options: BuildReviewGraphOptions = {}): ReviewGraphFrame {
  const fileNodes = snapshot.nodes.filter((node): node is FileNode => node.type === "file");
  const graphMetrics = computeGraphMetrics(snapshot.nodes, snapshot.edges);
  const selectedFileIds = selectFileIds(fileNodes, snapshot, graphMetrics.fileMetrics, options);
  const diff = options.diff ?? null;
  const hotspotByPath = new Map(diff?.hotspots.map((hotspot) => [hotspot.path, hotspot]) ?? []);
  const changedByPath = new Set(diff?.changedFiles.map((file) => file.path) ?? []);
  const addedNodeIds = new Set(diff?.addedNodes ?? []);
  const removedNodeIds = new Set(diff?.removedNodes ?? []);
  const removedEdges = new Set(diff?.removedEdges ?? []);
  const addedEdges = new Set(diff?.addedEdges ?? []);
  const groupIndexes = groupIndexMap(fileNodes);
  const groupLocalIndexes = new Map<string, number>();

  const nodes = fileNodes
    .filter((node) => selectedFileIds.has(node.id))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((node): ReviewGraphNode => {
      const group = topLevelGroup(node.path);
      const groupIndex = groupIndexes.get(group) ?? 0;
      const localIndex = groupLocalIndexes.get(group) ?? 0;
      groupLocalIndexes.set(group, localIndex + 1);
      const groupColumns = Math.max(1, Math.floor(GROUP_WIDTH / CELL_WIDTH));
      const layer = classifyLayer(node.path);
      const status = nodeStatus(node.id, node.path, addedNodeIds, removedNodeIds, changedByPath, hotspotByPath);
      const fileMetric = graphMetrics.fileMetrics[node.path] ?? { fanIn: 0, fanOut: 0, inCycle: false };

      return {
        id: node.id,
        path: node.path,
        label: basename(node.path),
        group,
        layer,
        x: (groupIndex % 4) * GROUP_WIDTH + (localIndex % groupColumns) * CELL_WIDTH,
        y: Math.floor(groupIndex / 4) * GROUP_HEIGHT + Math.floor(localIndex / groupColumns) * CELL_HEIGHT,
        z: LAYER_Z[layer],
        size: Math.max(6, Math.min(42, Math.sqrt(Math.max(node.loc, 1)) * 2.1)),
        loc: node.loc,
        fanIn: fileMetric.fanIn,
        fanOut: fileMetric.fanOut,
        inCycle: fileMetric.inCycle,
        status,
        hotspotScore: hotspotByPath.get(node.path)?.score ?? 0,
        alpha: 1,
      };
    });

  const visibleIds = new Set(nodes.map((node) => node.id));
  const edges = snapshot.edges
    .filter((edge): edge is ImportsEdge => edge.type === "imports" && edge.resolved)
    .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
    .map((edge): ReviewGraphEdge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      status: addedEdges.has(edge.id) ? "added" : removedEdges.has(edge.id) ? "removed" : "stable",
      alpha: 1,
    }));

  return {
    schemaVersion: 1,
    commitHash: snapshot.commit.hash,
    nodes,
    edges,
    bounds: computeBounds(nodes),
  };
}

export function reviewGraphToGeoJson(frame: ReviewGraphFrame): ReviewGraphFeatureCollection {
  const nodeById = new Map(frame.nodes.map((node) => [node.id, node]));
  const nodeFeatures: ReviewGraphFeature[] = frame.nodes.map((node) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [node.x, node.y, node.z],
    },
    properties: {
      id: node.id,
      path: node.path,
      label: node.label,
      group: node.group,
      layer: node.layer,
      size: node.size,
      loc: node.loc,
      fanIn: node.fanIn,
      fanOut: node.fanOut,
      inCycle: node.inCycle,
      status: node.status,
      hotspotScore: node.hotspotScore,
      alpha: node.alpha,
      kind: "node",
    },
  }));
  const edgeFeatures: ReviewGraphFeature[] = frame.edges.flatMap((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) {
      return [];
    }
    return [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [from.x, from.y, from.z],
            [to.x, to.y, to.z],
          ],
        },
        properties: {
          id: edge.id,
          from: edge.from,
          to: edge.to,
          status: edge.status,
          alpha: edge.alpha,
          kind: "edge",
        },
      } satisfies ReviewGraphFeature,
    ];
  });

  return {
    type: "FeatureCollection",
    features: [...nodeFeatures, ...edgeFeatures],
  };
}

export function interpolateReviewGraphFrames(fromFrame: ReviewGraphFrame, toFrame: ReviewGraphFrame, progress: number): ReviewGraphFrame {
  const t = Math.max(0, Math.min(1, progress));
  const fromNodes = new Map(fromFrame.nodes.map((node) => [node.id, node]));
  const toNodes = new Map(toFrame.nodes.map((node) => [node.id, node]));
  const nodeIds = [...new Set([...fromNodes.keys(), ...toNodes.keys()])].sort();
  const nodes = nodeIds.map((id): ReviewGraphNode => {
    const from = fromNodes.get(id);
    const to = toNodes.get(id);
    const base = to ?? from;
    if (!base) {
      throw new Error(`Missing node for ${id}`);
    }
    return {
      ...base,
      x: lerp(from?.x ?? to?.x ?? 0, to?.x ?? from?.x ?? 0, t),
      y: lerp(from?.y ?? to?.y ?? 0, to?.y ?? from?.y ?? 0, t),
      z: lerp(from?.z ?? to?.z ?? 0, to?.z ?? from?.z ?? 0, t),
      size: lerp(from?.size ?? 0, to?.size ?? 0, t),
      alpha: from && to ? 1 : from ? 1 - t : t,
      status: from && to ? base.status : from ? "removed" : "added",
    };
  });

  const fromEdges = new Map(fromFrame.edges.map((edge) => [edge.id, edge]));
  const toEdges = new Map(toFrame.edges.map((edge) => [edge.id, edge]));
  const edgeIds = [...new Set([...fromEdges.keys(), ...toEdges.keys()])].sort();
  const edges = edgeIds.map((id): ReviewGraphEdge => {
    const from = fromEdges.get(id);
    const to = toEdges.get(id);
    const base = to ?? from;
    if (!base) {
      throw new Error(`Missing edge for ${id}`);
    }
    return {
      ...base,
      alpha: from && to ? 1 : from ? 1 - t : t,
      status: from && to ? base.status : from ? "removed" : "added",
    };
  });

  return {
    schemaVersion: 1,
    commitHash: `${fromFrame.commitHash}..${toFrame.commitHash}@${t.toFixed(2)}`,
    nodes,
    edges,
    bounds: computeBounds(nodes),
  };
}

function selectFileIds(
  files: FileNode[],
  snapshot: Snapshot,
  fileMetrics: ReturnType<typeof computeGraphMetrics>["fileMetrics"],
  options: BuildReviewGraphOptions,
): Set<string> {
  const allIds = new Set(files.map((file) => file.id));
  if (!options.maxNodes || files.length <= options.maxNodes) {
    return allIds;
  }

  const focusId = options.focusPath ? `file:${options.focusPath}` : undefined;
  const focusNeighbors = new Set<string>(focusId ? [focusId] : []);
  if (focusId) {
    for (const edge of snapshot.edges) {
      if (edge.type === "imports" && edge.resolved && (edge.from === focusId || edge.to === focusId)) {
        focusNeighbors.add(edge.from);
        focusNeighbors.add(edge.to);
      }
    }
  }

  return new Set(
    files
      .map((file) => ({
        id: file.id,
        score:
          (focusNeighbors.has(file.id) ? 10_000 : 0) +
          (fileMetrics[file.path]?.inCycle ? 1_000 : 0) +
          (fileMetrics[file.path]?.fanIn ?? 0) * 20 +
          (fileMetrics[file.path]?.fanOut ?? 0) * 12 +
          Math.sqrt(Math.max(file.loc, 0)),
      }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, options.maxNodes)
      .map((file) => file.id),
  );
}

function groupIndexMap(files: FileNode[]): Map<string, number> {
  const groups = [...new Set(files.map((file) => topLevelGroup(file.path)))].sort();
  return new Map(groups.map((group, index) => [group, index]));
}

function computeBounds(nodes: ReviewGraphNode[]): ReviewGraphFrame["bounds"] {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 };
  }

  return {
    minX: Math.min(...nodes.map((node) => node.x)),
    minY: Math.min(...nodes.map((node) => node.y)),
    minZ: Math.min(...nodes.map((node) => node.z)),
    maxX: Math.max(...nodes.map((node) => node.x + node.size)),
    maxY: Math.max(...nodes.map((node) => node.y + node.size)),
    maxZ: Math.max(...nodes.map((node) => node.z + node.size)),
  };
}

function nodeStatus(
  id: string,
  filePath: string,
  addedNodeIds: Set<string>,
  removedNodeIds: Set<string>,
  changedPaths: Set<string>,
  hotspots: Map<string, { score: number }>,
): ReviewGraphStatus {
  if (hotspots.has(filePath)) {
    return "hotspot";
  }
  if (addedNodeIds.has(id)) {
    return "added";
  }
  if (removedNodeIds.has(id)) {
    return "removed";
  }
  if (changedPaths.has(filePath)) {
    return "changed";
  }
  return "stable";
}

function classifyLayer(filePath: string): ReviewGraphLayer {
  const parts = filePath.toLowerCase().split("/");
  const name = parts.at(-1) ?? filePath.toLowerCase();
  if (parts.some((part) => part === "test" || part === "tests" || part === "__tests__") || /[.-](test|spec)\.[cm]?[jt]sx?$/.test(name)) {
    return "test";
  }
  if (parts.some((part) => part === "scripts" || part === "tools" || part === "bin") || /config\.[cm]?[jt]s$/.test(name)) {
    return "tooling";
  }
  if (parts.some((part) => part === "assets" || part === "fixtures" || part === "public")) {
    return "asset";
  }
  return "runtime";
}

function topLevelGroup(filePath: string): string {
  return filePath.split("/")[0] || ".";
}

function basename(filePath: string): string {
  return filePath.split("/").at(-1) ?? filePath;
}

function lerp(left: number, right: number, progress: number): number {
  return left + (right - left) * progress;
}
