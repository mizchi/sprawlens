import { diffGraphs as deltaDiff } from "@sprawlens/schema";
import type { AtlasGraph } from "@sprawlens/schema";
import type { SnapshotLike } from "@sprawlens/schema";

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

type NodeChange = {
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
export function buildHistoryIndex(entries: readonly HistoryEntry[]): HistoryIndex {
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

/**
 * File-level diff between two displayed commits, for highlighting. A thin
 * adapter over the shared {@link deltaDiff} contract: added + modified fold
 * into one `changed` map, and prev=null highlights nothing (the first
 * commit has no parent to contrast against).
 */
export function diffGraphs(prev: AtlasGraph | null, next: AtlasGraph): GraphDiff {
  const changed = new Map<string, "added" | "modified">();
  if (!prev) return { changed, removed: [] };
  const delta = deltaDiff(prev, next);
  for (const node of delta.added) changed.set(node.id, "added");
  for (const node of delta.modified) changed.set(node.id, "modified");
  return { changed, removed: delta.removed };
}
