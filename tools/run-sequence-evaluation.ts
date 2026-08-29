import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { loadCodesprawlBenchmarkCases } from "../packages/cli/src/deltaBenchmarkDataset.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";
import { runRepositorySequenceBenchmarkBatch } from "../packages/cli/src/sequenceBenchmarkDataset.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(projectRoot, "research/repository-evaluation-manifest.json");
const collectionRoot = resolve(projectRoot, "research/artifacts/repository-evaluation");

const option = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : resolve(process.argv[index + 1] ?? "");
};
const rawOutput = option("--raw-output", resolve(collectionRoot, "sequence-rollout-posthoc.json"));
const summaryOutput = option(
  "--summary-output",
  resolve(projectRoot, "research/results/sequence-rollout-posthoc.json"),
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
  process.stderr.write(`[sequence load] ${repository.fullName}\n`);
  const dataset = await loadCodesprawlBenchmarkCases(
    resolve(collectionRoot, repository.fullName),
    manifest.selectionProtocol.benchmark,
  );
  datasets.push({ ...dataset, repository: repository.fullName });
}
const startedAt = new Date().toISOString();
const started = performance.now();
const batch = runRepositorySequenceBenchmarkBatch(datasets, {
  seeds: manifest.selectionProtocol.benchmark.seeds,
});
const timing = {
  wallClockMs: performance.now() - started,
  maxRssKb: process.resourceUsage().maxRSS,
};
const artifact = {
  schemaVersion: 2 as const,
  kind: "post-hoc-stateful-sequence-rollout" as const,
  manifestHash,
  startedAt,
  finishedAt: new Date().toISOString(),
  timing,
  batch,
};
const summary = {
  schemaVersion: 2 as const,
  status: "post-hoc stateful sequence rollout" as const,
  manifestHash,
  seeds: batch.seeds,
  timing,
  ...batch.summary,
};
await writeJsonAtomic(rawOutput, artifact);
await writeJsonAtomic(summaryOutput, summary);
process.stdout.write(`${JSON.stringify({ rawOutput, summaryOutput, summary }, null, 2)}\n`);
