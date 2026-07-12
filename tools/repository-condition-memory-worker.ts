import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { stableNeighborhoodUpdate } from "../packages/layout/src/stableNeighborhood.ts";
import { loadCodesprawlBenchmarkCases } from "../packages/cli/src/deltaBenchmarkDataset.ts";
import { assertConditionMemoryWorkload } from "../packages/cli/src/repositoryEvaluationMemory.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";

const condition = process.argv[2];
if (condition !== "baseline" && condition !== "stable") {
  throw new Error("usage: repository-condition-memory-worker <baseline|stable>");
}

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(projectRoot, "research/repository-evaluation-manifest.json");
const collectionRoot = resolve(projectRoot, "research/artifacts/repository-evaluation");
const primarySummaryPath = resolve(
  projectRoot,
  "research/results/repository-evaluation-primary-summary.json",
);
const CLIP = { kind: "rect" as const, x: 0, y: 0, width: 1000, height: 700 };

const manifestBytes = await readFile(manifestPath);
const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");
const manifest = parseRepositoryEvaluationManifest(JSON.parse(manifestBytes.toString("utf8")));
const primary = JSON.parse(await readFile(primarySummaryPath, "utf8")) as {
  manifestHash: string;
  flow: {
    analyzedRepositories: number;
    cases: number;
    trials: number;
  };
  repositories: Array<{ fullName: string; status: string }>;
};
if (primary.manifestHash !== manifestHash)
  throw new Error("primary summary manifest hash mismatch");
const analyzed = primary.repositories.filter((repository) => repository.status === "analyzed");
const datasets = await Promise.all(
  analyzed.map(async (repository) => ({
    ...(await loadCodesprawlBenchmarkCases(
      resolve(collectionRoot, repository.fullName),
      manifest.selectionProtocol.benchmark,
    )),
    repository: repository.fullName,
  })),
);

let cases = 0;
let calls = 0;
let steps = 0;
let weightedSolves = 0;
const started = performance.now();
for (const [repositoryIndex, dataset] of datasets.entries()) {
  process.stderr.write(
    `[${condition} ${repositoryIndex + 1}/${datasets.length}] ${dataset.repository}\n`,
  );
  cases += dataset.cases.length;
  for (const benchmarkCase of dataset.cases) {
    for (const seed of manifest.selectionProtocol.benchmark.seeds) {
      const before = stableNeighborhoodUpdate(
        benchmarkCase.before.nodes,
        benchmarkCase.before.edges,
        CLIP,
        { seed, anchorMixes: [0], swapPasses: [8], maxSteps: 800 },
      );
      const anchors = new Map(
        before.baseline.state.cells.map((cell) => [cell.id, cell.site] as const),
      );
      const result = stableNeighborhoodUpdate(
        benchmarkCase.after.nodes,
        benchmarkCase.after.edges,
        CLIP,
        {
          seed,
          anchors,
          anchorMixes: condition === "baseline" ? [0] : [0, 0.25, 0.5, 0.75, 1],
          swapPasses: [8],
          adjacencyTolerance: 0,
          maxSteps: 800,
        },
      );
      calls++;
      steps += result.totalSteps;
      weightedSolves += result.weightedSolves;
    }
  }
}

const measurement = {
  schemaVersion: 1 as const,
  condition,
  manifestHash,
  repositories: datasets.length,
  cases,
  calls,
  wallClockMs: performance.now() - started,
  maxRssKb: process.resourceUsage().maxRSS,
  meanSteps: steps / calls,
  meanWeightedSolves: weightedSolves / calls,
};
assertConditionMemoryWorkload(measurement, {
  repositories: primary.flow.analyzedRepositories,
  cases: primary.flow.cases,
  calls: primary.flow.trials,
});
process.stdout.write(`${JSON.stringify(measurement)}\n`);
