import { execFile } from "node:child_process";
import { cpus } from "node:os";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  compareConditionMemory,
  summarizeConditionMemoryPairs,
  type ConditionMemoryMeasurement,
} from "../packages/cli/src/repositoryEvaluationMemory.ts";

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(
  projectRoot,
  "research/results/repository-evaluation-condition-memory.json",
);

const measure = async (condition: "baseline" | "stable") => {
  const { stdout, stderr } = await exec(
    "pnpm",
    ["exec", "tsx", "tools/repository-condition-memory-worker.ts", condition],
    { cwd: projectRoot, maxBuffer: 16 * 1024 * 1024 },
  );
  process.stderr.write(stderr);
  return JSON.parse(stdout) as ConditionMemoryMeasurement & {
    schemaVersion: 1;
    manifestHash: string;
    wallClockMs: number;
    meanSteps: number;
    meanWeightedSolves: number;
  };
};

const executionOrders = [
  ["baseline", "stable"],
  ["stable", "baseline"],
  ["baseline", "stable"],
] as const;
const runs = [];
for (const [index, executionOrder] of executionOrders.entries()) {
  process.stderr.write(
    `[memory repetition ${index + 1}/${executionOrders.length}: ${executionOrder.join(" -> ")}]\n`,
  );
  const first = await measure(executionOrder[0]);
  const second = await measure(executionOrder[1]);
  const baseline = first.condition === "baseline" ? first : second;
  const stable = first.condition === "stable" ? first : second;
  if (baseline.manifestHash !== stable.manifestHash) throw new Error("condition manifest mismatch");
  runs.push({
    repetition: index + 1,
    executionOrder,
    baseline,
    stable,
    comparison: compareConditionMemory(baseline, stable),
  });
}
const manifestHashes = new Set(
  runs.flatMap(({ baseline, stable }) => [baseline.manifestHash, stable.manifestHash]),
);
if (manifestHashes.size !== 1) throw new Error("repetition manifest mismatch");
const comparison = summarizeConditionMemoryPairs(runs);
const output = {
  schemaVersion: 2 as const,
  status: "post-hoc condition-isolated peak memory measurement" as const,
  manifestHash: runs[0]!.baseline.manifestHash,
  scope:
    "one Node.js process per condition; snapshot loading and before-layout generation included equally" as const,
  repetitions: runs.length,
  executionOrders,
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model ?? "unknown",
  },
  runs,
  comparison,
};
await mkdir(resolve(outputPath, ".."), { recursive: true });
const temporary = `${outputPath}.tmp`;
await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporary, outputPath);
process.stdout.write(`${JSON.stringify({ outputPath, comparison }, null, 2)}\n`);
