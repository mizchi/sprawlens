import { readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  buildDeltaBenchmarkCorpus,
  runDeltaLayoutBenchmark,
  summarizeSamples,
} from "@sprawlens/layout";
import {
  deriveModuleIdOf,
  directoryGrouping,
  snapshotToAtlasGraph,
  type SnapshotLike,
} from "@sprawlens/schema";

type SnapshotArtifact = SnapshotLike & {
  commit: { hash: string; shortHash?: string; timestamp: string };
};
type BenchmarkGrouping = "module" | "directory" | "repository";
type DatasetOptions = {
  minNodes?: number;
  maxNodes?: number;
  grouping?: BenchmarkGrouping;
  directoryDepth?: number;
};
type BenchmarkResult = ReturnType<typeof runDeltaLayoutBenchmark>;

export type BenchmarkCliOptions = {
  codesprawl: string[];
  seeds?: number[];
  stableSwapPasses?: number[];
  format: "json" | "csv";
  minNodes: number;
  maxNodes: number;
  grouping: BenchmarkGrouping;
  directoryDepth: number;
  help?: boolean;
};

const positiveInteger = (value: string, name: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be positive integers`);
  return parsed;
};
const swapPass = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 8) {
    throw new Error("stable-swap-passes must be integers between 0 and 8");
  }
  return parsed;
};

export function parseBenchmarkArgs(args: readonly string[]): BenchmarkCliOptions {
  const options: BenchmarkCliOptions = {
    codesprawl: [],
    format: "json",
    minNodes: 3,
    maxNodes: 80,
    grouping: "module",
    directoryDepth: 2,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const value = () => {
      const next = args[++i];
      if (next === undefined) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === "--codesprawl") options.codesprawl.push(value());
    else if (arg === "--seeds") {
      const raw = value().split(",");
      options.seeds = raw.map((seed) => positiveInteger(seed, "seeds"));
    } else if (arg === "--format") {
      const format = value();
      if (format !== "json" && format !== "csv") throw new Error("format must be json or csv");
      options.format = format;
    } else if (arg === "--stable-swap-passes") {
      options.stableSwapPasses = value().split(",").map(swapPass);
    } else if (arg === "--grouping") {
      const grouping = value();
      if (grouping !== "module" && grouping !== "directory" && grouping !== "repository") {
        throw new Error("grouping must be module, directory, or repository");
      }
      options.grouping = grouping;
    } else if (arg === "--directory-depth") {
      options.directoryDepth = positiveInteger(value(), "directory-depth");
    } else if (arg === "--min-nodes") options.minNodes = positiveInteger(value(), "min-nodes");
    else if (arg === "--max-nodes") options.maxNodes = positiveInteger(value(), "max-nodes");
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown benchmark option: ${arg}`);
  }
  if (options.minNodes > options.maxNodes) throw new Error("min-nodes must not exceed max-nodes");
  if (options.stableSwapPasses && !options.stableSwapPasses.includes(8)) {
    throw new Error("stable-swap-passes must include 8 for the NPVT baseline");
  }
  return options;
}

/** Load chronological commit pairs and split them into changed grouping cases. */
export async function loadCodesprawlBenchmarkCases(
  inputPath: string,
  options: DatasetOptions = {},
) {
  const input = resolve(inputPath);
  const directConfig = await readFile(join(input, "config.json"), "utf8").catch(() => null);
  const directory = directConfig === null ? join(input, ".codesprawl") : input;
  const config = JSON.parse(
    directConfig ?? (await readFile(join(directory, "config.json"), "utf8")),
  ) as {
    repoPath?: string;
  };
  const files = (await readdir(join(directory, "snapshots")))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const snapshots = await Promise.all(
    files.map(
      async (file) =>
        JSON.parse(await readFile(join(directory, "snapshots", file), "utf8")) as SnapshotArtifact,
    ),
  );
  snapshots.sort((a, b) => a.commit.timestamp.localeCompare(b.commit.timestamp));
  const repository = basename(config.repoPath ?? resolve(directory, ".."));
  const graphs = snapshots.map(snapshotToAtlasGraph);
  const pairs = graphs.slice(1).map((after, index) => {
    const before = graphs[index]!;
    const beforeSnapshot = snapshots[index]!;
    const afterSnapshot = snapshots[index + 1]!;
    return {
      name: `${repository}:${beforeSnapshot.commit.shortHash ?? beforeSnapshot.commit.hash.slice(0, 7)}..${afterSnapshot.commit.shortHash ?? afterSnapshot.commit.hash.slice(0, 7)}`,
      before,
      after,
    };
  });
  const fileIds = pairs.flatMap((pair) => [
    ...pair.before.nodes.map((node) => node.id),
    ...pair.after.nodes.map((node) => node.id),
  ]);
  const grouping = options.grouping ?? "module";
  const directoryDepth = options.directoryDepth ?? 2;
  if (grouping === "directory" && (!Number.isInteger(directoryDepth) || directoryDepth <= 0)) {
    throw new Error("directoryDepth must be a positive integer");
  }
  const groupOf =
    grouping === "module"
      ? deriveModuleIdOf(fileIds)
      : grouping === "directory"
        ? directoryGrouping(directoryDepth).groupOf
        : () => repository;
  const corpus = buildDeltaBenchmarkCorpus(pairs, {
    groupOf,
    minNodes: options.minNodes,
    maxNodes: options.maxNodes,
  });
  const snapshotNodeCounts = graphs.map((graph) => graph.nodes.length);
  return {
    schemaVersion: 2 as const,
    repository,
    snapshotCount: snapshots.length,
    pairCount: pairs.length,
    grouping:
      grouping === "directory"
        ? ({ kind: grouping, maxDepth: directoryDepth } as const)
        : ({ kind: grouping } as const),
    observed: {
      snapshotsWithNodes: snapshotNodeCounts.filter((count) => count > 0).length,
      minSnapshotNodes: snapshotNodeCounts.length === 0 ? 0 : Math.min(...snapshotNodeCounts),
      maxSnapshotNodes: snapshotNodeCounts.length === 0 ? 0 : Math.max(...snapshotNodeCounts),
    },
    cases: corpus.cases,
    selection: corpus.selection,
  };
}

export type LoadedDataset = Awaited<ReturnType<typeof loadCodesprawlBenchmarkCases>>;
export type DatasetExclusion = {
  code:
    | "insufficient-history"
    | "no-analyzable-nodes"
    | "no-candidate-groups"
    | "all-groups-too-small"
    | "all-groups-too-large"
    | "all-groups-unchanged"
    | "mixed-selection-exclusions";
};

/** Explain why a loaded repository yielded no benchmark case. */
export function classifyDatasetExclusion(dataset: LoadedDataset): DatasetExclusion | null {
  if (dataset.cases.length > 0) return null;
  if (dataset.pairCount === 0) return { code: "insufficient-history" };
  if (dataset.observed.snapshotsWithNodes === 0) return { code: "no-analyzable-nodes" };
  const { candidateGroups, excluded } = dataset.selection;
  if (candidateGroups === 0) return { code: "no-candidate-groups" };
  if (excluded.tooSmall === candidateGroups) return { code: "all-groups-too-small" };
  if (excluded.tooLarge === candidateGroups) return { code: "all-groups-too-large" };
  if (excluded.unchanged === candidateGroups) return { code: "all-groups-unchanged" };
  return { code: "mixed-selection-exclusions" };
}

export type RepositoryBenchmarkProgress = {
  index: number;
  total: number;
  repository: string;
  cases: number;
  status: "analyzed" | "excluded";
};
export type RepositoryBenchmarkOptions = {
  seeds?: readonly number[];
  stableSwapPasses?: readonly number[];
  onRepository?: (progress: RepositoryBenchmarkProgress) => void;
};
type ContrastMetric =
  | "adjacencyGain"
  | "edgeLengthReduction"
  | "displacementReduction"
  | "objectiveReduction"
  | "stepReduction";
type BenchmarkContrasts = BenchmarkResult["aggregate"]["contrasts"];
const CONTRAST_METRICS: readonly ContrastMetric[] = [
  "adjacencyGain",
  "edgeLengthReduction",
  "displacementReduction",
  "objectiveReduction",
  "stepReduction",
];

const publicDataset = (dataset: LoadedDataset) => {
  const { cases: _, ...metadata } = dataset;
  return metadata;
};

const stableSelectionDiagnostics = (benchmark: BenchmarkResult) => {
  const trials = benchmark.scenarios.flatMap((scenario) => scenario.trials);
  const anchorMixCounts: Record<string, number> = {
    "0": 0,
    "0.25": 0,
    "0.5": 0,
    "0.75": 0,
    "1": 0,
  };
  const swapPassCounts: Record<string, number> = {};
  let fallbackTrials = 0;
  let singleAssignmentTrials = 0;
  let noDisplacementGainTrials = 0;
  let adjacencyGainTrials = 0;
  let eligibleCandidates = 0;
  let weightedSolves = 0;
  for (const trial of trials) {
    const selection = trial.stableSelection;
    const key = String(selection.anchorMix);
    anchorMixCounts[key] = (anchorMixCounts[key] ?? 0) + 1;
    const swapKey = String(selection.swapPasses);
    swapPassCounts[swapKey] = (swapPassCounts[swapKey] ?? 0) + 1;
    if (selection.anchorMix === 0) fallbackTrials++;
    if (selection.weightedSolves === 1) singleAssignmentTrials++;
    const stable = trial.conditions.stableNeighborhood;
    const baseline = trial.conditions.neighborhoodSwap;
    if (baseline.displacement - stable.displacement <= 1e-12) noDisplacementGainTrials++;
    if (stable.adjacency - baseline.adjacency > 1e-12) adjacencyGainTrials++;
    eligibleCandidates += selection.eligibleCandidates;
    weightedSolves += selection.weightedSolves;
  }
  const count = Math.max(1, trials.length);
  return {
    trials: trials.length,
    anchorMixCounts,
    swapPassCounts,
    fallbackTrials,
    fallbackRate: fallbackTrials / count,
    singleAssignmentTrials,
    singleAssignmentRate: singleAssignmentTrials / count,
    noDisplacementGainTrials,
    noDisplacementGainRate: noDisplacementGainTrials / count,
    adjacencyGainTrials,
    adjacencyGainRate: adjacencyGainTrials / count,
    meanEligibleCandidates: eligibleCandidates / count,
    meanWeightedSolves: weightedSolves / count,
  };
};

/** Run each repository independently, then summarize repository-level means. */
export function runRepositoryBenchmarkBatch(
  datasets: readonly LoadedDataset[],
  options: RepositoryBenchmarkOptions = {},
) {
  if (datasets.length === 0) throw new Error("repository benchmark requires at least one dataset");
  const repositoryNames = datasets.map((dataset) => dataset.repository);
  if (new Set(repositoryNames).size !== repositoryNames.length) {
    throw new Error("duplicate repository names in benchmark batch");
  }
  const repositories = datasets.map((dataset, datasetIndex) => {
    const result =
      dataset.cases.length === 0
        ? {
            dataset: publicDataset(dataset),
            benchmark: null,
            stableSelection: null,
            exclusion: classifyDatasetExclusion(dataset)!,
          }
        : (() => {
            const benchmark = runDeltaLayoutBenchmark({
              cases: dataset.cases,
              ...(options.seeds ? { seeds: options.seeds } : {}),
              ...(options.stableSwapPasses ? { stableSwapPasses: options.stableSwapPasses } : {}),
            });
            return {
              dataset: publicDataset(dataset),
              benchmark,
              stableSelection: stableSelectionDiagnostics(benchmark),
              exclusion: null,
            };
          })();
    options.onRepository?.({
      index: datasetIndex + 1,
      total: datasets.length,
      repository: dataset.repository,
      cases: dataset.cases.length,
      status: result.benchmark === null ? "excluded" : "analyzed",
    });
    return result;
  });
  const analyzed = repositories.filter(
    (repository): repository is (typeof repositories)[number] & { benchmark: BenchmarkResult } =>
      repository.benchmark !== null,
  );
  if (analyzed.length === 0) {
    return {
      schemaVersion: 2 as const,
      repositories,
      repositorySummary: {
        unit: "repository mean paired difference" as const,
        interval: "two-sided Student t 95%" as const,
        includedRepositories: 0,
        excludedRepositories: repositories.length,
        contrasts: null,
        stableSelection: null,
      },
    };
  }
  const contrastNames = Object.keys(analyzed[0]!.benchmark.aggregate.contrasts) as Array<
    keyof BenchmarkContrasts
  >;
  const contrasts = Object.fromEntries(
    contrastNames.map((contrast) => [
      contrast,
      Object.fromEntries(
        CONTRAST_METRICS.map((metric) => [
          metric,
          summarizeSamples(
            analyzed.map(
              (repository) => repository.benchmark.aggregate.contrasts[contrast][metric].mean,
            ),
          ),
        ]),
      ),
    ]),
  ) as Record<
    keyof BenchmarkContrasts,
    Record<ContrastMetric, ReturnType<typeof summarizeSamples>>
  >;
  const stableSelection = {
    anchorMixCounts: analyzed.reduce<Record<string, number>>((counts, repository) => {
      for (const [mix, count] of Object.entries(repository.stableSelection!.anchorMixCounts)) {
        counts[mix] = (counts[mix] ?? 0) + count;
      }
      return counts;
    }, {}),
    swapPassCounts: analyzed.reduce<Record<string, number>>((counts, repository) => {
      for (const [passes, count] of Object.entries(repository.stableSelection!.swapPassCounts)) {
        counts[passes] = (counts[passes] ?? 0) + count;
      }
      return counts;
    }, {}),
    fallbackRate: summarizeSamples(
      analyzed.map((repository) => repository.stableSelection!.fallbackRate),
    ),
    singleAssignmentRate: summarizeSamples(
      analyzed.map((repository) => repository.stableSelection!.singleAssignmentRate),
    ),
    noDisplacementGainRate: summarizeSamples(
      analyzed.map((repository) => repository.stableSelection!.noDisplacementGainRate),
    ),
    adjacencyGainRate: summarizeSamples(
      analyzed.map((repository) => repository.stableSelection!.adjacencyGainRate),
    ),
    meanEligibleCandidates: summarizeSamples(
      analyzed.map((repository) => repository.stableSelection!.meanEligibleCandidates),
    ),
    meanWeightedSolves: summarizeSamples(
      analyzed.map((repository) => repository.stableSelection!.meanWeightedSolves),
    ),
  };
  return {
    schemaVersion: 2 as const,
    repositories,
    repositorySummary: {
      unit: "repository mean paired difference" as const,
      interval: "two-sided Student t 95%" as const,
      includedRepositories: analyzed.length,
      excludedRepositories: repositories.length - analyzed.length,
      contrasts,
      stableSelection,
    },
  };
}

const csvCell = (value: string | number | boolean): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Flatten paired trials for R/Python/Jupyter analysis. */
export function benchmarkResultToCsv(result: BenchmarkResult): string {
  const header = [
    "scenario",
    "seed",
    "condition",
    "converged",
    "nodes_before",
    "nodes_after",
    "edges_after",
    "max_area_error",
    "mean_area_error",
    "adjacency",
    "edge_length",
    "displacement",
    "objective",
    "steps",
    "stable_anchor_mix",
    "stable_swap_passes",
    "stable_candidate_count",
    "stable_eligible_candidates",
    "stable_weighted_solves",
  ];
  const rows: Array<Array<string | number | boolean>> = [header];
  for (const scenario of result.scenarios) {
    for (const trial of scenario.trials) {
      for (const condition of Object.keys(trial.conditions) as Array<
        keyof typeof trial.conditions
      >) {
        const metrics = trial.conditions[condition];
        rows.push([
          scenario.name,
          trial.seed,
          condition,
          metrics.converged,
          scenario.nodesBefore,
          scenario.nodesAfter,
          scenario.edgesAfter,
          metrics.maxAreaError,
          metrics.meanAreaError,
          metrics.adjacency,
          metrics.edgeLength,
          metrics.displacement,
          metrics.objective,
          metrics.steps,
          trial.stableSelection.anchorMix,
          trial.stableSelection.swapPasses,
          trial.stableSelection.candidateCount,
          trial.stableSelection.eligibleCandidates,
          trial.stableSelection.weightedSolves,
        ]);
      }
    }
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function benchmarkBatchToCsv(batch: ReturnType<typeof runRepositoryBenchmarkBatch>): string {
  const output: string[] = [];
  for (const repository of batch.repositories) {
    if (!repository.benchmark) continue;
    const [header, ...rows] = benchmarkResultToCsv(repository.benchmark).trimEnd().split("\n");
    if (output.length === 0) output.push(`repository,${header}`);
    output.push(...rows.map((row) => `${csvCell(repository.dataset.repository)},${row}`));
  }
  return `${output.join("\n")}\n`;
}
