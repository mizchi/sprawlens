import type { WorkingDiff } from "@sprawlens/server";
import type { AtlasGraph } from "@sprawlens/schema";

export type DiffSummary = { added: number; modified: number; removed: number };
export type ChangeSpectrum = DiffSummary & {
  touched: number;
  upstream: number;
  downstream: number;
};

export type DiffOverlay = {
  changed: Map<string, "added" | "modified">;
  diffSummary: DiffSummary;
  changeSpectrum: ChangeSpectrum;
};

function computeChangeSpectrum(
  graph: AtlasGraph | undefined,
  changed: Map<string, "added" | "modified">,
  summary: DiffSummary,
): ChangeSpectrum {
  const changedFiles = new Set(changed.keys());
  const upstream = new Set<string>();
  const downstream = new Set<string>();
  if (graph) {
    for (const edge of graph.edges) {
      if (changedFiles.has(edge.source) && !changedFiles.has(edge.target))
        downstream.add(edge.target);
      if (changedFiles.has(edge.target) && !changedFiles.has(edge.source))
        upstream.add(edge.source);
    }
  }
  return {
    ...summary,
    touched: changed.size + summary.removed,
    upstream: upstream.size,
    downstream: downstream.size,
  };
}

/** Convert a git WorkingDiff into the inputs renderAtlasSvg expects. */
export function toDiffOverlay(diff: WorkingDiff, graph?: AtlasGraph): DiffOverlay {
  const changed = new Map<string, "added" | "modified">(Object.entries(diff.changed));
  let added = 0;
  let modified = 0;
  for (const kind of changed.values()) {
    if (kind === "added") added += 1;
    else modified += 1;
  }
  const diffSummary = { added, modified, removed: diff.removed.length };
  return {
    changed,
    diffSummary,
    changeSpectrum: computeChangeSpectrum(graph, changed, diffSummary),
  };
}

/** Compact one-line diff counts, e.g. "+2 ~5 -0" (added/modified/removed). */
export function formatDiffNote(summary: DiffSummary): string {
  return `+${summary.added} ~${summary.modified} -${summary.removed}`;
}
