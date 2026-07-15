import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import {
  summarizeAstDiffScalingMeasurements,
  type AstDiffScalingGroup,
  type AstDiffScalingMeasurement,
} from "../packages/viz/src/astDiffScalingBenchmark.ts";

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const profile = enumOption("--profile", ["smoke", "pilot"] as const, "pilot");
const defaults = profileDefaults(profile);
const repetitions = integerOption("--repetitions", defaults.repetitions, 1);
const warmupIterations = integerOption("--warmups", defaults.warmupIterations, 0);
const timeoutMs = integerOption("--timeout-ms", defaults.timeoutMs, 1);
const outputPath = resolve(option("--output", "research/results/ast-diff-scaling-pilot.json"));
const markdownPath = resolve(option("--markdown", "research/results/ast-diff-scaling-pilot.md"));
const seed = integerOption("--seed", 1729, Number.MIN_SAFE_INTEGER);
const protocol = {
  profile,
  seed,
  repetitions,
  warmupIterations,
  timeoutMs,
  processIsolation: "one fresh Node.js process per condition × scenario × repetition" as const,
  timingScope: "one algorithm call after in-process warmup; fixture generation excluded" as const,
  memoryScope:
    "process.resourceUsage().maxRSS after fixture generation, warmup, and measured call" as const,
  correctnessGate:
    "indexed and naive projection output SHA-256 digests must match per scenario" as const,
  order:
    "indexed/naive order alternates by repetition; scenarios use fixed ascending order" as const,
  projection: {
    symbolCounts: defaults.symbolCounts,
    hunkCounts: defaults.hunkCounts,
    conditions: ["indexed", "naive"] as const,
  },
  symbolTree: {
    symbolCounts: defaults.symbolCounts,
    maxDepths: defaults.maxDepths,
    conditions: ["parent-aware"] as const,
  },
};
const protocolHash = sha256(JSON.stringify(protocol));
const [{ stdout: revision }, { stdout: status }] = await Promise.all([
  exec("git", ["rev-parse", "HEAD"], { cwd: projectRoot }),
  exec("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: projectRoot }),
]);
const measurements: AstDiffScalingMeasurement[] = [];
const startedAt = new Date().toISOString();

for (const symbolCount of defaults.symbolCounts) {
  for (const hunkCount of defaults.hunkCounts) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const conditions =
        repetition % 2 === 1 ? (["indexed", "naive"] as const) : (["naive", "indexed"] as const);
      for (const condition of conditions) {
        process.stderr.write(
          `[projection S=${symbolCount} H=${hunkCount} ${condition} ${repetition}/${repetitions}]\n`,
        );
        measurements.push(
          await runWorker({
            kernel: "hunk-projection",
            condition,
            symbolCount,
            hunkCount,
            maxDepth: 0,
            repetition,
          }),
        );
      }
    }
  }
}

for (const symbolCount of defaults.symbolCounts) {
  for (const maxDepth of defaults.maxDepths.filter((depth) => depth <= symbolCount)) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      process.stderr.write(
        `[symbol-tree S=${symbolCount} D=${maxDepth} parent-aware ${repetition}/${repetitions}]\n`,
      );
      measurements.push(
        await runWorker({
          kernel: "symbol-tree",
          condition: "parent-aware",
          symbolCount,
          hunkCount: 0,
          maxDepth,
          repetition,
        }),
      );
    }
  }
}

const summary = summarizeAstDiffScalingMeasurements(measurements);
const result = {
  schemaVersion: 1 as const,
  status: "exploratory synthetic process-isolated scaling pilot" as const,
  startedAt,
  finishedAt: new Date().toISOString(),
  protocolHash,
  protocol,
  implementation: {
    revision: revision.trim(),
    dirtyAtRun: status.trim().length > 0,
  },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpus: cpus().length,
  },
  measurements,
  summary,
};
await Promise.all([
  writeAtomic(outputPath, `${JSON.stringify(result, null, 2)}\n`),
  writeAtomic(markdownPath, renderMarkdown(result)),
]);
process.stdout.write(
  `${JSON.stringify(
    {
      output: relative(projectRoot, outputPath),
      markdown: relative(projectRoot, markdownPath),
      protocolHash,
      measurements: measurements.length,
      failures: measurements.filter(({ status }) => status !== "ok").length,
      projectionComparisons: summary.projectionComparisons.length,
    },
    null,
    2,
  )}\n`,
);

async function runWorker(input: {
  kernel: AstDiffScalingMeasurement["kernel"];
  condition: AstDiffScalingMeasurement["condition"];
  symbolCount: number;
  hunkCount: number;
  maxDepth: number;
  repetition: number;
}): Promise<AstDiffScalingMeasurement> {
  const base = {
    schemaVersion: 1 as const,
    kernel: input.kernel,
    condition: input.condition,
    symbolCount: input.symbolCount,
    hunkCount: input.hunkCount,
    maxDepth: input.maxDepth,
    seed,
    repetition: input.repetition,
    warmupIterations,
  };
  try {
    const { stdout, stderr } = await exec(
      "pnpm",
      [
        "exec",
        "tsx",
        "tools/ast-diff-scaling-worker.ts",
        "--kernel",
        input.kernel,
        "--condition",
        input.condition,
        "--symbols",
        String(input.symbolCount),
        "--hunks",
        String(input.hunkCount),
        "--depth",
        String(input.maxDepth),
        "--seed",
        String(seed),
        "--repetition",
        String(input.repetition),
        "--warmups",
        String(warmupIterations),
      ],
      {
        cwd: projectRoot,
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (stderr) process.stderr.write(stderr);
    const measurement = JSON.parse(stdout) as AstDiffScalingMeasurement;
    assertWorkerContract(measurement, base);
    return measurement;
  } catch (error) {
    const childError = error as Error & {
      killed?: boolean;
      signal?: NodeJS.Signals;
      stderr?: string;
    };
    if (childError.stderr) process.stderr.write(childError.stderr);
    const timedOut = childError.killed === true || childError.signal === "SIGKILL";
    return {
      ...base,
      status: timedOut ? "timeout" : "error",
      durationMs: null,
      maxRssKb: null,
      outputDigest: null,
      outputItems: null,
      error: timedOut
        ? `timed out after ${timeoutMs} ms`
        : sanitizeError(childError.message || "worker failed"),
    };
  }
}

function assertWorkerContract(
  measurement: AstDiffScalingMeasurement,
  expected: Pick<
    AstDiffScalingMeasurement,
    | "kernel"
    | "condition"
    | "symbolCount"
    | "hunkCount"
    | "maxDepth"
    | "seed"
    | "repetition"
    | "warmupIterations"
  >,
): void {
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (measurement[key] !== expected[key]) throw new Error(`worker contract mismatch: ${key}`);
  }
  if (measurement.status !== "ok") throw new Error("worker did not return an ok measurement");
}

function renderMarkdown(result: {
  status: string;
  protocolHash: string;
  implementation: { revision: string; dirtyAtRun: boolean };
  environment: { node: string; platform: string; arch: string; cpu: string };
  protocol: typeof protocol;
  summary: ReturnType<typeof summarizeAstDiffScalingMeasurements>;
}): string {
  const projectionRows = result.summary.projectionComparisons.map((comparison) => {
    const indexed = findGroup(
      result.summary.groups,
      "hunk-projection",
      "indexed",
      comparison.symbolCount,
      comparison.hunkCount,
      0,
    );
    const naive = findGroup(
      result.summary.groups,
      "hunk-projection",
      "naive",
      comparison.symbolCount,
      comparison.hunkCount,
      0,
    );
    return `| ${comparison.symbolCount} | ${comparison.hunkCount} | ${formatMs(indexed.durationMs?.p50)} | ${formatMs(indexed.durationMs?.p95)} | ${formatMs(indexed.durationMs?.p99)} | ${formatMs(naive.durationMs?.p50)} | ${formatMs(naive.durationMs?.p95)} | ${formatMs(naive.durationMs?.p99)} | ${comparison.speedup.toFixed(2)}× | ${formatInteger(indexed.maxRssKb?.p50)} | ${formatInteger(naive.maxRssKb?.p50)} | ${indexed.failures + naive.failures} |`;
  });
  const treeRows = result.summary.groups
    .filter((group) => group.kernel === "symbol-tree")
    .map(
      (group) =>
        `| ${group.symbolCount} | ${group.maxDepth} | ${formatMs(group.durationMs?.p50)} | ${formatMs(group.durationMs?.p95)} | ${formatMs(group.durationMs?.p99)} | ${formatInteger(group.maxRssKb?.p50)} | ${group.outputItems ?? "–"} | ${group.failures} |`,
    );
  return `# AST diff scaling pilot

Status: ${result.status}. This is a synthetic, single-machine exploratory measurement, not a confirmatory estimate.

- Protocol SHA-256: \`${result.protocolHash}\`
- Implementation: \`${result.implementation.revision}\` (dirty at run: \`${result.implementation.dirtyAtRun}\`)
- Environment: ${result.environment.node}, ${result.environment.platform}/${result.environment.arch}, ${result.environment.cpu}
- Isolation: ${result.protocol.processIsolation}
- Timing scope: ${result.protocol.timingScope}
- Memory scope: ${result.protocol.memoryScope}
- Repetitions: ${result.protocol.repetitions}; warmups per process: ${result.protocol.warmupIterations}; timeout: ${result.protocol.timeoutMs} ms
- Correctness gate: ${result.protocol.correctnessGate}

## Hunk projection

| Symbols | Hunks | Indexed p50 | Indexed p95 | Indexed p99 | Naive p50 | Naive p95 | Naive p99 | p50 speedup | Indexed RSS p50 KiB | Naive RSS p50 KiB | Failures |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${projectionRows.join("\n")}

The indexed condition is the production piecewise prefix index. The naive condition is a semantic-equivalent reference that scans every hunk for every symbol. Fixture construction and process startup are excluded from duration; peak RSS includes the runtime, fixture, warmups, and measured call.

## Symbol-tree diff

| Symbols | Max depth | Parent-aware p50 | p95 | p99 | RSS p50 KiB | Highlighted output | Failures |
|---:|---:|---:|---:|---:|---:|---:|---:|
${treeRows.join("\n")}

Depth measurements exercise parent-qualified identity and ancestor propagation separately from hunk projection. With only ${result.protocol.repetitions} repetitions, p95 and p99 are descriptive interpolations and must not be treated as stable tail estimates.
`;
}

function findGroup(
  groups: readonly AstDiffScalingGroup[],
  kernel: AstDiffScalingGroup["kernel"],
  condition: AstDiffScalingGroup["condition"],
  symbolCount: number,
  hunkCount: number,
  maxDepth: number,
): AstDiffScalingGroup {
  const group = groups.find(
    (item) =>
      item.kernel === kernel &&
      item.condition === condition &&
      item.symbolCount === symbolCount &&
      item.hunkCount === hunkCount &&
      item.maxDepth === maxDepth,
  );
  if (!group) throw new Error("missing scaling summary group");
  return group;
}

function profileDefaults(value: "smoke" | "pilot") {
  return value === "smoke"
    ? {
        repetitions: 1,
        warmupIterations: 1,
        timeoutMs: 10_000,
        symbolCounts: [100, 500],
        hunkCounts: [20, 100],
        maxDepths: [1, 8],
      }
    : {
        repetitions: 3,
        warmupIterations: 2,
        timeoutMs: 30_000,
        symbolCounts: [1_000, 5_000, 20_000],
        hunkCounts: [100, 500, 2_000],
        maxDepths: [1, 4, 16],
      };
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

function formatMs(value: number | undefined): string {
  return value === undefined ? "–" : `${value.toFixed(3)} ms`;
}

function formatInteger(value: number | undefined): string {
  return value === undefined ? "–" : Math.round(value).toLocaleString("en-US");
}

function sanitizeError(value: string): string {
  return value.replaceAll(projectRoot, "<project-root>").slice(0, 2_000);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function integerOption(name: string, fallback: number, minimum: number): number {
  const value = Number(option(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer >= ${minimum}`);
  }
  return value;
}

function enumOption<const T extends readonly string[]>(
  name: string,
  values: T,
  fallback: T[number],
): T[number] {
  const value = option(name, fallback);
  if (!values.includes(value)) throw new Error(`${name} must be one of: ${values.join(", ")}`);
  return value as T[number];
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}
