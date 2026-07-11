import { execFile } from "node:child_process";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { CodesprawlConfig, CommitRecord } from "@sprawlens/schema";
import {
  collectionArtifactReusable,
  planRepositoryCollection,
  upsertCollectionStatusEntry,
} from "../packages/cli/src/repositoryEvaluationCollection.ts";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");

type Options = {
  manifest: string;
  outputRoot: string;
  only: string[];
  limit?: number;
  dryRun: boolean;
  noClone: boolean;
};

function parseArgs(args: readonly string[]): Options {
  const options: Options = {
    manifest: resolve(projectRoot, "research/repository-evaluation-manifest.json"),
    outputRoot: resolve(projectRoot, "research/artifacts/repository-evaluation"),
    only: [],
    dryRun: false,
    noClone: false,
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    const value = () => {
      const next = args[++index];
      if (!next) throw new Error(`${arg} requires a value`);
      return next;
    };
    if (arg === "--manifest") options.manifest = resolve(value());
    else if (arg === "--output-root") options.outputRoot = resolve(value());
    else if (arg === "--only") options.only.push(value());
    else if (arg === "--limit") {
      const limit = Number(value());
      if (!Number.isInteger(limit) || limit <= 0) throw new Error("--limit must be positive");
      options.limit = limit;
    } else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-clone") options.noClone = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

async function reusable(
  outputPath: string,
  repository: Parameters<typeof collectionArtifactReusable>[2],
  commits: number,
): Promise<boolean> {
  try {
    const [config, records] = await Promise.all([
      readFile(resolve(outputPath, "config.json"), "utf8"),
      readFile(resolve(outputPath, "commits.json"), "utf8"),
    ]);
    return collectionArtifactReusable(
      JSON.parse(config) as CodesprawlConfig,
      JSON.parse(records) as CommitRecord[],
      repository,
      commits,
    );
  } catch {
    return false;
  }
}

async function writeStatus(path: string, value: unknown) {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

const options = parseArgs(process.argv.slice(2));
const manifest = parseRepositoryEvaluationManifest(
  JSON.parse(await readFile(options.manifest, "utf8")),
);
const { stdout: ghqOutput } = await exec("ghq", ["root"]);
const ghqRoot = ghqOutput.trim();
let plan = planRepositoryCollection(manifest, ghqRoot, options.outputRoot, options.only);
if (options.limit !== undefined) plan = plan.slice(0, options.limit);
if (options.dryRun) {
  process.stdout.write(
    `${JSON.stringify(
      plan.map(({ repository, repoPath, outputPath, providerId }) => ({
        fullName: repository.fullName,
        head: repository.head,
        repoPath,
        outputPath,
        providerId,
      })),
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

await mkdir(options.outputRoot, { recursive: true });
const statusPath = resolve(options.outputRoot, "status.json");
const previousStatus = await readFile(statusPath, "utf8")
  .then(
    (value) =>
      JSON.parse(value) as { manifestFrozenAt?: string; startedAt?: string; entries?: unknown },
  )
  .catch(() => null);
const status: {
  schemaVersion: 1;
  manifest: string;
  manifestFrozenAt: string;
  startedAt: string;
  finishedAt?: string;
  entries: Array<Record<string, unknown>>;
} = {
  schemaVersion: 1,
  manifest: options.manifest,
  manifestFrozenAt: manifest.frozenAt,
  startedAt:
    previousStatus?.manifestFrozenAt === manifest.frozenAt && previousStatus.startedAt
      ? previousStatus.startedAt
      : new Date().toISOString(),
  entries:
    previousStatus?.manifestFrozenAt === manifest.frozenAt && Array.isArray(previousStatus.entries)
      ? (previousStatus.entries as Array<Record<string, unknown>>)
      : [],
};

const recordStatus = (entry: Record<string, unknown> & { fullName: string }) => {
  status.entries = upsertCollectionStatusEntry(status.entries, entry);
};

for (const [index, item] of plan.entries()) {
  const startedAt = new Date().toISOString();
  process.stderr.write(`[${index + 1}/${plan.length}] ${item.repository.fullName}\n`);
  try {
    if (
      await reusable(
        item.outputPath,
        item.repository,
        manifest.selectionProtocol.benchmark.snapshotCommits,
      )
    ) {
      recordStatus({
        fullName: item.repository.fullName,
        status: "reused",
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      await writeStatus(statusPath, status);
      process.stderr.write(`  reused\n`);
      continue;
    }
    if (!(await exists(resolve(item.repoPath, ".git")))) {
      if (options.noClone) throw new Error("repository is not cloned and --no-clone was specified");
      await exec(
        "ghq",
        ["get", "--no-recursive", "--partial", "blobless", item.repository.fullName],
        { maxBuffer: 16 * 1024 * 1024 },
      );
    }
    try {
      await exec("git", ["cat-file", "-e", `${item.repository.head}^{commit}`], {
        cwd: item.repoPath,
      });
    } catch {
      await exec("git", ["fetch", "origin", item.repository.head], {
        cwd: item.repoPath,
        maxBuffer: 16 * 1024 * 1024,
      });
    }
    await exec(
      "pnpm",
      [
        "exec",
        "tsx",
        "packages/cli/src/index.ts",
        "collect",
        item.repoPath,
        "--commits",
        String(manifest.selectionProtocol.benchmark.snapshotCommits),
        "--revision",
        item.repository.head,
        "--first-parent",
        "--lang",
        item.providerId,
        "--output-dir",
        item.outputPath,
      ],
      { cwd: projectRoot, maxBuffer: 32 * 1024 * 1024 },
    );
    const commits = JSON.parse(
      await readFile(resolve(item.outputPath, "commits.json"), "utf8"),
    ) as CommitRecord[];
    recordStatus({
      fullName: item.repository.fullName,
      status: "collected",
      snapshots: commits.length,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    process.stderr.write(`  collected ${commits.length} snapshots\n`);
  } catch (error) {
    recordStatus({
      fullName: item.repository.fullName,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    process.stderr.write(`  failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  await writeStatus(statusPath, status);
}

status.finishedAt = new Date().toISOString();
await writeStatus(statusPath, status);
const selectedNames = new Set(plan.map(({ repository }) => repository.fullName));
const selectedEntries = status.entries.filter((entry) => selectedNames.has(String(entry.fullName)));
const failures = selectedEntries.filter((entry) => entry.status === "failed").length;
process.stdout.write(
  `${JSON.stringify(
    { repositories: selectedEntries.length, failures, statusPath, finishedAt: status.finishedAt },
    null,
    2,
  )}\n`,
);
if (failures > 0) process.exitCode = 1;
