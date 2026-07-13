import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { extractCodeSymbolsFromSource } from "../packages/analyzer-ts/src/snapshot.ts";
import { renderAstDiffAnnotationPacket } from "../packages/viz/src/astDiffAnnotationPacket.ts";
import {
  createSoloAstDiffAnnotationPasses,
  createUniqueSoloAstDiffSelectors,
  type SoloAstDiffAnnotationSourceCase,
} from "../packages/viz/src/astDiffSoloAnnotation.ts";

const execFileAsync = promisify(execFile);
const manifestPath = resolve(
  option("--manifest", "research/ast-diff-confirmatory-v2-candidates.json"),
);
const outputRoot = resolve(
  option("--output", "research/annotation-packets/ast-diff-confirmatory-v2-solo"),
);
const researchRoot = resolve(option("--research-root", "research"));
const passASeed = integerOption("--pass-a-seed", 1729);
const passBSeed = integerOption("--pass-b-seed", 2027);
const minimumWashoutDays = integerOption("--washout-days", 7);
const initializePass = passOption("--initialize-pass", "A");
const manifest = parseCandidateManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const manifestDirectory = dirname(manifestPath);

const evidence = new Map<
  string,
  {
    testCase: CandidateCase;
    afterSource: string;
    patch: string;
    symbols: ReturnType<typeof extractCodeSymbolsFromSource>;
  }
>();
const sourceCases: SoloAstDiffAnnotationSourceCase[] = [];
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
  const candidates = createUniqueSoloAstDiffSelectors(symbols);
  sourceCases.push({ id: testCase.id, candidates });
  evidence.set(testCase.id, { testCase, afterSource, patch, symbols });
}

const passes = createSoloAstDiffAnnotationPasses(sourceCases, {
  datasetId: manifest.datasetId,
  passASeed,
  passBSeed,
  minimumWashoutDays,
});

for (const { passId, pass } of [
  { passId: "A" as const, pass: passes.passA },
  { passId: "B" as const, pass: passes.passB },
]) {
  const passDirectory = resolve(outputRoot, `pass-${passId.toLowerCase()}`);
  const sheetCases = new Map(pass.sheet.cases.map((item) => [item.alias, item]));
  const packetCases = [];
  for (const { alias, caseId } of pass.key.cases) {
    const item = evidence.get(caseId)!;
    const sheetCase = sheetCases.get(alias)!;
    const packet = renderAstDiffAnnotationPacket(item.testCase, item.symbols, item.patch, {
      predictionBlind: true,
      packetId: alias,
      candidateSelectors: sheetCase.decisions.map((decision) => decision.symbol),
    });
    const packetPath = resolve(passDirectory, `${alias}.md`);
    await writeAtomic(packetPath, packet);
    packetCases.push({
      alias,
      packet: `${alias}.md`,
      packetSha256: sha256(packet),
      patchSha256: sha256(item.patch),
      afterSourceSha256: sha256(item.afterSource),
      afterSymbolCount: item.symbols.length,
    });
  }
  await writeJson(resolve(passDirectory, "packet-manifest.json"), {
    schemaVersion: 1,
    datasetId: manifest.datasetId,
    passId,
    predictionBlind: true,
    minimumWashoutDays,
    cases: packetCases,
  });
  await writeJson(
    resolve(researchRoot, `ast-diff-confirmatory-v2-solo-pass-${passId.toLowerCase()}-key.json`),
    pass.key,
  );
  await writeJson(
    resolve(
      researchRoot,
      `ast-diff-confirmatory-v2-solo-pass-${passId.toLowerCase()}-template.json`,
    ),
    pass.sheet,
  );
}

const initializedWorkingPass = await initializeWorkingSheet(
  initializePass,
  initializePass === "A" ? passes.passA.sheet : passes.passB.sheet,
);

process.stdout.write(
  `${manifest.datasetId}: wrote ${manifest.cases.length} cases for each solo pass; packet root ${relative(process.cwd(), outputRoot)}; pass ${initializePass} working sheet ${initializedWorkingPass ? "initialized" : "preserved"}\n`,
);

type CandidateCase = {
  id: string;
  language: string;
  repository: string;
  repositoryPath: string;
  beforeRevision: string;
  afterRevision: string;
  file: string;
  changeKinds: string[];
};

function parseCandidateManifest(value: unknown): {
  schemaVersion: 1;
  datasetId: string;
  cases: CandidateCase[];
} {
  const root = objectAt(value, "candidate manifest");
  if (root.schemaVersion !== 1) throw new Error("candidate schemaVersion must be 1");
  const datasetId = stringAt(root.datasetId, "candidate datasetId");
  if (!Array.isArray(root.cases) || root.cases.length < 2) {
    throw new Error("candidate cases must contain at least two cases");
  }
  const ids = new Set<string>();
  const cases = root.cases.map((rawCase, index): CandidateCase => {
    const item = objectAt(rawCase, `candidate cases[${index}]`);
    const id = stringAt(item.id, `candidate cases[${index}].id`);
    if (ids.has(id)) throw new Error(`duplicate candidate case id: ${id}`);
    ids.add(id);
    if (!Array.isArray(item.changeKinds) || item.changeKinds.length === 0) {
      throw new Error(`${id}.changeKinds must be a non-empty array`);
    }
    return {
      id,
      language: stringAt(item.language, `${id}.language`),
      repository: stringAt(item.repository, `${id}.repository`),
      repositoryPath: stringAt(item.repositoryPath, `${id}.repositoryPath`),
      beforeRevision: stringAt(item.beforeRevision, `${id}.beforeRevision`),
      afterRevision: stringAt(item.afterRevision, `${id}.afterRevision`),
      file: stringAt(item.file, `${id}.file`),
      changeKinds: item.changeKinds.map((kind, kindIndex) =>
        stringAt(kind, `${id}.changeKinds[${kindIndex}]`),
      ),
    };
  });
  return { schemaVersion: 1, datasetId, cases };
}

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

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonIfMissing(path: string, value: unknown): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return false;
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
  await writeJson(path, value);
  return true;
}

async function initializeWorkingSheet(passId: "A" | "B", sheet: unknown): Promise<boolean> {
  if (passId === "B") {
    const lockPath = resolve(researchRoot, "ast-diff-confirmatory-v2-solo-pass-a-lock.json");
    const lock = objectAt(JSON.parse(await readFile(lockPath, "utf8")), "pass A lock");
    const completedOn = stringAt(lock.completedOn, "pass A lock.completedOn");
    const washoutDays = Number(lock.minimumWashoutDays);
    if (!Number.isInteger(washoutDays) || washoutDays < 1) {
      throw new Error("pass A lock.minimumWashoutDays must be a positive integer");
    }
    const earliest = new Date(`${completedOn}T00:00:00.000Z`);
    earliest.setUTCDate(earliest.getUTCDate() + washoutDays);
    const today = new Date().toISOString().slice(0, 10);
    const earliestDay = earliest.toISOString().slice(0, 10);
    if (today < earliestDay) {
      throw new Error(`pass B cannot start before ${earliestDay}; today is ${today}`);
    }
  }
  const path = resolve(
    researchRoot,
    `ast-diff-confirmatory-v2-solo-pass-${passId.toLowerCase()}.json`,
  );
  if (process.argv.includes("--replace-working")) {
    await writeJson(path, sheet);
    return true;
  }
  return writeJsonIfMissing(path, sheet);
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

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function integerOption(name: string, fallback: number): number {
  const value = Number.parseInt(option(name, String(fallback)), 10);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe integer`);
  return value;
}

function passOption(name: string, fallback: "A" | "B"): "A" | "B" {
  const value = option(name, fallback).toUpperCase();
  if (value !== "A" && value !== "B") throw new Error(`${name} must be A or B`);
  return value;
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
