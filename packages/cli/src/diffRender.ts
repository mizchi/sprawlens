import type { WorkingDiff } from "@sprawlens/server";

export type DiffSummary = { added: number; modified: number; removed: number };

export type DiffOverlay = {
  changed: Map<string, "added" | "modified">;
  diffSummary: DiffSummary;
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

/** Compact one-line diff counts, e.g. "+2 ~5 -0" (added/modified/removed). */
export function formatDiffNote(summary: DiffSummary): string {
  return `+${summary.added} ~${summary.modified} -${summary.removed}`;
}
