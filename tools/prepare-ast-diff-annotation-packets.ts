import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { extractCodeSymbolsFromSource } from "../packages/analyzer-ts/src/snapshot.ts";
import {
  renderAstDiffAnnotationPacket,
  type AstDiffAnnotationPacketCase,
} from "../packages/viz/src/astDiffAnnotationPacket.ts";

const execFileAsync = promisify(execFile);

type CandidateCase = AstDiffAnnotationPacketCase & { repositoryPath: string };
type CandidateManifest = {
  schemaVersion: 1;
  datasetId: string;
  selectionProtocol: string;
  cases: CandidateCase[];
};

const manifestPath = resolve(process.argv[2] ?? "research/ast-diff-confirmatory-candidates.json");
const outputDirectory = resolve(
  process.argv[3] ?? "research/annotation-packets/ast-diff-confirmatory-v1",
);
const outputDatasetId = process.argv[4];
const predictionBlind = process.argv[5] !== "posthoc";
const manifest = parseManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const manifestDirectory = dirname(manifestPath);

const outputs: Array<{
  id: string;
  packet: string;
  packetSha256: string;
  patchSha256: string;
  afterSourceSha256: string;
  afterSymbolCount: number;
}> = [];

for (const testCase of manifest.cases) {
  const repo = resolve(manifestDirectory, testCase.repositoryPath);
  await verifyCommit(repo, testCase.beforeRevision);
  await verifyCommit(repo, testCase.afterRevision);
  const [afterSource, patch] = await Promise.all([
    git(repo, ["show", `${testCase.afterRevision}:${testCase.file}`]),
    git(repo, [
      "diff",
      "--no-ext-diff",
      "--unified=20",
      testCase.beforeRevision,
      testCase.afterRevision,
      "--",
      testCase.file,
    ]),
  ]);
  const symbols = extractCodeSymbolsFromSource(testCase.file, afterSource);
  const packet = renderAstDiffAnnotationPacket(testCase, symbols, patch, { predictionBlind });
  const packetPath = resolve(outputDirectory, `${testCase.id}.md`);
  await writeAtomic(packetPath, packet);
  outputs.push({
    id: testCase.id,
    packet: `${testCase.id}.md`,
    packetSha256: sha256(packet),
    patchSha256: sha256(patch),
    afterSourceSha256: sha256(afterSource),
    afterSymbolCount: symbols.length,
  });
}

await writeAtomic(
  resolve(outputDirectory, "packet-manifest.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      datasetId: outputDatasetId ?? manifest.datasetId,
      selectionProtocol: manifest.selectionProtocol,
      predictionBlind,
      cases: outputs,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `${outputDatasetId ?? manifest.datasetId}: wrote ${outputs.length} ${predictionBlind ? "prediction-blind" : "post-hoc"} annotation packets\n`,
);

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

async function verifyCommit(repo: string, revision: string): Promise<void> {
  await git(repo, ["rev-parse", "--verify", `${revision}^{commit}`]);
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseManifest(value: unknown): CandidateManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("candidate manifest must be an object");
  }
  const root = value as Record<string, unknown>;
  if (root.schemaVersion !== 1) throw new Error("candidate schemaVersion must be 1");
  if (typeof root.datasetId !== "string" || root.datasetId.length === 0) {
    throw new Error("candidate datasetId must be a non-empty string");
  }
  if (typeof root.selectionProtocol !== "string" || root.selectionProtocol.length === 0) {
    throw new Error("candidate selectionProtocol must be a non-empty string");
  }
  if (!Array.isArray(root.cases)) throw new Error("candidate cases must be an array");
  const ids = new Set<string>();
  const cases = root.cases.map((rawCase, index): CandidateCase => {
    if (typeof rawCase !== "object" || rawCase === null || Array.isArray(rawCase)) {
      throw new Error(`candidate cases[${index}] must be an object`);
    }
    const item = rawCase as Record<string, unknown>;
    const required = [
      "id",
      "language",
      "repository",
      "repositoryPath",
      "beforeRevision",
      "afterRevision",
      "file",
    ] as const;
    for (const key of required) {
      if (typeof item[key] !== "string" || item[key].length === 0) {
        throw new Error(`candidate cases[${index}].${key} must be a non-empty string`);
      }
    }
    const id = item.id as string;
    if (ids.has(id)) throw new Error(`duplicate candidate case id: ${id}`);
    ids.add(id);
    if (!Array.isArray(item.changeKinds) || item.changeKinds.length === 0) {
      throw new Error(`${id}.changeKinds must be a non-empty array`);
    }
    return {
      id,
      language: item.language as string,
      repository: item.repository as string,
      repositoryPath: item.repositoryPath as string,
      beforeRevision: item.beforeRevision as string,
      afterRevision: item.afterRevision as string,
      file: item.file as string,
      changeKinds: item.changeKinds.map((kind, kindIndex) => {
        if (typeof kind !== "string" || kind.length === 0) {
          throw new Error(`${id}.changeKinds[${kindIndex}] must be a non-empty string`);
        }
        return kind;
      }),
    };
  });
  return {
    schemaVersion: 1,
    datasetId: root.datasetId,
    selectionProtocol: root.selectionProtocol,
    cases,
  };
}
