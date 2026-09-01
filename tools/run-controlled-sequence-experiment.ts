import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadCodesprawlBenchmarkCases } from "../packages/cli/src/deltaBenchmarkDataset.ts";
import { runControlledSequenceExperiment } from "../packages/cli/src/controlledSequenceExperiment.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const option = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? resolve(projectRoot, fallback) : resolve(process.argv[index + 1] ?? "");
};
const manifestPath = option("--manifest", "research/repository-evaluation-manifest.json");
const collectionRoot = option("--collection-root", "research/artifacts/repository-evaluation");
const output = option("--output", "research/results/sequence-controlled-development.json");
const markdown = option("--markdown", "research/results/sequence-controlled-development.md");
const numberOption = (name: string, fallback: number) => {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? fallback : Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative`);
  return value;
};
const historyFreeReferenceWeight = numberOption("--history-free-weight", 0);
const reliabilityMargin = numberOption("--reliability-margin", 0);

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
  process.stderr.write(`[controlled sequence] ${repository.fullName}\n`);
  const dataset = await loadCodesprawlBenchmarkCases(
    resolve(collectionRoot, repository.fullName),
    manifest.selectionProtocol.benchmark,
  );
  datasets.push({ repository: repository.fullName, sequences: dataset.sequences });
}
const result = runControlledSequenceExperiment(datasets, {
  seeds: manifest.selectionProtocol.benchmark.seeds,
  stableHistoryFreeReferenceWeight: historyFreeReferenceWeight,
  reliabilityMargin,
});
const artifact = {
  schemaVersion: 3 as const,
  status: "post-hoc controlled-sequence development experiment" as const,
  manifestHash,
  generatedAt: new Date().toISOString(),
  ...result,
};
const format = (value: { mean: number; ci95: readonly [number, number] }) =>
  `${value.mean.toFixed(5)} [${value.ci95[0].toFixed(5)}, ${value.ci95[1].toFixed(5)}]`;
const conditions = [
  "neighborhoodSwap",
  "computeMatchedNeighborhood",
  "warmStart",
  "anchorOnly",
  "stableNeighborhood",
] as const;
const report = `# Controlled sequence development experiment

## Status

Post-hoc development evidence. Natural-history endpoint displacementでは識別できないrecovery errorとpath dependenceを直接測るため、各moduleの最初のgraphから結果非依存の二変更を作った。

- no-op: \`G0 -> G0 -> G0\`
- weight reversal: \`G0 -> GA -> G0\`
- rewire reversal: \`G0 -> GB -> G0\`
- combined reversal: \`G0 -> GAB -> G0\`
- order AB: \`G0 -> GA -> GAB\`
- order BA: \`G0 -> GB -> GAB\`
- outer unit: repository mean
- repositories: ${result.summary.repositories}
- excluded repositories: ${result.summary.excludedRepositories}
- seed-evaluated probes: ${result.summary.probes}
- deterministic history-free reference weight: ${historyFreeReferenceWeight}
- adjacency floor violations: ${result.summary.floorViolations}
- solve-budget shortfalls: ${result.summary.budgetShortfalls}
- manifest hash: \`${manifestHash}\`

## Boundary displacement

| condition | no-op | weight reversal | rewire reversal | combined reversal | AB-vs-BA path dependence |
| --- | ---: | ---: | ---: | ---: | ---: |
${conditions
  .map(
    (condition) =>
      `| ${condition} | ${format(result.summary.recovery.noOp[condition].boundaryDisplacement)} | ${format(result.summary.recovery.weight[condition].boundaryDisplacement)} | ${format(result.summary.recovery.rewire[condition].boundaryDisplacement)} | ${format(result.summary.recovery.combined[condition].boundaryDisplacement)} | ${format(result.summary.pathDependence[condition].boundaryDisplacement)} |`,
  )
  .join("\n")}

値は小さいほど良い。\`neighborhoodSwap\`は同じgraphとseedをcoldに解く決定的対照なので、同一endpointでは原理的に0となる。history-aware条件の値は、入力差では説明できない幾何学的記憶を表す。

## Development noise-adjusted reliability

同じpathを同じ宣言入力で独立に再実行し、repository・condition内のsequence × seed × pathから95% empirical nearest-rank noise floorを求めた。\`D_excess = max(0, D_path - noiseFloor - margin)\`で、marginは${result.summary.developmentReliability.margin}。現値はsampled mean boundary discrepancyに基づくdevelopment指標であり、target contractのexact Hausdorff confirmatory値ではない。

| condition | repeatability noise floor | commutator excess |
| --- | ---: | ---: |
${conditions
  .map(
    (condition) =>
      `| ${condition} | ${format(result.summary.developmentReliability.noiseFloor[condition])} | ${format(result.summary.developmentReliability.commutatorExcess[condition])} |`,
  )
  .join("\n")}
`;
const writeAtomic = async (path: string, contents: string) => {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
};
await writeAtomic(output, `${JSON.stringify(artifact, null, 2)}\n`);
await writeAtomic(markdown, report);
process.stdout.write(`${JSON.stringify({ output, markdown, summary: result.summary }, null, 2)}\n`);
