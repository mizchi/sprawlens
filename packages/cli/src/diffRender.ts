import type { WorkingDiff } from "@sprawlens/server";

export type DiffOverlay = {
  changed: Map<string, "added" | "modified">;
  diffSummary: { added: number; modified: number; removed: number };
};

/** Convert a git WorkingDiff into the inputs renderAtlasSvg expects. */
export function toDiffOverlay(diff: WorkingDiff): DiffOverlay {
  const changed = new Map<string, "added" | "modified">(
    Object.entries(diff.changed),
  );
  let added = 0;
  let modified = 0;
  for (const kind of changed.values()) {
    if (kind === "added") added += 1;
    else modified += 1;
  }
  return {
    changed,
    diffSummary: { added, modified, removed: diff.removed.length },
  };
}
