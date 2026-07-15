import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { extractCodeSymbolsFromSource } from "../packages/analyzer-ts/src/snapshot.ts";
import { parseUnifiedDiffHunks } from "../packages/server/src/workingDiff.ts";
import {
  parseAstDiffRepositoryFixture,
  type AstDiffRepositoryCaseFixture,
} from "../packages/viz/src/astDiffRepositoryBenchmark.ts";
import {
  isAstDiffRepositorySourcePath,
  parseAstDiffRepositoryChangedFiles,
  parseAstDiffRepositoryDevelopmentManifest,
} from "./ast-diff-repository-corpus.ts";

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(
  option("--manifest", "research/ast-diff-confirmatory-candidates.json"),
);
const outputPath = resolve(
  option("--output", "research/datasets/ast-diff-repository-performance-v1.json"),
);
const manifestText = await readFile(manifestPath, "utf8");
const manifest = parseAstDiffRepositoryDevelopmentManifest(JSON.parse(manifestText));
const manifestDirectory = dirname(manifestPath);
const cases: AstDiffRepositoryCaseFixture[] = [];

for (const manifestCase of manifest.cases) {
  const repositoryPath = resolve(manifestDirectory, manifestCase.repositoryPath);
  await Promise.all([
    verifyRevision(repositoryPath, manifestCase.beforeRevision),
    verifyRevision(repositoryPath, manifestCase.afterRevision),
  ]);
  const [nameStatus, patch] = await Promise.all([
    git(repositoryPath, [
      "diff",
      "--name-status",
      "--find-renames",
      manifestCase.beforeRevision,
      manifestCase.afterRevision,
      "--",
    ]),
    git(repositoryPath, [
      "diff",
      "--no-ext-diff",
      "--unified=0",
      "--find-renames",
      manifestCase.beforeRevision,
      manifestCase.afterRevision,
      "--",
    ]),
  ]);
  const changedFiles = parseAstDiffRepositoryChangedFiles(nameStatus);
  if (changedFiles.length === 0) {
    throw new Error(`${manifestCase.id} has no analyzable changed source files`);
  }
  const hunksByPath = parseUnifiedDiffHunks(patch);
  const files = await Promise.all(
    changedFiles.map(async (file) => {
      const [beforeSource, afterSource] = await Promise.all([
        file.beforePath && isAstDiffRepositorySourcePath(file.beforePath)
          ? sourceAtRevision(repositoryPath, manifestCase.beforeRevision, file.beforePath)
          : "",
        file.afterPath && isAstDiffRepositorySourcePath(file.afterPath)
          ? sourceAtRevision(repositoryPath, manifestCase.afterRevision, file.afterPath)
          : "",
      ]);
      return {
        changeStatus: file.status,
        beforePath: file.beforePath,
        afterPath: file.afterPath,
        before:
          beforeSource && file.beforePath
            ? extractCodeSymbolsFromSource(file.beforePath, beforeSource)
            : [],
        after:
          afterSource && file.afterPath
            ? extractCodeSymbolsFromSource(file.afterPath, afterSource)
            : [],
        hunks: file.afterPath ? (hunksByPath[file.afterPath] ?? []) : [],
      };
    }),
  );
  files.sort((left, right) =>
    (left.afterPath ?? left.beforePath ?? "").localeCompare(
      right.afterPath ?? right.beforePath ?? "",
    ),
  );
  cases.push({
    id: manifestCase.id,
    repository: manifestCase.repository,
    beforeRevision: manifestCase.beforeRevision,
    afterRevision: manifestCase.afterRevision,
    files,
  });
}

const fixture = parseAstDiffRepositoryFixture({
  schemaVersion: 1,
  sourceDatasetId: manifest.datasetId,
  status: "post-hoc development corpus; not confirmatory evidence",
  cases,
});
await writeAtomic(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify(
    {
      output: relative(projectRoot, outputPath),
      sourceDatasetId: fixture.sourceDatasetId,
      repositories: new Set(fixture.cases.map((testCase) => testCase.repository)).size,
      cases: fixture.cases.length,
      files: fixture.cases.reduce((sum, testCase) => sum + testCase.files.length, 0),
      beforeSymbols: fixture.cases.reduce(
        (sum, testCase) =>
          sum + testCase.files.reduce((fileSum, file) => fileSum + file.before.length, 0),
        0,
      ),
      afterSymbols: fixture.cases.reduce(
        (sum, testCase) =>
          sum + testCase.files.reduce((fileSum, file) => fileSum + file.after.length, 0),
        0,
      ),
      hunks: fixture.cases.reduce(
        (sum, testCase) =>
          sum + testCase.files.reduce((fileSum, file) => fileSum + file.hunks.length, 0),
        0,
      ),
    },
    null,
    2,
  )}\n`,
);

async function verifyRevision(repositoryPath: string, revision: string): Promise<void> {
  await git(repositoryPath, ["rev-parse", "--verify", `${revision}^{commit}`]);
}

async function sourceAtRevision(
  repositoryPath: string,
  revision: string,
  path: string,
): Promise<string> {
  try {
    return await git(repositoryPath, ["show", `${revision}:${path}`]);
  } catch {
    return "";
  }
}

async function git(repositoryPath: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}
