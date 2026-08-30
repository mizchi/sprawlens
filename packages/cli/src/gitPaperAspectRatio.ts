export const GIT_PAPER_ASPECT_RATIO_ABSOLUTE_TOLERANCE = 1e-9;

const csvField = (value: string): string => value.trim().replace(/^"|"$/g, "");

/** Read the fixed GIT row from the paper supplement's simple numeric CSV. */
export function publishedGitAspectRatio(contents: string, dataset: string): number {
  const rows = contents
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(",").map(csvField));
  const header = rows[0];
  if (!header) throw new Error("published aspect-ratio table is empty");
  const datasetIndex = header.indexOf(dataset);
  if (datasetIndex < 1) throw new Error(`published aspect-ratio dataset not found: ${dataset}`);
  const gitRows = rows.filter((row) => row[0]?.toLowerCase() === "git");
  if (gitRows.length !== 1)
    throw new Error("published aspect-ratio table must contain one GIT row");
  const value = Number(gitRows[0]![datasetIndex]);
  if (!Number.isFinite(value)) {
    throw new Error(`published GIT aspect ratio is not finite for ${dataset}`);
  }
  return value;
}

export type GitAspectRatioMean = {
  observationCount: number;
  revisionCount: number;
  meanAspectRatio: number;
};

const gitRectangleAspectRatios = (contents: string, revisionIndex: number): number[] => {
  const values: number[] = [];
  for (const [lineIndex, line] of contents.split(/\r?\n/).entries()) {
    if (line.trim().length === 0) continue;
    const fields = line.trim().split(/[\s,]+/);
    if (fields.length !== 5) {
      throw new Error(`invalid rectangle at revision ${revisionIndex}, line ${lineIndex + 1}`);
    }
    const width = Number(fields[3]);
    const height = Number(fields[4]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error(`non-positive rectangle at revision ${revisionIndex}, line ${lineIndex + 1}`);
    }
    values.push(Math.min(width, height) / Math.max(width, height));
  }
  return values;
};

/** Paper metric AR=min(w,h)/max(w,h), pooled over active leaf-revision
 * observations. Both the supplemental comma format and fixed-revision
 * whitespace format are accepted; no geometry is repaired. */
export function meanGitRectangleAspectRatio(
  revisionOutputs: readonly string[],
): GitAspectRatioMean {
  if (revisionOutputs.length === 0) throw new Error("at least one rectangle revision is required");
  let sum = 0;
  let observationCount = 0;
  for (const [revisionIndex, contents] of revisionOutputs.entries()) {
    const values = gitRectangleAspectRatios(contents, revisionIndex);
    sum += values.reduce((total, value) => total + value, 0);
    observationCount += values.length;
  }
  if (observationCount === 0) throw new Error("rectangle revisions contain no active leaves");
  return {
    observationCount,
    revisionCount: revisionOutputs.length,
    meanAspectRatio: sum / observationCount,
  };
}

/** Diagnostic matching the later public evaluation pipeline's equal weighting
 * of revision-level means. It is intentionally not the preregistered gate. */
export function meanOfGitRevisionAspectRatioMeans(revisionOutputs: readonly string[]): number {
  if (revisionOutputs.length === 0) throw new Error("at least one rectangle revision is required");
  const revisionMeans = revisionOutputs.map((contents, revisionIndex) => {
    const values = gitRectangleAspectRatios(contents, revisionIndex);
    if (values.length === 0)
      throw new Error(`rectangle revision ${revisionIndex} has no active leaves`);
    return values.reduce((total, value) => total + value, 0) / values.length;
  });
  return revisionMeans.reduce((total, value) => total + value, 0) / revisionMeans.length;
}

export function assessGitPaperAspectRatio(
  actual: number,
  expected: number,
  absoluteTolerance = GIT_PAPER_ASPECT_RATIO_ABSOLUTE_TOLERANCE,
): {
  actual: number;
  expected: number;
  absoluteError: number;
  absoluteTolerance: number;
  passed: boolean;
} {
  if (![actual, expected, absoluteTolerance].every(Number.isFinite) || absoluteTolerance < 0) {
    throw new Error("aspect-ratio assessment requires finite values and a non-negative tolerance");
  }
  const absoluteError = Math.abs(actual - expected);
  return {
    actual,
    expected,
    absoluteError,
    absoluteTolerance,
    passed: absoluteError <= absoluteTolerance,
  };
}
