import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FileNode, Snapshot } from "@sprawlens/contracts";
import { matchFileContinuity } from "../packages/schema/src/core/fileIdentity.ts";
import { compareIdentityPairs, parseGitRenameStatus } from "./file-identity-silver.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(projectRoot, "research/repository-evaluation-manifest.json");
const collectionRoot = resolve(projectRoot, "research/artifacts/repository-evaluation");
const outputPath = resolve(projectRoot, "research/results/file-identity-silver-scan.json");
const markdownPath = resolve(projectRoot, "research/results/file-identity-silver-scan.md");
const minimumSymbolCount = 2;
const repositoryOverrides = parseRepositoryOverrides(process.argv.slice(2));

type Totals = {
  repositories: number;
  transitions: number;
  transitionsWithEitherSignal: number;
  silverRepositories: number;
  silverTransitions: number;
  removedPaths: number;
  addedPaths: number;
  eligibleRemovedPaths: number;
  eligibleAddedPaths: number;
  fingerprintMatches: number;
  declarationMatches: number;
  ambiguousGroups: number;
  predictedPairs: number;
  comparablePredictedPairs: number;
  silverPairs: number;
  agreements: number;
  predictionOnly: number;
  silverOnly: number;
};

type TransitionResult = {
  beforeCommit: string;
  afterCommit: string;
  removedPaths: number;
  addedPaths: number;
  eligibleRemovedPaths: number;
  eligibleAddedPaths: number;
  fingerprintMatches: number;
  declarationMatches: number;
  ambiguousGroups: number;
  silverAvailable: boolean;
  predicted: Array<{ beforePath: string; afterPath: string; evidence: string }>;
  silver: Array<{ beforePath: string; afterPath: string; similarity: number }>;
  agreement: ReturnType<typeof compareIdentityPairs>;
};

type RepositoryResult = {
  repository: string;
  language: string;
  repoPath: string;
  silverAvailable: boolean;
  silverSource: "configured" | "override" | "unavailable";
  totals: Totals;
  signalTransitions: TransitionResult[];
};

const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
  repositories: Array<{ fullName: string; language: string }>;
};
const status = JSON.parse(await readFile(resolve(collectionRoot, "status.json"), "utf8")) as {
  entries: Array<{ fullName: string; status: string }>;
};
const available = new Set(
  status.entries.filter(({ status }) => status !== "failed").map(({ fullName }) => fullName),
);

const repositories: RepositoryResult[] = [];
for (const entry of manifest.repositories) {
  if (!available.has(entry.fullName)) continue;
  process.stderr.write(`[file identity] ${entry.fullName}\n`);
  const artifactRoot = resolve(collectionRoot, entry.fullName);
  const config = JSON.parse(await readFile(resolve(artifactRoot, "config.json"), "utf8")) as {
    repoPath: string;
  };
  const commits = JSON.parse(
    await readFile(resolve(artifactRoot, "commits.json"), "utf8"),
  ) as Array<{
    hash: string;
  }>;
  const snapshots = await Promise.all(
    commits.map(
      async ({ hash }) =>
        JSON.parse(
          await readFile(resolve(artifactRoot, "snapshots", `${hash}.json`), "utf8"),
        ) as Snapshot,
    ),
  );
  const signalTransitions: TransitionResult[] = [];
  const totals = emptyTotals();
  totals.repositories = 1;
  const overridePath = repositoryOverrides.get(entry.fullName);
  const gitRepoPath = overridePath ?? config.repoPath;
  const silverAvailable = existsSync(resolve(gitRepoPath, ".git"));
  const silverSource = silverAvailable ? (overridePath ? "override" : "configured") : "unavailable";
  if (silverAvailable) totals.silverRepositories = 1;

  for (let index = 1; index < snapshots.length; index += 1) {
    const before = snapshots[index - 1];
    const after = snapshots[index];
    if (!before || !after) continue;
    const beforeFiles = fileNodes(before);
    const afterFiles = fileNodes(after);
    const beforePaths = new Set(beforeFiles.map(({ path }) => path));
    const afterPaths = new Set(afterFiles.map(({ path }) => path));
    const removed = beforeFiles.filter(({ path }) => !afterPaths.has(path));
    const added = afterFiles.filter(({ path }) => !beforePaths.has(path));
    const continuity = matchFileContinuity(beforeFiles, afterFiles, { minimumSymbolCount });
    const silver = silverAvailable
      ? parseGitRenameStatus(
          execFileSync(
            "git",
            [
              "-C",
              gitRepoPath,
              "diff",
              "--name-status",
              "-z",
              "--diff-filter=R",
              "--find-renames=50%",
              before.commit.hash,
              after.commit.hash,
              "--",
            ],
            { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
          ),
        ).filter(
          ({ beforePath, afterPath }) => beforePaths.has(beforePath) && afterPaths.has(afterPath),
        )
      : [];
    const predicted = continuity.matches.map(({ beforePath, afterPath, evidence }) => ({
      beforePath,
      afterPath,
      evidence,
    }));
    const agreement = compareIdentityPairs(predicted, silver);
    const transition: TransitionResult = {
      beforeCommit: before.commit.hash,
      afterCommit: after.commit.hash,
      removedPaths: removed.length,
      addedPaths: added.length,
      eligibleRemovedPaths: removed.filter(hasEnoughSymbols).length,
      eligibleAddedPaths: added.filter(hasEnoughSymbols).length,
      fingerprintMatches: continuity.matches.filter(({ evidence }) => evidence === "fingerprint")
        .length,
      declarationMatches: continuity.matches.filter(({ evidence }) => evidence === "declaration")
        .length,
      ambiguousGroups: continuity.ambiguous.length,
      silverAvailable,
      predicted,
      silver,
      agreement,
    };
    addTransition(totals, transition);
    if (predicted.length > 0 || silver.length > 0 || continuity.ambiguous.length > 0) {
      signalTransitions.push(transition);
    }
  }

  repositories.push({
    repository: entry.fullName,
    language: entry.language,
    repoPath: config.repoPath,
    silverAvailable,
    silverSource,
    totals,
    signalTransitions,
  });
}

const overall = sumTotals(repositories.map(({ totals }) => totals));
const languages = Object.fromEntries(
  [...new Set(repositories.map(({ language }) => language))]
    .sort()
    .map((language) => [
      language,
      sumTotals(
        repositories
          .filter((repository) => repository.language === language)
          .map(({ totals }) => totals),
      ),
    ]),
);
const artifact = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
  method: {
    minimumSymbolCount,
    candidateSet: "paths removed from one collected snapshot and added in the next",
    matcher:
      "unique exact multiset of symbol kind+fingerprint, then unique exact multiset of symbol kind+name for unmatched paths",
    abstention: "any signature duplicated on either side is reported as ambiguous and not linked",
    silver:
      "git diff --find-renames=50% --diff-filter=R, restricted to paths represented by both analyzer snapshots",
    interpretation:
      "agreement with an independent heuristic, not precision/recall against human identity ground truth",
    independence:
      "file pairs within one bulk move transition are clustered observations, not independent rename events",
  },
  corpus: {
    manifestRepositories: manifest.repositories.length,
    analyzedRepositories: repositories.length,
    missingRepositories: manifest.repositories
      .filter(({ fullName }) => !available.has(fullName))
      .map(({ fullName }) => fullName),
    missingLocalGitRepositories: repositories
      .filter(({ silverAvailable }) => !silverAvailable)
      .map(({ repository }) => repository),
    overrideRepositories: [...repositoryOverrides.keys()].sort(),
  },
  overall,
  rates: rates(overall),
  languages,
  repositories,
};

await writeAtomic(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
await writeAtomic(markdownPath, renderMarkdown(artifact));
process.stdout.write(
  `${JSON.stringify({ outputPath, markdownPath, overall, rates: rates(overall) }, null, 2)}\n`,
);

function fileNodes(snapshot: Snapshot): FileNode[] {
  return snapshot.nodes.filter((node): node is FileNode => node.type === "file");
}

function hasEnoughSymbols(file: FileNode): boolean {
  return (file.symbols?.length ?? 0) >= minimumSymbolCount;
}

function emptyTotals(): Totals {
  return {
    repositories: 0,
    transitions: 0,
    transitionsWithEitherSignal: 0,
    silverRepositories: 0,
    silverTransitions: 0,
    removedPaths: 0,
    addedPaths: 0,
    eligibleRemovedPaths: 0,
    eligibleAddedPaths: 0,
    fingerprintMatches: 0,
    declarationMatches: 0,
    ambiguousGroups: 0,
    predictedPairs: 0,
    comparablePredictedPairs: 0,
    silverPairs: 0,
    agreements: 0,
    predictionOnly: 0,
    silverOnly: 0,
  };
}

function addTransition(total: Totals, transition: TransitionResult): void {
  total.transitions += 1;
  if (transition.silverAvailable) total.silverTransitions += 1;
  if (transition.predicted.length > 0 || transition.silver.length > 0) {
    total.transitionsWithEitherSignal += 1;
  }
  total.removedPaths += transition.removedPaths;
  total.addedPaths += transition.addedPaths;
  total.eligibleRemovedPaths += transition.eligibleRemovedPaths;
  total.eligibleAddedPaths += transition.eligibleAddedPaths;
  total.fingerprintMatches += transition.fingerprintMatches;
  total.declarationMatches += transition.declarationMatches;
  total.ambiguousGroups += transition.ambiguousGroups;
  total.predictedPairs += transition.predicted.length;
  if (transition.silverAvailable) {
    total.comparablePredictedPairs += transition.predicted.length;
    total.silverPairs += transition.silver.length;
    total.agreements += transition.agreement.agreements;
    total.predictionOnly += transition.agreement.predictionOnly;
    total.silverOnly += transition.agreement.silverOnly;
  }
}

function sumTotals(items: readonly Totals[]): Totals {
  const result = emptyTotals();
  for (const item of items) {
    for (const key of Object.keys(result) as Array<keyof Totals>) result[key] += item[key];
  }
  return result;
}

function rates(total: Totals) {
  return {
    agreementAmongPredictions:
      total.comparablePredictedPairs === 0
        ? null
        : total.agreements / total.comparablePredictedPairs,
    coverageOfGitSilver: total.silverPairs === 0 ? null : total.agreements / total.silverPairs,
    removedEligibility:
      total.removedPaths === 0 ? null : total.eligibleRemovedPaths / total.removedPaths,
    addedEligibility: total.addedPaths === 0 ? null : total.eligibleAddedPaths / total.addedPaths,
  };
}

async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

function renderMarkdown(artifact: typeof artifact): string {
  const predictedRepositories = artifact.repositories.filter(
    ({ totals }) => totals.predictedPairs > 0,
  ).length;
  const predictedTransitions = artifact.repositories.reduce(
    (sum, { signalTransitions }) =>
      sum + signalTransitions.filter(({ predicted }) => predicted.length > 0).length,
    0,
  );
  const rows = artifact.repositories.map(({ repository, language, totals }) => {
    const repositoryRates = rates(totals);
    return `| ${repository} | ${language} | ${totals.transitions} | ${totals.predictedPairs} | ${totals.silverPairs} | ${totals.agreements} | ${formatRate(repositoryRates.agreementAmongPredictions)} | ${formatRate(repositoryRates.coverageOfGitSilver)} | ${totals.ambiguousGroups} |`;
  });
  const mismatchRows = artifact.repositories.flatMap(({ repository, signalTransitions }) =>
    signalTransitions
      .filter(
        ({ agreement, silverAvailable }) =>
          silverAvailable && (agreement.predictionOnly > 0 || agreement.silverOnly > 0),
      )
      .map(({ beforeCommit, afterCommit, predicted, silver, agreement }) => {
        const predictionOnly = pairDifference(predicted, silver);
        const silverOnly = pairDifference(silver, predicted);
        return `| ${repository} | ${beforeCommit.slice(0, 7)}→${afterCommit.slice(0, 7)} | ${agreement.predictionOnly} | ${agreement.silverOnly} | ${escapeCell(JSON.stringify(predictionOnly))} | ${escapeCell(JSON.stringify(silverOnly))} |`;
      }),
  );
  return `# File identity Git-silver scan

## 結果

- 対象: manifest 24 リポジトリ中、収集成功済み ${artifact.corpus.analyzedRepositories} リポジトリ、${artifact.overall.transitions} snapshot transitions
- matcher の提案: 全 artifact で ${artifact.overall.predictedPairs}。Git 比較可能な ${artifact.overall.silverRepositories} リポジトリ / ${artifact.overall.silverTransitions} transitions では ${artifact.overall.comparablePredictedPairs}
- Git rename silver: ${artifact.overall.silverPairs}、完全一致: ${artifact.overall.agreements}
- 提案内の Git 一致率: ${formatRate(artifact.rates.agreementAmongPredictions)}
- Git silver の捕捉率: ${formatRate(artifact.rates.coverageOfGitSilver)}
- fingerprint 採択: ${artifact.overall.fingerprintMatches}、宣言署名採択: ${artifact.overall.declarationMatches}、曖昧として棄却: ${artifact.overall.ambiguousGroups}
- 提案は ${predictedRepositories} repository / ${predictedTransitions} bulk-change transition に集中しており、17 pairを独立した17 rename eventとは数えない

この値は人手 gold に対する precision / recall ではない。Git の 50% similarity rename heuristic と、Sprawlens の構造署名 heuristic が同じ path pair を選ぶ割合である。特に prediction-only は直ちに誤検出を意味せず、silver-only は直ちに見逃しを意味しない。

## 契約

同一パスを除いた removed / added file だけを候補にする。完全な symbol fingerprint 多重集合の一意一致を先に採択し、残りに symbol kind/name 多重集合の一意一致を適用する。symbol は最低 ${artifact.method.minimumSymbolCount} 個必要で、どちらかの側に同一署名が複数あれば推測せず abstain する。

凍結済み artifact には fingerprint が保存されていないため、この走査の採択はすべて宣言署名 tier である。fingerprint tier の実装は将来の再収集に対する契約としてのみ検証される。

## Repository breakdown

| repository | language | transitions | predicted | Git silver | agree | agree / predicted | agree / silver | ambiguous |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join("\n")}

## Mismatch audit

| repository | transition | prediction-only | silver-only | predicted | Git silver |
|---|---:|---:|---:|---|---|
${mismatchRows.length === 0 ? "| — | — | 0 | 0 | — | — |" : mismatchRows.join("\n")}

## 制約

- 収集失敗の ollama/ollama と etcd-io/etcd は含まない。
- 元 Git checkout が存在しない ${artifact.corpus.missingLocalGitRepositories.length} リポジトリは matcher 集計には含むが、Git 一致率の分母から除外する。
- 15 個の first-parent snapshot は rename を豊富に含むよう選択された標本ではなく、rename event は疎である。
- 宣言の追加・削除、単一 symbol file、生成コード、同型の宣言集合では abstain または不一致になる。
- split / merge は one-to-one 契約の対象外である。
`;
}

function formatRate(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function pairDifference<T extends { beforePath: string; afterPath: string }>(
  left: readonly T[],
  right: readonly { beforePath: string; afterPath: string }[],
): T[] {
  const rightKeys = new Set(
    right.map(({ beforePath, afterPath }) => JSON.stringify([beforePath, afterPath])),
  );
  return left.filter(
    ({ beforePath, afterPath }) => !rightKeys.has(JSON.stringify([beforePath, afterPath])),
  );
}

function parseRepositoryOverrides(args: readonly string[]): Map<string, string> {
  const overrides = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--repository-override") continue;
    const value = args[index + 1];
    if (!value) throw new Error("--repository-override requires fullName=/absolute/path");
    const separator = value.indexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error("--repository-override requires fullName=/absolute/path");
    }
    overrides.set(value.slice(0, separator), resolve(value.slice(separator + 1)));
    index += 1;
  }
  return overrides;
}
