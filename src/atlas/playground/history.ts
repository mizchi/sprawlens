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
