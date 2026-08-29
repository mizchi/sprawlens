import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import {
  loadCodesprawlBenchmarkCases,
  runRepositoryBenchmarkBatch,
  type LoadedDataset,
} from "../packages/cli/src/deltaBenchmarkDataset.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";
import { summarizeRepositoryEvaluation } from "../packages/cli/src/repositoryEvaluationReport.ts";
import { repositoryEvaluationVariant } from "../packages/cli/src/repositoryEvaluationVariants.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const PRIMARY_MANIFEST_SHA256 = "6bb2b00d95b4d02acfa8d8fbdd9e47f3f8ca9b6829e637f715a6d0f439444b23";

type Options = {
  manifest: string;
  collectionRoot: string;
  rawOutput: string;
  summaryOutput: string;
  variant: string;
};

function parseArgs(args: readonly string[]): Options {
  const options: Options = {
    manifest: resolve(projectRoot, "research/repository-evaluation-manifest.json"),
    collectionRoot: resolve(projectRoot, "research/artifacts/repository-evaluation"),
    rawOutput: "",
    summaryOutput: "",
    variant: "primary",
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    const value = () => {
      const next = args[++index];
      if (!next) throw new Error(`${arg} requires a value`);
      return resolve(next);
    };
    if (arg === "--manifest") options.manifest = value();
    else if (arg === "--collection-root") options.collectionRoot = value();
    else if (arg === "--raw-output") options.rawOutput = value();
    else if (arg === "--summary-output") options.summaryOutput = value();
    else if (arg === "--variant") options.variant = args[++index] ?? "";
    else throw new Error(`unknown option: ${arg}`);
  }
  repositoryEvaluationVariant(options.variant);
  if (!options.rawOutput) {
    options.rawOutput = resolve(
      projectRoot,
      `research/artifacts/repository-evaluation/benchmark-${options.variant}.json`,
    );
  }
  if (!options.summaryOutput) {
    options.summaryOutput = resolve(
      projectRoot,
      `research/results/repository-evaluation-${options.variant}-summary.json`,
    );
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
const variant = repositoryEvaluationVariant(options.variant);
const manifestBytes = await readFile(options.manifest);
const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");
if (manifestHash !== PRIMARY_MANIFEST_SHA256) {
  throw new Error(
    `primary manifest hash mismatch: expected ${PRIMARY_MANIFEST_SHA256}, got ${manifestHash}`,
  );
}
const manifest = parseRepositoryEvaluationManifest(JSON.parse(manifestBytes.toString("utf8")));
const statusPath = resolve(options.collectionRoot, "status.json");
const collectionStatus = JSON.parse(await readFile(statusPath, "utf8")) as {
  schemaVersion: number;
  manifestFrozenAt?: string;
  finishedAt?: string;
  entries?: Array<{ fullName: string; status: string; error?: string }>;
};
if (collectionStatus.schemaVersion !== 1)
  throw new Error("collection status schemaVersion must be 1");
if (collectionStatus.manifestFrozenAt !== manifest.frozenAt) {
  throw new Error("collection status does not match the frozen manifest");
}
if (!collectionStatus.finishedAt) throw new Error("collection status is not finished");
if (!Array.isArray(collectionStatus.entries)) throw new Error("collection status entries missing");
const collectionByName = new Map(collectionStatus.entries.map((entry) => [entry.fullName, entry]));
const datasets: LoadedDataset[] = [];
const evaluationFailures: Array<{ fullName: string; error: string }> = [];
for (const [index, repository] of manifest.repositories.entries()) {
  const collection = collectionByName.get(repository.fullName);
  if (!collection || collection.status === "failed") continue;
  process.stderr.write(
    `[load ${index + 1}/${manifest.repositories.length}] ${repository.fullName}\n`,
  );
  try {
    const dataset = await loadCodesprawlBenchmarkCases(
      resolve(options.collectionRoot, repository.fullName),
      {
        ...manifest.selectionProtocol.benchmark,
        grouping: variant.grouping,
        ...(variant.directoryDepth ? { directoryDepth: variant.directoryDepth } : {}),
      },
    );
    datasets.push({ ...dataset, repository: repository.fullName });
  } catch (error) {
    evaluationFailures.push({
      fullName: repository.fullName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
if (datasets.length === 0) throw new Error("no collected repository could be loaded");

const startedAt = new Date().toISOString();
const benchmarkStarted = performance.now();
const batch = runRepositoryBenchmarkBatch(datasets, {
  seeds: manifest.selectionProtocol.benchmark.seeds,
  stableSwapPasses: variant.stableSwapPasses,
  onRepository: ({ index, total, repository, cases, status }) => {
    process.stderr.write(
      `[benchmark ${index}/${total}] ${repository}: ${status}, ${cases} cases\n`,
    );
  },
});
const wallClockMs = performance.now() - benchmarkStarted;
const finishedAt = new Date().toISOString();
const timing = {
  scope:
    "single Node.js process including all nine conditions, excluding snapshot loading" as const,
  wallClockMs,
  maxRssKb: process.resourceUsage().maxRSS,
};
const summary = {
  schemaVersion: 1 as const,
  status:
    variant.evidence === "primary"
      ? ("primary preregistered repository evaluation" as const)
      : ("preregistered sensitivity analysis" as const),
  variant,
  manifestHash,
  manifestFrozenAt: manifest.frozenAt,
  seeds: manifest.selectionProtocol.benchmark.seeds,
  grouping: variant.grouping,
  ...(variant.directoryDepth ? { directoryDepth: variant.directoryDepth } : {}),
  stableSwapPasses: variant.stableSwapPasses,
  minNodes: manifest.selectionProtocol.benchmark.minNodes,
  maxNodes: manifest.selectionProtocol.benchmark.maxNodes,
  startedAt,
  finishedAt,
  timing,
  ...summarizeRepositoryEvaluation({
    manifest,
    collectionEntries: collectionStatus.entries,
    batch,
    evaluationFailures,
  }),
};
if (!summary.contractAudit.passed) {
  throw new Error(
    `primary evaluation contract audit failed: ${JSON.stringify(summary.contractAudit)}`,
  );
}
const rawArtifact = {
  schemaVersion: 1 as const,
  kind:
    variant.evidence === "primary"
      ? ("primary-preregistered-repository-evaluation" as const)
      : ("preregistered-repository-sensitivity-analysis" as const),
  variant,
  manifestHash,
  manifestFrozenAt: manifest.frozenAt,
  collectionFinishedAt: collectionStatus.finishedAt,
  startedAt,
  finishedAt,
  timing,
  evaluationFailures,
  batch,
};
await writeJsonAtomic(options.rawOutput, rawArtifact);
await writeJsonAtomic(options.summaryOutput, summary);
process.stdout.write(
  `${JSON.stringify(
    {
      rawOutput: options.rawOutput,
      summaryOutput: options.summaryOutput,
      flow: summary.flow,
      coPrimary: summary.coPrimary,
      decision: summary.decision,
      timing,
    },
    null,
    2,
  )}\n`,
);
