import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import {
  AST_DIFF_REPOSITORY_CONDITIONS,
  parseAstDiffRepositoryFixture,
  runAstDiffRepositoryCase,
  type AstDiffRepositoryCondition,
  type AstDiffRepositoryMeasurement,
} from "../packages/viz/src/astDiffRepositoryBenchmark.ts";
import { chooseSymbolDiffProjectionStrategy } from "../packages/viz/src/diffStats.ts";

const fixturePath = resolve(option("--fixture", ""));
const caseId = option("--case", "");
const condition = enumOption("--condition", AST_DIFF_REPOSITORY_CONDITIONS);
const repetition = integerOption("--repetition", 1, 1);
const warmupIterations = integerOption("--warmups", 2, 0);
const batchIterations = integerOption("--iterations", 100, 1);
if (!fixturePath) throw new Error("--fixture is required");
if (!caseId) throw new Error("--case is required");

const fixture = parseAstDiffRepositoryFixture(JSON.parse(await readFile(fixturePath, "utf8")));
const testCase = fixture.cases.find((item) => item.id === caseId);
if (!testCase) throw new Error(`unknown repository fixture case: ${caseId}`);
const run = () => runAstDiffRepositoryCase(testCase, condition);
for (let iteration = 0; iteration < warmupIterations; iteration += 1) run();
let output: ReturnType<typeof run> | null = null;
const started = performance.now();
for (let iteration = 0; iteration < batchIterations; iteration += 1) output = run();
const durationMs = performance.now() - started;
if (!output) throw new Error("repository worker produced no output");
const adaptiveStrategies = testCase.files.map((file) =>
  chooseSymbolDiffProjectionStrategy(file.after.length, file.hunks.length),
);
const measurement: AstDiffRepositoryMeasurement = {
  schemaVersion: 1,
  caseId: testCase.id,
  repository: testCase.repository,
  condition,
  repetition,
  warmupIterations,
  batchIterations,
  fileCount: testCase.files.length,
  beforeSymbolCount: countSymbols(testCase.files, "before"),
  afterSymbolCount: countSymbols(testCase.files, "after"),
  hunkCount: testCase.files.reduce((sum, file) => sum + file.hunks.length, 0),
  adaptiveNaiveFileCount: adaptiveStrategies.filter((strategy) => strategy === "naive").length,
  adaptiveIndexedFileCount: adaptiveStrategies.filter((strategy) => strategy === "indexed").length,
  status: "ok",
  durationMs,
  durationPerIterationMs: durationMs / batchIterations,
  maxRssKb: process.resourceUsage().maxRSS,
  outputDigest: digestMap(output),
  outputItems: output.size,
  error: null,
};
process.stdout.write(`${JSON.stringify(measurement)}\n`);

function countSymbols(files: typeof testCase.files, side: "before" | "after"): number {
  return files.reduce((sum, file) => sum + file[side].length, 0);
}

function digestMap(output: ReadonlyMap<string, unknown>): string {
  const canonical = [...output.entries()].sort(([left], [right]) => left.localeCompare(right));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function integerOption(name: string, fallback: number, minimum: number): number {
  const value = Number(option(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer >= ${minimum}`);
  }
  return value;
}

function enumOption<const T extends readonly string[]>(name: string, values: T): T[number] {
  const value = option(name, "") as AstDiffRepositoryCondition;
  if (!values.includes(value)) throw new Error(`${name} must be one of: ${values.join(", ")}`);
  return value as T[number];
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}
