import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { detectAIIndicators } from "@sprawlens/schema";
import { diffSnapshots } from "@sprawlens/schema";
import { createSnapshotFromWorkingTree } from "./snapshot.ts";
import type {
  CodesprawlConfig,
  CommitRecord,
  GraphDiff,
  Snapshot,
  SnapshotCommit,
} from "@sprawlens/schema";

const exec = promisify(execFile);

export type CollectOptions = {
  commits?: number;
  since?: string;
  step?: "weekly";
  /** Revision whose history is collected; defaults to the checked-out HEAD. */
  revision?: string;
  /** Follow only the first parent when walking merge history. */
  firstParent?: boolean;
  /** Language-provider hook; defaults to the TypeScript snapshot implementation. */
  analyzeWorktree?: (worktreePath: string, commit: SnapshotCommit) => Promise<Snapshot>;
  /** Artifact directory; defaults to <repo>/.codesprawl. */
  outputDir?: string;
};

export type CollectResult = {
  config: CodesprawlConfig;
  commits: CommitRecord[];
  snapshots: Snapshot[];
  outputDir: string;
};

export type AnalyzeResult = {
  snapshots: Snapshot[];
  diffs: GraphDiff[];
};

export type RealtimeAnalyzeResult = {
  baseSnapshot: Snapshot;
  currentSnapshot: Snapshot;
  diff: GraphDiff;
  status: string[];
};

export async function collectRepository(
  repoPath: string,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const repo = path.resolve(repoPath);
  const commits = await getGitCommits(repo, options);
  const selectedCommits = options.step === "weekly" ? sampleWeekly(commits) : commits;
  const snapshots: Snapshot[] = [];
  const repoName = path.basename(repo);
  const outputDir = options.outputDir ? path.resolve(options.outputDir) : codesprawlDir(repo);

  await resetCodesprawlOutput(outputDir);

  for (const commit of selectedCommits) {
    const worktreePath = await mkdtemp(path.join(tmpdir(), "codesprawl-worktree-"));
    try {
      await git(repo, ["worktree", "add", "--detach", "--quiet", worktreePath, commit.hash]);
      const analyzed = options.analyzeWorktree
        ? await options.analyzeWorktree(worktreePath, commit)
        : await createSnapshotFromWorkingTree(worktreePath, commit, {
            repoPath: repo,
            repoName,
          });
      const snapshot: Snapshot = options.analyzeWorktree
        ? {
            ...analyzed,
            repoPath: repo,
            commit,
            nodes: analyzed.nodes.map((node) =>
              node.id === "repo" && node.type === "repo" ? { ...node, name: repoName } : node,
            ),
          }
        : analyzed;
      snapshots.push(snapshot);
      await writeJson(path.join(outputDir, "snapshots", `${commit.hash}.json`), snapshot);
    } finally {
      await git(repo, ["worktree", "remove", "--force", worktreePath]).catch(async () => {
        await rm(worktreePath, { recursive: true, force: true });
      });
    }
  }

  const configOptions = {
    ...(options.commits !== undefined ? { commits: options.commits } : {}),
    ...(options.since !== undefined ? { since: options.since } : {}),
    ...(options.step !== undefined ? { step: options.step } : {}),
    ...(options.revision !== undefined ? { revision: options.revision } : {}),
    ...(options.firstParent !== undefined ? { firstParent: options.firstParent } : {}),
  };
  const config: CodesprawlConfig = {
    schemaVersion: 1,
    repoPath: repo,
    createdAt: new Date().toISOString(),
    options: configOptions,
  };
  const commitRecords: CommitRecord[] = selectedCommits.map((commit) => ({
    ...commit,
    likelyAI: commit.aiIndicators.length > 0,
  }));

  await writeJson(path.join(outputDir, "config.json"), config);
  await writeJson(path.join(outputDir, "commits.json"), commitRecords);
  await writeMetricsCsv(repo, snapshots, outputDir);

  return {
    config,
    commits: commitRecords,
    snapshots,
    outputDir,
  };
}

export async function analyzeRepository(repoPath: string): Promise<AnalyzeResult> {
  const repo = path.resolve(repoPath);
  const snapshots = await readSnapshots(repo);
  const diffs: GraphDiff[] = [];

  await rm(diffsDir(repo), { recursive: true, force: true });
  await mkdir(diffsDir(repo), { recursive: true });

  for (let index = 1; index < snapshots.length; index += 1) {
    const before = snapshots[index - 1];
    const after = snapshots[index];
    if (!before || !after) {
      continue;
    }
    const diff = diffSnapshots(before, after);
    diffs.push(diff);
    await writeJson(
      path.join(diffsDir(repo), `${before.commit.hash}..${after.commit.hash}.json`),
      diff,
    );
  }

  await writeMetricsCsv(repo, snapshots);

  return {
    snapshots,
    diffs,
  };
}

export async function analyzeRealtimeRepository(repoPath: string): Promise<RealtimeAnalyzeResult> {
  const repo = path.resolve(repoPath);
  const headCommit = await getGitCommit(repo, "HEAD");
  const repoName = path.basename(repo);
  const baseWorktreePath = await mkdtemp(path.join(tmpdir(), "codesprawl-head-"));

  try {
    await git(repo, ["worktree", "add", "--detach", "--quiet", baseWorktreePath, headCommit.hash]);
    const [baseSnapshot, currentSnapshot, status] = await Promise.all([
      createSnapshotFromWorkingTree(baseWorktreePath, headCommit, {
        repoPath: repo,
        repoName,
      }),
      createSnapshotFromWorkingTree(
        repo,
        {
          hash: "WORKTREE",
          shortHash: "worktree",
          timestamp: new Date().toISOString(),
          authorName: "Working Tree",
          message: "Uncommitted working tree",
          aiIndicators: [],
        },
        {
          repoPath: repo,
          repoName,
        },
      ),
      getGitStatus(repo),
    ]);

    return {
      baseSnapshot,
      currentSnapshot,
      diff: diffSnapshots(baseSnapshot, currentSnapshot),
      status,
    };
  } finally {
    await git(repo, ["worktree", "remove", "--force", baseWorktreePath]).catch(async () => {
      await rm(baseWorktreePath, { recursive: true, force: true });
    });
  }
}

async function readSnapshots(repoPath: string): Promise<Snapshot[]> {
  const repo = path.resolve(repoPath);
  const commitsPath = path.join(codesprawlDir(repo), "commits.json");

  try {
    const commits = JSON.parse(await readFile(commitsPath, "utf8")) as CommitRecord[];
    const snapshots = await Promise.all(
      commits.map(async (commit) =>
        readSnapshot(path.join(snapshotsDir(repo), `${commit.hash}.json`)),
      ),
    );
    return snapshots.sort((a, b) => a.commit.timestamp.localeCompare(b.commit.timestamp));
  } catch (error) {
    const files = await readdir(snapshotsDir(repo));
    const snapshots = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => readSnapshot(path.join(snapshotsDir(repo), file))),
    );
    return snapshots.sort((a, b) => a.commit.timestamp.localeCompare(b.commit.timestamp));
  }
}

async function readDiffs(repoPath: string): Promise<GraphDiff[]> {
  const repo = path.resolve(repoPath);
  const files = await readdir(diffsDir(repo)).catch(() => []);
  const diffs = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(
        async (file) =>
          JSON.parse(await readFile(path.join(diffsDir(repo), file), "utf8")) as GraphDiff,
      ),
  );
  return diffs;
}

function codesprawlDir(repoPath: string): string {
  return path.join(path.resolve(repoPath), ".codesprawl");
}

function snapshotsDir(repoPath: string): string {
  return path.join(codesprawlDir(repoPath), "snapshots");
}

function diffsDir(repoPath: string): string {
  return path.join(codesprawlDir(repoPath), "diffs");
}

async function resetCodesprawlOutput(outputDir: string) {
  await mkdir(outputDir, { recursive: true });
  await rm(path.join(outputDir, "snapshots"), { recursive: true, force: true });
  await rm(path.join(outputDir, "diffs"), { recursive: true, force: true });
  await mkdir(path.join(outputDir, "snapshots"), { recursive: true });
  await mkdir(path.join(outputDir, "diffs"), { recursive: true });
}

async function getGitCommits(repo: string, options: CollectOptions): Promise<SnapshotCommit[]> {
  const args = ["log", "--reverse", "--format=%H%x1f%ct%x1f%an%x1f%ae%x1f%B%x1e"];
  if (options.commits && options.commits > 0) {
    args.splice(1, 0, `--max-count=${options.commits}`);
  }
  if (options.since) {
    args.splice(1, 0, `--since=${normalizeSince(options.since)}`);
  }
  if (options.firstParent) args.splice(1, 0, "--first-parent");
  if (options.revision) args.push(options.revision);

  const { stdout } = await git(repo, args);
  return parseGitCommitLog(stdout);
}

async function getGitCommit(repo: string, revision: string): Promise<SnapshotCommit> {
  const { stdout } = await git(repo, [
    "show",
    "-s",
    "--format=%H%x1f%ct%x1f%an%x1f%ae%x1f%B%x1e",
    revision,
  ]);
  const [commit] = parseGitCommitLog(stdout);
  if (!commit) {
    throw new Error(`Unable to read git commit: ${revision}`);
  }
  return commit;
}

async function getGitStatus(repo: string): Promise<string[]> {
  const { stdout } = await git(repo, ["status", "--porcelain=v1"]);
  return stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !isCodesprawlStatusLine(line));
}

function isCodesprawlStatusLine(line: string): boolean {
  const pathPart = line.slice(3);
  return (
    pathPart.startsWith(".codesprawl/") ||
    pathPart === ".codesprawl" ||
    pathPart.includes(" -> .codesprawl/")
  );
}

function parseGitCommitLog(stdout: string): SnapshotCommit[] {
  return stdout
    .split("\x1e")
    .map((record) => record.replace(/^\n+|\n+$/g, ""))
    .filter(Boolean)
    .map((record) => {
      const [hash, timestampSeconds, authorName, authorEmail, ...messageParts] =
        record.split("\x1f");
      if (!hash || !timestampSeconds || !authorName) {
        throw new Error(`Unable to parse git log record: ${record}`);
      }
      const message = messageParts.join("\x1f").trim();
      const aiInfo = detectAIIndicators({
        hash,
        authorName,
        authorEmail,
        message,
      });
      return {
        hash,
        shortHash: hash.slice(0, 7),
        timestamp: new Date(Number(timestampSeconds) * 1000).toISOString(),
        authorName,
        authorEmail,
        message,
        aiIndicators: aiInfo.indicators,
      };
    });
}

function normalizeSince(value: string): string {
  const dotted = value.match(/^(\d+)\.(days?|weeks?|months?|years?)$/i);
  if (dotted?.[1] && dotted[2]) {
    return `${dotted[1]} ${dotted[2]} ago`;
  }

  const spaced = value.match(/^(\d+)\s+(days?|weeks?|months?|years?)$/i);
  if (spaced?.[1] && spaced[2]) {
    return `${spaced[1]} ${spaced[2]} ago`;
  }

  return value;
}

function sampleWeekly(commits: SnapshotCommit[]): SnapshotCommit[] {
  const byWeek = new Map<string, SnapshotCommit>();
  for (const commit of commits) {
    byWeek.set(weekKey(commit.timestamp), commit);
  }
  return [...byWeek.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function weekKey(timestamp: string): string {
  const date = new Date(timestamp);
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

async function writeMetricsCsv(
  repo: string,
  snapshots: Snapshot[],
  outputDir = codesprawlDir(repo),
) {
  const header = [
    "commit",
    "timestamp",
    "likelyAI",
    "loc",
    "fileCount",
    "importEdgeCount",
    "cycleCount",
    "largestComponentSize",
    "maxFanIn",
    "maxFanOut",
  ];
  const rows = snapshots.map((snapshot) =>
    [
      snapshot.commit.hash,
      snapshot.commit.timestamp,
      snapshot.commit.aiIndicators.length > 0 ? "true" : "false",
      snapshot.metrics.loc,
      snapshot.metrics.fileCount,
      snapshot.metrics.importEdgeCount,
      snapshot.metrics.cycleCount,
      snapshot.metrics.largestComponentSize,
      snapshot.metrics.maxFanIn,
      snapshot.metrics.maxFanOut,
    ]
      .map(csvCell)
      .join(","),
  );
  await writeFile(path.join(outputDir, "metrics.csv"), `${header.join(",")}\n${rows.join("\n")}\n`);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function readSnapshot(filePath: string): Promise<Snapshot> {
  return JSON.parse(await readFile(filePath, "utf8")) as Snapshot;
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function git(cwd: string, args: string[]) {
  return exec("git", args, {
    cwd,
    maxBuffer: 1024 * 1024 * 100,
  });
}
