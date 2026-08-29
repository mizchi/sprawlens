import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { loadCodesprawlBenchmarkCases } from "../packages/cli/src/deltaBenchmarkDataset.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";
import { runSequenceVectorConstraintExperiment } from "../packages/cli/src/sequenceVectorConstraintExperiment.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(projectRoot, "research/repository-evaluation-manifest.json");
const collectionRoot = resolve(projectRoot, "research/artifacts/repository-evaluation");
const outputPath = resolve(
  projectRoot,
  "research/results/sequence-vector-constraint-development.json",
);
const markdownPath = resolve(
  projectRoot,
  "research/results/sequence-vector-constraint-development.md",
);

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
  process.stderr.write(`[vector constraint load] ${repository.fullName}\n`);
  const dataset = await loadCodesprawlBenchmarkCases(
    resolve(collectionRoot, repository.fullName),
    manifest.selectionProtocol.benchmark,
  );
  datasets.push({ repository: repository.fullName, sequences: dataset.sequences });
}

const started = performance.now();
const result = runSequenceVectorConstraintExperiment(datasets, {
  seeds: manifest.selectionProtocol.benchmark.seeds,
  onRepository: ({ index, total, repository, sequences }) => {
    process.stderr.write(`[vector constraint ${index}/${total}] ${repository}: ${sequences}\n`);
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
await writeAtomic(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
await writeAtomic(markdownPath, renderMarkdown(artifact));
process.stdout.write(
  `${JSON.stringify({ outputPath, markdownPath, summary: artifact.summary, timing: artifact.timing }, null, 2)}\n`,
);

async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

function renderMarkdown(artifact: typeof artifact): string {
  const summary = artifact.summary;
  const effect = (key: keyof typeof summary) =>
    summary[key] as {
      mean: number;
      ci95: readonly [number, number];
      signs: { positive: number; zero: number; negative: number };
    };
  const rows = artifact.repositories.map(
    (repository) =>
      `| ${repository.repository} | ${repository.runs} | ${formatPercent(repository.eligibleCandidateReductionRate)} | ${formatPercent(repository.selectedTransitionChangeRate)} | ${formatNumber(repository.pathMaxReduction)} | ${formatNumber(repository.siteDisplacementPenalty)} | ${formatNumber(repository.boundaryDisplacementPenalty)} |`,
  );
  return `# Sequence vector-constraint development experiment

## 結果

- 対象: ${summary.repositories} repositories、${summary.sequences} sequences、${summary.evaluatedTransitions} seed-evaluated transitions
- protected vector: adjacency floor ∩ constraint-path maximum floor
- topology floor violations: ${summary.topologyFloorViolations}
- eligible candidate reduction rate: ${formatEffect(effect("eligibleCandidateReductionRate"), true)}
- selected transition change rate: ${formatEffect(effect("selectedTransitionChangeRate"), true)}
- constraint-path maximum reduction: ${formatEffect(effect("pathMaxReduction"))}
- constraint-path median reduction: ${formatEffect(effect("pathMedianReduction"))}
- site displacement penalty: ${formatEffect(effect("siteDisplacementPenalty"))}
- boundary displacement penalty: ${formatEffect(effect("boundaryDisplacementPenalty"))}
- adjacency loss: ${formatEffect(effect("adjacencyLoss"))}
- vector fallback rate: ${formatEffect(effect("vectorFallbackRate"), true)}

値はrepositoryごとにsequence×seed平均を作り、そのrepository値をouter unitとして集約したpaired development結果である。正のpath reductionはvector conditionが短いこと、正のpenalty/lossはscalar adjacency-only conditionより悪いことを表す。

## Repository breakdown

| repository | runs | eligible reduction | selection changed | path-max reduction | site penalty | boundary penalty |
|---|---:|---:|---:|---:|---:|---:|
${rows.join("\n")}

## 解釈境界

- post-hoc development corpusであり、confirmatory resultではない。
- path maximumはdependency constraintのtail severityを表すが、task-level comprehensionを直接測らない。
- baseline candidateを有限集合に含むため、正常収束時のfeasible setは空にならない。fallbackはsolver validity failureの診断である。
- production既定値の変更は、topology改善とstability costの区間、および独立holdoutを見て別に判断する。
`;
}

function formatEffect(
  value: { mean: number; ci95: readonly [number, number]; signs: Record<string, number> },
  percent = false,
): string {
  const format = percent ? formatPercent : formatNumber;
  return `${format(value.mean)} [${format(value.ci95[0])}, ${format(value.ci95[1])}] (${value.signs.positive}/${value.signs.zero}/${value.signs.negative})`;
}

function formatNumber(value: number): string {
  return value.toFixed(6);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
