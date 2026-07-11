import { createHash } from "node:crypto";
import { cpus } from "node:os";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { stableNeighborhoodUpdate } from "../packages/layout/src/stableNeighborhood.ts";
import { loadCodesprawlBenchmarkCases } from "../packages/cli/src/deltaBenchmarkDataset.ts";
import {
  summarizeRepositoryEvaluationCost,
  type RepositoryCostMeasurement,
} from "../packages/cli/src/repositoryEvaluationCost.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const PRIMARY_MANIFEST_SHA256 = "6bb2b00d95b4d02acfa8d8fbdd9e47f3f8ca9b6829e637f715a6d0f439444b23";
const CLIP = { kind: "rect" as const, x: 0, y: 0, width: 1000, height: 700 };
const MAX_STEPS = 800;

type Options = {
  manifest: string;
  collectionRoot: string;
  rawOutput: string;
  summaryOutput: string;
  repetitions: number;
  warmupIterations: number;
};

function parseArgs(args: readonly string[]): Options {
  const options: Options = {
    manifest: resolve(projectRoot, "research/repository-evaluation-manifest.json"),
    collectionRoot: resolve(projectRoot, "research/artifacts/repository-evaluation"),
    rawOutput: resolve(projectRoot, "research/artifacts/repository-evaluation/cost.json"),
    summaryOutput: resolve(projectRoot, "research/results/repository-evaluation-cost-summary.json"),
    repetitions: 3,
    warmupIterations: 5,
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    const value = () => {
      const next = args[++index];
      if (!next) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === "--manifest") options.manifest = resolve(value());
    else if (arg === "--collection-root") options.collectionRoot = resolve(value());
    else if (arg === "--raw-output") options.rawOutput = resolve(value());
    else if (arg === "--summary-output") options.summaryOutput = resolve(value());
    else if (arg === "--repetitions") options.repetitions = Number(value());
    else if (arg === "--warmup-iterations") options.warmupIterations = Number(value());
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!Number.isInteger(options.repetitions) || options.repetitions <= 0) {
    throw new Error("--repetitions must be a positive integer");
  }
  if (!Number.isInteger(options.warmupIterations) || options.warmupIterations < 0) {
    throw new Error("--warmup-iterations must be a non-negative integer");
  }
  return options;
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

const options = parseArgs(process.argv.slice(2));
const manifestBytes = await readFile(options.manifest);
const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");
if (manifestHash !== PRIMARY_MANIFEST_SHA256) throw new Error("primary manifest hash mismatch");
const manifest = parseRepositoryEvaluationManifest(JSON.parse(manifestBytes.toString("utf8")));
const status = JSON.parse(
  await readFile(resolve(options.collectionRoot, "status.json"), "utf8"),
) as {
  manifestFrozenAt?: string;
  finishedAt?: string;
  entries?: Array<{ fullName: string; status: string }>;
};
if (status.manifestFrozenAt !== manifest.frozenAt || !status.finishedAt) {
  throw new Error("collection status does not match the completed frozen manifest");
}
const collected = new Set(
  (status.entries ?? [])
    .filter((entry) => entry.status !== "failed")
    .map((entry) => entry.fullName),
);
const datasets = [];
for (const repository of manifest.repositories) {
  if (!collected.has(repository.fullName)) continue;
  const dataset = await loadCodesprawlBenchmarkCases(
    resolve(options.collectionRoot, repository.fullName),
    manifest.selectionProtocol.benchmark,
  );
  if (dataset.cases.length > 0) datasets.push({ ...dataset, repository: repository.fullName });
}
if (datasets.length === 0) throw new Error("cost benchmark has no eligible dataset");

const update = (
  dataset: (typeof datasets)[number],
  caseIndex: number,
  seed: number,
  stable: boolean,
) => {
  const benchmarkCase = dataset.cases[caseIndex]!;
  const before = stableNeighborhoodUpdate(
    benchmarkCase.before.nodes,
    benchmarkCase.before.edges,
    CLIP,
    {
      seed,
      anchorMixes: [0],
      swapPasses: [8],
      maxSteps: MAX_STEPS,
    },
  );
  const anchors = new Map(before.baseline.state.cells.map((cell) => [cell.id, cell.site] as const));
  return () =>
    stableNeighborhoodUpdate(benchmarkCase.after.nodes, benchmarkCase.after.edges, CLIP, {
      seed,
      anchors,
      anchorMixes: stable ? [0, 0.25, 0.5, 0.75, 1] : [0],
      swapPasses: [8],
      adjacencyTolerance: 0,
      maxSteps: MAX_STEPS,
    });
};

const firstDataset = datasets[0]!;
for (let iteration = 0; iteration < options.warmupIterations; iteration++) {
  update(firstDataset, 0, manifest.selectionProtocol.benchmark.seeds[0]!, false)();
  update(firstDataset, 0, manifest.selectionProtocol.benchmark.seeds[0]!, true)();
}

const measurements: RepositoryCostMeasurement[] = [];
const startedAt = new Date().toISOString();
const benchmarkStarted = performance.now();
for (const [repositoryIndex, dataset] of datasets.entries()) {
  process.stderr.write(
    `[${repositoryIndex + 1}/${datasets.length}] ${dataset.repository}: ${dataset.cases.length} cases\n`,
  );
  for (const [caseIndex, benchmarkCase] of dataset.cases.entries()) {
    for (const seed of manifest.selectionProtocol.benchmark.seeds) {
      const baselineUpdate = update(dataset, caseIndex, seed, false);
      const stableUpdate = update(dataset, caseIndex, seed, true);
      for (let repetition = 0; repetition < options.repetitions; repetition++) {
        let baselineMs = 0;
        let stableMs = 0;
        let baseline: ReturnType<typeof baselineUpdate>;
        let stable: ReturnType<typeof stableUpdate>;
        const measureBaseline = () => {
          const start = performance.now();
          baseline = baselineUpdate();
          baselineMs = performance.now() - start;
        };
        const measureStable = () => {
          const start = performance.now();
          stable = stableUpdate();
          stableMs = performance.now() - start;
        };
        if ((caseIndex + seed + repetition) % 2 === 0) {
          measureBaseline();
          measureStable();
        } else {
          measureStable();
          measureBaseline();
        }
        if (
          stable!.selected.adjacency + 1e-12 < baseline!.selected.adjacency ||
          stable!.selected.displacement > baseline!.selected.displacement + 1e-12
        ) {
          throw new Error(
            `cost benchmark dominance violation: ${dataset.repository}/${benchmarkCase.name}`,
          );
        }
        measurements.push({
          repository: dataset.repository,
          caseName: benchmarkCase.name,
          seed,
          repetition,
          baselineMs,
          stableMs,
          baselineSteps: baseline!.totalSteps,
          stableSteps: stable!.totalSteps,
          baselineWeightedSolves: baseline!.weightedSolves,
          stableWeightedSolves: stable!.weightedSolves,
        });
      }
    }
  }
}
const wallClockMs = performance.now() - benchmarkStarted;
const finishedAt = new Date().toISOString();
const result = summarizeRepositoryEvaluationCost(measurements);
const environment = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpu: cpus()[0]?.model ?? "unknown",
};
const provenance = {
  manifestHash,
  manifestFrozenAt: manifest.frozenAt,
  status: "post-hoc algorithm-only performance evaluation" as const,
  timer: "performance.now" as const,
  scope:
    "after-update stableNeighborhoodUpdate; before-layout and snapshot loading excluded" as const,
  repetitions: options.repetitions,
  warmupIterations: options.warmupIterations,
  order: "alternating baseline/stable by case + seed + repetition parity" as const,
  seeds: manifest.selectionProtocol.benchmark.seeds,
  startedAt,
  finishedAt,
  wallClockMs,
  maxRssKb: process.resourceUsage().maxRSS,
  environment,
};
await writeJsonAtomic(options.rawOutput, {
  schemaVersion: 1,
  ...provenance,
  measurements,
  ...result,
});
await writeJsonAtomic(options.summaryOutput, {
  schemaVersion: 1,
  ...provenance,
  measurements: measurements.length,
  ...result,
});
process.stdout.write(
  `${JSON.stringify(
    {
      rawOutput: options.rawOutput,
      summaryOutput: options.summaryOutput,
      measurements: measurements.length,
      wallClockMs,
      repositorySummary: result.repositorySummary,
    },
    null,
    2,
  )}\n`,
);
