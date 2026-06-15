import { computeGraphMetrics } from "./metrics.js";
import type {
  ChangedFile,
  CodeEdge,
  FileNode,
  GraphDiff,
  Hotspot,
  HotspotReason,
  ImportsEdge,
  Snapshot,
  SnapshotMetrics,
} from "@sprawlens/contracts";

export function diffSnapshots(before: Snapshot, after: Snapshot): GraphDiff {
  const beforeNodeIds = new Set(before.nodes.map((node) => node.id));
  const afterNodeIds = new Set(after.nodes.map((node) => node.id));
  const beforeEdgeIds = new Set(before.edges.map((edge) => edge.id));
  const afterEdgeIds = new Set(after.edges.map((edge) => edge.id));
  const beforeComputed = computeGraphMetrics(before.nodes, before.edges);
  const afterComputed = computeGraphMetrics(after.nodes, after.edges);
  const changedFiles = computeChangedFiles(before, after, beforeComputed.fileMetrics, afterComputed.fileMetrics);
  const hotspots = computeHotspots(before, after, changedFiles, beforeComputed.cycleFiles, afterComputed.cycleFiles);

  return {
    schemaVersion: 1,
    fromCommit: before.commit.hash,
    toCommit: after.commit.hash,
    addedNodes: difference(afterNodeIds, beforeNodeIds),
    removedNodes: difference(beforeNodeIds, afterNodeIds),
    addedEdges: difference(afterEdgeIds, beforeEdgeIds),
    removedEdges: difference(beforeEdgeIds, afterEdgeIds),
    changedFiles,
    metricDelta: computeMetricDelta(beforeComputed.metrics, afterComputed.metrics),
    hotspots,
  };
}

function computeChangedFiles(
  before: Snapshot,
  after: Snapshot,
  beforeFileMetrics: ReturnType<typeof computeGraphMetrics>["fileMetrics"],
  afterFileMetrics: ReturnType<typeof computeGraphMetrics>["fileMetrics"],
): ChangedFile[] {
  const beforeFiles = fileMap(before);
  const afterFiles = fileMap(after);
  const paths = [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort();
  const changedFiles: ChangedFile[] = [];

  for (const filePath of paths) {
    const beforeFile = beforeFiles.get(filePath);
    const afterFile = afterFiles.get(filePath);
    const beforeMetric = beforeFileMetrics[filePath];
    const afterMetric = afterFileMetrics[filePath];
    const locBefore = beforeFile?.loc;
    const locAfter = afterFile?.loc;
    const locDelta = (locAfter ?? 0) - (locBefore ?? 0);
    const fanInBefore = beforeMetric?.fanIn;
    const fanInAfter = afterMetric?.fanIn;
    const fanOutBefore = beforeMetric?.fanOut;
    const fanOutAfter = afterMetric?.fanOut;

    if (
      locDelta !== 0 ||
      (fanInAfter ?? 0) !== (fanInBefore ?? 0) ||
      (fanOutAfter ?? 0) !== (fanOutBefore ?? 0) ||
      !beforeFile ||
      !afterFile
    ) {
      changedFiles.push({
        path: filePath,
        locBefore,
        locAfter,
        locDelta,
        fanInBefore,
        fanInAfter,
        fanOutBefore,
        fanOutAfter,
      });
    }
  }

  return changedFiles;
}

function computeHotspots(
  before: Snapshot,
  after: Snapshot,
  changedFiles: ChangedFile[],
  beforeCycleFiles: string[],
  afterCycleFiles: string[],
): Hotspot[] {
  const beforePaths = new Set(fileMap(before).keys());
  const newCycleFiles = new Set(afterCycleFiles.filter((filePath) => !beforeCycleFiles.includes(filePath)));
  const unresolvedImportFiles = new Set(
    addedImportEdges(before, after)
      .filter((edge) => !edge.resolved)
      .map((edge) => pathFromFileId(edge.from))
      .filter((filePath): filePath is string => Boolean(filePath)),
  );
  const hotspots: Hotspot[] = [];

  for (const file of changedFiles) {
    const reasons = new Set<HotspotReason>();
    let score = Math.max(file.locDelta, 0) / 20;
    const fanInDelta = (file.fanInAfter ?? 0) - (file.fanInBefore ?? 0);
    const fanOutDelta = (file.fanOutAfter ?? 0) - (file.fanOutBefore ?? 0);

    if (file.locDelta >= 100) {
      reasons.add("large-loc-growth");
    }
    if (!beforePaths.has(file.path) && (file.locAfter ?? 0) >= 100) {
      score += 20;
      reasons.add("large-new-file");
    }
    if (fanInDelta > 0) {
      score += fanInDelta * 2;
      reasons.add("fan-in-increased");
    }
    if (fanOutDelta > 0) {
      score += fanOutDelta * 2;
      reasons.add("fan-out-increased");
    }
    if (newCycleFiles.has(file.path)) {
      score += 30;
      reasons.add("new-cycle");
    }
    if (unresolvedImportFiles.has(file.path)) {
      score += 10;
      reasons.add("new-unresolved-import");
    }

    if (score > 0 || reasons.size > 0) {
      hotspots.push({
        path: file.path,
        score: Number(score.toFixed(2)),
        reasons: [...reasons],
      });
    }
  }

  return hotspots.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

function addedImportEdges(before: Snapshot, after: Snapshot): ImportsEdge[] {
  const beforeEdges = new Set(before.edges.map((edge) => edge.id));
  return after.edges.filter((edge): edge is ImportsEdge => edge.type === "imports" && !beforeEdges.has(edge.id));
}

function fileMap(snapshot: Snapshot): Map<string, FileNode> {
  const files = new Map<string, FileNode>();
  for (const node of snapshot.nodes) {
    if (node.type === "file") {
      files.set(node.path, node);
    }
  }
  return files;
}

function computeMetricDelta(before: SnapshotMetrics, after: SnapshotMetrics): Partial<Record<keyof SnapshotMetrics, number>> {
  return {
    loc: after.loc - before.loc,
    fileCount: after.fileCount - before.fileCount,
    dirCount: after.dirCount - before.dirCount,
    importEdgeCount: after.importEdgeCount - before.importEdgeCount,
    unresolvedImportCount: after.unresolvedImportCount - before.unresolvedImportCount,
    cycleCount: after.cycleCount - before.cycleCount,
    largestComponentSize: after.largestComponentSize - before.largestComponentSize,
    maxFanIn: after.maxFanIn - before.maxFanIn,
    maxFanOut: after.maxFanOut - before.maxFanOut,
  };
}

function difference(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => !right.has(value)).sort();
}

function pathFromFileId(id: string): string | undefined {
  return id.startsWith("file:") ? id.slice("file:".length) : undefined;
}
