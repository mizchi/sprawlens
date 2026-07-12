export type AstDiffRenderTrial = {
  renderMs: number;
  frameIntervalsMs: number[];
  longTaskDurationsMs: number[];
  domNodes: number;
  svgNodes: number;
  polygons: number;
  paths: number;
  texts: number;
  heapBytes: number;
};

type Distribution = {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
};

export type AstDiffRenderSummary = {
  trials: number;
  renderMs: Distribution;
  frames: Distribution & { count: number; slowCount: number; slowRate: number };
  longTasks: { count: number; totalMs: number; maxMs: number };
  domNodes: Distribution;
  svgNodes: Distribution;
  polygons: Distribution;
  paths: Distribution;
  texts: Distribution;
  heapBytes: Distribution;
};

export function summarizeAstDiffRenderTrials(
  trials: readonly AstDiffRenderTrial[],
  options: { slowFrameThresholdMs?: number } = {},
): AstDiffRenderSummary {
  if (trials.length === 0) throw new Error("at least one render trial is required");
  const frameIntervals = trials.flatMap((trial) => trial.frameIntervalsMs);
  const longTasks = trials.flatMap((trial) => trial.longTaskDurationsMs);
  const slowFrameThresholdMs = options.slowFrameThresholdMs ?? 20;
  const slowCount = frameIntervals.filter((value) => value > slowFrameThresholdMs).length;
  return {
    trials: trials.length,
    renderMs: distribution(trials.map((trial) => trial.renderMs)),
    frames: {
      ...distribution(frameIntervals),
      count: frameIntervals.length,
      slowCount,
      slowRate: frameIntervals.length > 0 ? slowCount / frameIntervals.length : 0,
    },
    longTasks: {
      count: longTasks.length,
      totalMs: longTasks.reduce((sum, value) => sum + value, 0),
      maxMs: longTasks.length > 0 ? Math.max(...longTasks) : 0,
    },
    domNodes: distribution(trials.map((trial) => trial.domNodes)),
    svgNodes: distribution(trials.map((trial) => trial.svgNodes)),
    polygons: distribution(trials.map((trial) => trial.polygons)),
    paths: distribution(trials.map((trial) => trial.paths)),
    texts: distribution(trials.map((trial) => trial.texts)),
    heapBytes: distribution(trials.map((trial) => trial.heapBytes)),
  };
}

function distribution(values: readonly number[]): Distribution {
  if (values.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}
