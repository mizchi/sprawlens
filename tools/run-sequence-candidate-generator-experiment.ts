import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { createStableVoronoiCandidateGenerator } from "../packages/layout/src/candidateGenerator.ts";
import { loadCodesprawlBenchmarkCases } from "../packages/cli/src/deltaBenchmarkDataset.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";
import { runSequenceCandidateGeneratorExperiment } from "../packages/cli/src/sequenceCandidateGeneratorExperiment.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const hilbertVariant = process.argv.includes("--algorithm-6-fixed")
  ? "algorithm-6-fixed"
  : "algorithm-8-variable";
const outputStem =
  hilbertVariant === "algorithm-6-fixed"
    ? "sequence-candidate-generator-algorithm6-development"
    : "sequence-candidate-generator-development";
const manifestPath = resolve(projectRoot, "research/repository-evaluation-manifest.json");
const collectionRoot = resolve(projectRoot, "research/artifacts/repository-evaluation");
const outputPath = resolve(projectRoot, `research/results/${outputStem}.json`);
const markdownPath = resolve(projectRoot, `research/results/${outputStem}.md`);

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
  process.stderr.write(`[candidate generator load] ${repository.fullName}\n`);
  const dataset = await loadCodesprawlBenchmarkCases(
    resolve(collectionRoot, repository.fullName),
    manifest.selectionProtocol.benchmark,
  );
  datasets.push({ repository: repository.fullName, sequences: dataset.sequences });
}

const started = performance.now();
const result = runSequenceCandidateGeneratorExperiment(datasets, {
  seeds: manifest.selectionProtocol.benchmark.seeds,
  generator: createStableVoronoiCandidateGenerator({ hilbertVariant }),
  onRepository: ({ index, total, repository, sequences }) => {
    process.stderr.write(`[candidate generator ${index}/${total}] ${repository}: ${sequences}\n`);
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
      `| ${repository.repository} | ${repository.runs} | ${formatPercent(repository.eligibleAddedGeneratorRate)} | ${formatPercent(repository.selectedAddedGeneratorRate)} | ${formatNumber(repository.siteDisplacementReduction)} | ${formatNumber(repository.boundaryDisplacementReduction)} | ${formatNumber(repository.adjacencyGain)} |`,
  );
  return `# Sequence candidate-generator development experiment

## 結果

- 対象: ${summary.repositories} repositories、${summary.sequences} sequences、${summary.evaluatedTransitions} seed-evaluated transitions
- 追加generator: \`${artifact.generator.id}\` (\`${artifact.generator.revision}\`)
- adjacency floor violations: ${summary.adjacencyFloorViolations}
- added candidates per transition: ${formatEffect(effect("meanAddedCandidates"))}
- added candidate feasible rate: ${formatEffect(effect("eligibleAddedGeneratorRate"), true)}
- added candidate selection rate: ${formatEffect(effect("selectedAddedGeneratorRate"), true)}
- added candidate displacement penalty: ${formatEffect(effect("addedGeneratorDisplacementPenalty"))}
- added candidate adjacency gain: ${formatEffect(effect("addedGeneratorAdjacencyGain"))}
- added candidate constraint-path maximum reduction: ${formatEffect(effect("addedGeneratorPathMaxReduction"))}
- feasible added candidate displacement win rate: ${formatEffect(effect("eligibleAddedGeneratorDisplacementWinRate"), true)}
- feasible added candidate displacement tie rate: ${formatEffect(effect("eligibleAddedGeneratorDisplacementTieRate"), true)}
- site displacement reduction: ${formatEffect(effect("siteDisplacementReduction"))}
- boundary displacement reduction: ${formatEffect(effect("boundaryDisplacementReduction"))}
- adjacency gain: ${formatEffect(effect("adjacencyGain"))}
- constraint-path maximum reduction: ${formatEffect(effect("pathMaxReduction"))}
- initial-to-final site displacement reduction: ${formatEffect(effect("initialToFinalSiteDisplacementReduction"))}
- initial-to-final boundary displacement reduction: ${formatEffect(effect("initialToFinalBoundaryDisplacementReduction"))}

値はrepositoryごとにsequence×seed平均を作り、そのrepository値をouter unitとして集約したpaired development結果である。正のreduction / gainはStable VT由来候補を追加したportfolioが内部候補だけの条件より良いことを表す。

## Repository breakdown

| repository | runs | feasible | selected | site reduction | boundary reduction | adjacency gain |
|---|---:|---:|---:|---:|---:|---:|
${rows.join("\n")}

## 解釈境界

- selector、metric、内部候補は固定し、候補集合へ一つのgeometry sourceだけを追加した開発実験である。
- Stable VT候補は\`${String(artifact.generator.parameters.hilbertVariant)}\` initialization + Sprawlens power solverの探索的再実装であり、著者実装または完全なpaper reimplementationではない。
- post-hoc development corpusなので、第一論文のconfirmatory effectや既存法一般への優位性には混ぜない。
- selection rateが低い場合も、generatorが弱いこととselectorが有効でないことは同義ではない。feasibilityとselectionを別に報告する。
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
