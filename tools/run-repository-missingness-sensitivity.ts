import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadCodesprawlBenchmarkCases,
  runRepositoryBenchmarkBatch,
} from "../packages/cli/src/deltaBenchmarkDataset.ts";
import {
  summarizeMissingnessSensitivity,
  type RepositoryPrimaryEffect,
} from "../packages/cli/src/repositoryEvaluationMissingness.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(projectRoot, "research/repository-evaluation-manifest.json");
const primaryRawPath = resolve(
  projectRoot,
  "research/artifacts/repository-evaluation/benchmark-primary.json",
);
const recoveryRoot = resolve(
  projectRoot,
  "research/artifacts/repository-evaluation-posthoc/tree-lifecycle",
);
const rawOutput = resolve(recoveryRoot, "benchmark-missingness.json");
const summaryOutput = resolve(
  projectRoot,
  "research/results/repository-evaluation-missingness-sensitivity.json",
);

const writeJsonAtomic = async (path: string, value: unknown) => {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
};

const effectOf = (repository: {
  dataset: { repository: string };
  benchmark: null | {
    aggregate: {
      contrasts: {
        stableNeighborhoodVsNeighborhoodSwap: Record<
          keyof Omit<RepositoryPrimaryEffect, "repository">,
          { mean: number }
        >;
      };
    };
  };
}): RepositoryPrimaryEffect | null => {
  if (!repository.benchmark) return null;
  const contrast = repository.benchmark.aggregate.contrasts.stableNeighborhoodVsNeighborhoodSwap;
  return {
    repository: repository.dataset.repository,
    adjacencyGain: contrast.adjacencyGain.mean,
    edgeLengthReduction: contrast.edgeLengthReduction.mean,
    displacementReduction: contrast.displacementReduction.mean,
    objectiveReduction: contrast.objectiveReduction.mean,
    stepReduction: contrast.stepReduction.mean,
  };
};

const manifestBytes = await readFile(manifestPath);
const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");
const manifest = parseRepositoryEvaluationManifest(JSON.parse(manifestBytes.toString("utf8")));
const primaryRaw = JSON.parse(await readFile(primaryRawPath, "utf8")) as {
  manifestHash: string;
  batch: { repositories: Parameters<typeof effectOf>[0][] };
};
if (primaryRaw.manifestHash !== manifestHash) throw new Error("primary raw manifest hash mismatch");

const recoveredDefinitions = [
  { fullName: "ollama/ollama", path: resolve(recoveryRoot, "ollama/ollama") },
  { fullName: "etcd-io/etcd", path: resolve(recoveryRoot, "etcd-io/etcd") },
] as const;
const recoveredDatasets = await Promise.all(
  recoveredDefinitions.map(async (definition) => ({
    ...(await loadCodesprawlBenchmarkCases(definition.path, manifest.selectionProtocol.benchmark)),
    repository: definition.fullName,
  })),
);
const recoveredBatch = runRepositoryBenchmarkBatch(recoveredDatasets, {
  seeds: manifest.selectionProtocol.benchmark.seeds,
  stableSwapPasses: [8],
  onRepository: ({ repository, cases, status }) =>
    process.stderr.write(`${repository}: ${status}, ${cases} cases\n`),
});
const primaryEffects = primaryRaw.batch.repositories.flatMap((repository) => {
  const effect = effectOf(repository);
  return effect ? [effect] : [];
});
const recoveredEffects = recoveredBatch.repositories.flatMap((repository) => {
  const effect = effectOf(repository);
  return effect ? [effect] : [];
});
const sensitivity = summarizeMissingnessSensitivity(primaryEffects, recoveredEffects);
const recoveredFlow = recoveredBatch.repositories.map((repository) => ({
  repository: repository.dataset.repository,
  snapshots: repository.dataset.snapshotCount,
  cases: repository.dataset.selection.included,
  status: repository.benchmark ? "analyzed" : "benchmark-excluded",
  ...(repository.exclusion ? { reason: repository.exclusion.code } : {}),
}));
const output = {
  schemaVersion: 1 as const,
  manifestHash,
  status: sensitivity.status,
  cause:
    "Go tree-sitter WASM trees were retained across files and snapshots; explicit Tree.delete() recovered both registered repositories" as const,
  primaryArtifactUnchanged: true as const,
  recoveredFlow,
  ...sensitivity,
};
await writeJsonAtomic(rawOutput, { ...output, recoveredBatch });
await writeJsonAtomic(summaryOutput, output);
process.stdout.write(
  `${JSON.stringify({ summaryOutput, recoveredFlow, contrasts: output.contrasts, decision: output.decision }, null, 2)}\n`,
);
