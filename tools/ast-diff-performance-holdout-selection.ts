export type AstDiffPerformanceCandidate = {
  beforeRevision: string;
  afterRevision: string;
  changedSourceFiles: number;
  changedLines: number;
};

export type AstDiffPerformanceSelection = AstDiffPerformanceCandidate & {
  label: "min" | "q1" | "median" | "q3" | "max";
  quantile: number;
  candidateRank: number;
  candidateCount: number;
};

const QUANTILES = [
  ["min", 0],
  ["q1", 0.25],
  ["median", 0.5],
  ["q3", 0.75],
  ["max", 1],
] as const;

/**
 * Span observed source-change size without consulting any benchmark timing.
 * Ties use source-file count and then pinned revision for reproducibility.
 */
export function selectAstDiffPerformanceQuantiles(
  candidates: readonly AstDiffPerformanceCandidate[],
): AstDiffPerformanceSelection[] {
  if (candidates.length < QUANTILES.length) {
    throw new Error("performance selection requires at least 5 eligible candidates");
  }
  const revisions = new Set<string>();
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (revisions.has(candidate.afterRevision)) {
      throw new Error(`duplicate performance candidate revision: ${candidate.afterRevision}`);
    }
    revisions.add(candidate.afterRevision);
  }
  const sorted = [...candidates].sort(
    (left, right) =>
      left.changedLines - right.changedLines ||
      left.changedSourceFiles - right.changedSourceFiles ||
      left.afterRevision.localeCompare(right.afterRevision),
  );
  const selectedIndexes = new Set<number>();
  const selected = QUANTILES.map(([label, quantile]) => {
    const index = Math.round((sorted.length - 1) * quantile);
    if (selectedIndexes.has(index)) {
      throw new Error("performance quantile selection produced a duplicate candidate rank");
    }
    selectedIndexes.add(index);
    return {
      ...sorted[index]!,
      label,
      quantile,
      candidateRank: index + 1,
      candidateCount: sorted.length,
    };
  });
  return selected;
}

function validateCandidate(candidate: AstDiffPerformanceCandidate): void {
  if (!/^[0-9a-f]{40}$/.test(candidate.beforeRevision)) {
    throw new Error("performance candidate beforeRevision must be a full commit hash");
  }
  if (!/^[0-9a-f]{40}$/.test(candidate.afterRevision)) {
    throw new Error("performance candidate afterRevision must be a full commit hash");
  }
  if (!Number.isSafeInteger(candidate.changedSourceFiles) || candidate.changedSourceFiles < 1) {
    throw new Error("performance candidate changedSourceFiles must be positive");
  }
  if (!Number.isSafeInteger(candidate.changedLines) || candidate.changedLines < 1) {
    throw new Error("performance candidate changedLines must be positive");
  }
}
