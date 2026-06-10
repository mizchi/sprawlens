import type { AtlasGraph } from "../contracts/graph.js";
import type { SnapshotLike } from "./fixtureAdapter.js";

/** One commit of the repository history fixture. */
export type HistoryEntry = {
  hash: string;
  shortHash: string;
  message: string;
  timestamp: string;
  snapshot: SnapshotLike;
};

export type GraphDiff = {
  /** file id → change kind; removed files vanish from the layout anyway. */
  changed: Map<string, "added" | "modified">;
  removed: string[];
};

export type NodeChange = {
  index: number;
  kind: "added" | "modified" | "removed";
};

export type HistoryIndex = {
  /** diffs[i] = changes commit i introduced over its parent (i=0 empty). */
  diffs: GraphDiff[];
  /** file id → the commits that touched it, ascending. */
  nodeHistory: Map<string, NodeChange[]>;
};

/** Precomputed per-commit diffs and their per-node inversion. */
export function buildHistoryIndex(
  entries: readonly HistoryEntry[],
): HistoryIndex {
  const diffs: GraphDiff[] = [];
  const nodeHistory = new Map<string, NodeChange[]>();
  const note = (id: string, change: NodeChange) => {
    const list = nodeHistory.get(id);
    if (list) list.push(change);
    else nodeHistory.set(id, [change]);
  };
  let prev: AtlasGraph | null = null;
  for (let i = 0; i < entries.length; i++) {
    const graph = snapshotToGraph(entries[i]!.snapshot);
    const diff = diffGraphs(prev, graph);
    diffs.push(diff);
    for (const [id, kind] of diff.changed) note(id, { index: i, kind });
    for (const id of diff.removed) note(id, { index: i, kind: "removed" });
    prev = graph;
  }
  return { diffs, nodeHistory };
}

/** Minimal file-graph projection; diffing only needs ids and loc. */
function snapshotToGraph(snapshot: SnapshotLike): AtlasGraph {
  return {
    nodes: snapshot.nodes
      .filter((n) => n.type === "file" && n.path)
      .map((n) => ({
        id: n.path!,
        kind: "file" as const,
        label: n.path!,
        metrics: { loc: Math.max(n.loc ?? 0, 1) },
      })),
    edges: [],
  };
}

/** File-level diff between two displayed commits, for highlighting. */
export function diffGraphs(
  prev: AtlasGraph | null,
  next: AtlasGraph,
): GraphDiff {
  const changed = new Map<string, "added" | "modified">();
  const removed: string[] = [];
  if (!prev) return { changed, removed };
  const prevLoc = new Map(prev.nodes.map((n) => [n.id, n.metrics.loc]));
  const nextIds = new Set(next.nodes.map((n) => n.id));
  for (const node of next.nodes) {
    const before = prevLoc.get(node.id);
    if (before === undefined) changed.set(node.id, "added");
    else if (before !== node.metrics.loc) changed.set(node.id, "modified");
  }
  for (const id of prevLoc.keys()) {
    if (!nextIds.has(id)) removed.push(id);
  }
  return { changed, removed };
}
