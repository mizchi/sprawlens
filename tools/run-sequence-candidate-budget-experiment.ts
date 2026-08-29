import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { loadCodesprawlBenchmarkCases } from "../packages/cli/src/deltaBenchmarkDataset.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";
import { runSequenceCandidateBudgetExperiment } from "../packages/cli/src/sequenceCandidateBudgetExperiment.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(projectRoot, "research/repository-evaluation-manifest.json");
const collectionRoot = resolve(projectRoot, "research/artifacts/repository-evaluation");
const outputPath = resolve(
  projectRoot,
  "research/results/sequence-candidate-budget-development.json",
);

const writeJsonAtomic = async (path: string, value: unknown) => {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
};

const manifestBytes = await readFile(manifestPath);
const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");
const manifest = parseRepositoryEvaluationManifest(JSON.parse(manifestBytes.toString("utf8")));
const status = JSON.parse(await readFile(resolve(collectionRoot, "status.json"), "utf8")) as {
  finishedAt?: string;
  entries?: Array<{ fullName: string; status: string }>;
};
if (!status.finishedAt || !status.entries) throw new Error("repository collection is incomplete");
const collected = new Set(
  status.entries.filter((entry) => entry.status !== "failed").map((entry) => entry.fullName),
);
const datasets = [];
for (const repository of manifest.repositories) {
  if (!collected.has(repository.fullName)) continue;
  process.stderr.write(`[candidate budget load] ${repository.fullName}\n`);
  const dataset = await loadCodesprawlBenchmarkCases(
    resolve(collectionRoot, repository.fullName),
    manifest.selectionProtocol.benchmark,
  );
  datasets.push({ repository: repository.fullName, sequences: dataset.sequences });
}

const started = performance.now();
const result = runSequenceCandidateBudgetExperiment(datasets, {
  seeds: manifest.selectionProtocol.benchmark.seeds,
  onRepository: ({ index, total, repository, sequences }) => {
    process.stderr.write(
      `[candidate budget ${index}/${total}] ${repository}: ${sequences} sequences\n`,
    );
  },
});
const artifact = {
  ...result,
  manifestHash,
  timing: {
    wallClockMs: performance.now() - started,
    maxRssKb: process.resourceUsage().maxRSS,
  },
};
await writeJsonAtomic(outputPath, artifact);
process.stdout.write(
  `${JSON.stringify(
    {
      output: outputPath,
      manifestHash,
      profile: artifact.profile,
      timing: artifact.timing,
      summary: artifact.summary,
    },
    null,
    2,
  )}\n`,
);
