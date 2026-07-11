import type {
  AtlasChangeEvidence,
  AtlasEdge,
  AtlasEvidence,
  AtlasTestEvidence,
  AtlasTraceEvidence,
  TestStatus,
} from "@sprawlens/contracts";

export type AtlasEvidenceInput = {
  schemaVersion?: 1;
  changes?: readonly AtlasChangeEvidence[];
  trace?: AtlasTraceEvidence | null;
  tests?: readonly AtlasTestEvidence[];
};

type AtlasEvidenceDiffStat = {
  added: number;
  deleted: number;
  touched: number;
  total: number;
  ratio: number;
};

export type AtlasEvidenceProjection = {
  changed: Map<string, "added" | "modified">;
  diffStats: Map<string, AtlasEvidenceDiffStat>;
  traceEdges: AtlasEdge[];
  traceHeat: Map<string, number>;
  testStatus: Map<string, TestStatus>;
  testDuration: Map<string, number>;
  summary: {
    changes: { added: number; modified: number; removed: number };
    traceEdges: number;
    tracedNodes: number;
    tests: { pass: number; fail: number; skip: number; todo: number };
  };
};

/** Fill absent collections without introducing Maps or other non-wire values. */
export function normalizeAtlasEvidence(input: AtlasEvidenceInput = {}): AtlasEvidence {
  return {
    schemaVersion: 1,
    changes: input.changes?.map((change) => ({ ...change })) ?? [],
    trace: input.trace
      ? {
          ...input.trace,
          edges: input.trace.edges.map((edge) => ({ ...edge })),
          heat: input.trace.heat.map((entry) => ({ ...entry })),
        }
      : null,
    tests: input.tests?.map((test) => ({ ...test })) ?? [],
  };
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Convert the wire envelope into the id-keyed values consumed by MapScene. */
export function projectAtlasEvidence(input?: AtlasEvidenceInput | null): AtlasEvidenceProjection {
  const evidence = normalizeAtlasEvidence(input ?? {});
  const changed = new Map<string, "added" | "modified">();
  const diffStats = new Map<string, AtlasEvidenceDiffStat>();
  const changeCounts = { added: 0, modified: 0, removed: 0 };
  for (const change of evidence.changes) {
    changeCounts[change.kind]++;
    if (change.kind === "removed") continue;
    changed.set(change.id, change.kind);
    if (
      change.addedLines === undefined &&
      change.deletedLines === undefined &&
      change.touchedLines === undefined &&
      change.totalLines === undefined
    ) {
      continue;
    }
    const added = Math.max(0, change.addedLines ?? (change.kind === "added" ? 1 : 0));
    const deleted = Math.max(0, change.deletedLines ?? 0);
    const touched = Math.max(0, change.touchedLines ?? added + deleted);
    const total = Math.max(1, change.totalLines ?? (change.kind === "added" ? touched : 1));
    diffStats.set(change.id, {
      added,
      deleted,
      touched,
      total,
      ratio: change.kind === "added" ? 1 : clamp01(touched / total),
    });
  }

  const traceEdges = evidence.trace?.edges.map((edge) => ({ ...edge })) ?? [];
  const traceHeat = new Map(
    evidence.trace?.heat.map((entry) => [entry.id, clamp01(entry.value)] as const) ?? [],
  );
  const testStatus = new Map<string, TestStatus>();
  const testDuration = new Map<string, number>();
  const testCounts = { pass: 0, fail: 0, skip: 0, todo: 0 };
  for (const test of evidence.tests) {
    testStatus.set(test.id, test.status);
    testCounts[test.status]++;
    if (test.durationMs !== undefined) testDuration.set(test.id, test.durationMs);
  }
  return {
    changed,
    diffStats,
    traceEdges,
    traceHeat,
    testStatus,
    testDuration,
    summary: {
      changes: changeCounts,
      traceEdges: traceEdges.length,
      tracedNodes: traceHeat.size,
      tests: testCounts,
    },
  };
}
