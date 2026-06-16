/**
 * Runtime-flow overlays: observed behavior drawn on top of the static map.
 * The same contract covers both ends of the hierarchy — an OTel request
 * trace rendered at the service level and a test execution path through a
 * CFG at the block level. Overlays decorate the graph, they never change
 * it; liftOverlay re-expresses one at any displayed level.
 */

type FlowStep = {
  nodeId: string;
  /** Optional ordering timestamp (ms or any monotonic unit). */
  at?: number;
};

export type FlowOverlay = {
  id: string;
  label: string;
} & (
  | {
      /** Ordered route (trace, test execution). */
      kind: "path";
      steps: FlowStep[];
    }
  | {
      /** Unordered intensity (coverage hit counts). */
      kind: "heat";
      hits: ReadonlyMap<string, number>;
    }
);

/**
 * Re-expresses an overlay at a coarser display level. `mapTo` maps a
 * recorded node id to its displayed ancestor (null drops the entry) —
 * typically `(id) => ancestorAt(tree, id, kind)`. Paths collapse runs of
 * consecutive equal groups (keeping the first step's timestamp); heat sums
 * hits per group.
 */
export function liftOverlay(
  overlay: FlowOverlay,
  mapTo: (nodeId: string) => string | null,
): FlowOverlay {
  if (overlay.kind === "path") {
    const steps: FlowStep[] = [];
    for (const step of overlay.steps) {
      const mapped = mapTo(step.nodeId);
      if (mapped === null) continue;
      if (steps.length > 0 && steps[steps.length - 1]!.nodeId === mapped)
        continue;
      steps.push({ ...step, nodeId: mapped });
    }
    return { ...overlay, steps };
  }
  const hits = new Map<string, number>();
  for (const [nodeId, count] of overlay.hits) {
    const mapped = mapTo(nodeId);
    if (mapped === null) continue;
    hits.set(mapped, (hits.get(mapped) ?? 0) + count);
  }
  return { ...overlay, hits };
}
