import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  buildSymbolDiffStatsNaive,
  createAstDiffProjectionFixture,
  createAstDiffTreeFixture,
  type AstDiffScalingMeasurement,
} from "../packages/viz/src/astDiffScalingBenchmark.ts";
import { diffAstSymbols } from "../packages/viz/src/astSymbolDiff.ts";
import { buildSymbolDiffStats } from "../packages/viz/src/diffStats.ts";

const kernel = enumOption("--kernel", ["hunk-projection", "symbol-tree"] as const);
const condition = enumOption("--condition", ["indexed", "naive", "parent-aware"] as const);
const symbolCount = integerOption("--symbols", 1_000, 1);
const hunkCount = integerOption("--hunks", kernel === "hunk-projection" ? 100 : 0, 0);
const maxDepth = integerOption("--depth", kernel === "symbol-tree" ? 1 : 0, 0);
const seed = integerOption("--seed", 1729, Number.MIN_SAFE_INTEGER);
const repetition = integerOption("--repetition", 1, 1);
const warmupIterations = integerOption("--warmups", 2, 0);

if (kernel === "hunk-projection" && condition === "parent-aware") {
  throw new Error("hunk-projection condition must be indexed or naive");
}
if (kernel === "symbol-tree" && condition !== "parent-aware") {
  throw new Error("symbol-tree condition must be parent-aware");
}
if (kernel === "hunk-projection" && hunkCount < 1) {
  throw new Error("hunk-projection requires at least one hunk");
}
if (kernel === "symbol-tree" && (maxDepth < 1 || maxDepth > symbolCount)) {
  throw new Error("symbol-tree depth must be between 1 and symbol count");
}

const run = createRun();
for (let iteration = 0; iteration < warmupIterations; iteration += 1) run();
const started = performance.now();
const output = run();
const durationMs = performance.now() - started;
const measurement: AstDiffScalingMeasurement = {
  schemaVersion: 1,
  kernel,
  condition,
  symbolCount,
  hunkCount,
  maxDepth,
  seed,
  repetition,
  warmupIterations,
  status: "ok",
  durationMs,
  maxRssKb: process.resourceUsage().maxRSS,
  outputDigest: digestMap(output),
  outputItems: output.size,
  error: null,
};
process.stdout.write(`${JSON.stringify(measurement)}\n`);

function createRun(): () => ReadonlyMap<string, unknown> {
  if (kernel === "hunk-projection") {
    const fixture = createAstDiffProjectionFixture({ symbolCount, hunkCount, seed });
    return condition === "indexed"
      ? () => buildSymbolDiffStats(fixture.symbols, fixture.hunks)
      : () => buildSymbolDiffStatsNaive(fixture.symbols, fixture.hunks);
  }
  const fixture = createAstDiffTreeFixture({ symbolCount, maxDepth, seed });
  return () => diffAstSymbols(fixture.before, fixture.after);
}

function digestMap(output: ReadonlyMap<string, unknown>): string {
  const canonical = [...output.entries()].sort(([left], [right]) => left.localeCompare(right));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function integerOption(name: string, fallback: number, minimum: number): number {
  const raw = option(name, String(fallback));
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer >= ${minimum}`);
  }
  return value;
}

function enumOption<const T extends readonly string[]>(name: string, values: T): T[number] {
  const value = option(name, "");
  if (!values.includes(value)) throw new Error(`${name} must be one of: ${values.join(", ")}`);
  return value as T[number];
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}
