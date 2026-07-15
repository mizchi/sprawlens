import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import type { AstDiffScalingMeasurement } from "../packages/viz/src/astDiffScalingBenchmark.ts";

const exec = promisify(execFile);

describe("AST diff scaling worker", () => {
  it("isolates projection conditions and produces matching output digests", async () => {
    const indexed = await runWorker([
      "--kernel",
      "hunk-projection",
      "--condition",
      "indexed",
      "--symbols",
      "100",
      "--hunks",
      "20",
    ]);
    const naive = await runWorker([
      "--kernel",
      "hunk-projection",
      "--condition",
      "naive",
      "--symbols",
      "100",
      "--hunks",
      "20",
    ]);
    const adaptive = await runWorker([
      "--kernel",
      "hunk-projection",
      "--condition",
      "adaptive",
      "--symbols",
      "100",
      "--hunks",
      "20",
    ]);

    expect(indexed).toMatchObject({
      kernel: "hunk-projection",
      condition: "indexed",
      symbolCount: 100,
      hunkCount: 20,
      batchIterations: 5,
      status: "ok",
    });
    expect(indexed.outputDigest).toBe(naive.outputDigest);
    expect(adaptive.outputDigest).toBe(naive.outputDigest);
    expect(indexed.outputItems).toBe(naive.outputItems);
    expect(indexed.durationMs).toBeGreaterThan(0);
    expect(indexed.maxRssKb).toBeGreaterThan(0);
  });

  it("measures parent-aware symbol-tree diff at the requested depth", async () => {
    expect(
      await runWorker([
        "--kernel",
        "symbol-tree",
        "--condition",
        "parent-aware",
        "--symbols",
        "100",
        "--depth",
        "8",
      ]),
    ).toMatchObject({
      kernel: "symbol-tree",
      condition: "parent-aware",
      symbolCount: 100,
      maxDepth: 8,
      status: "ok",
    });
  });
});

async function runWorker(args: string[]): Promise<AstDiffScalingMeasurement> {
  const { stdout } = await exec(
    "pnpm",
    [
      "exec",
      "tsx",
      "tools/ast-diff-scaling-worker.ts",
      ...args,
      "--seed",
      "1729",
      "--repetition",
      "1",
      "--warmups",
      "1",
      "--batch-iterations",
      "5",
    ],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 },
  );
  return JSON.parse(stdout) as AstDiffScalingMeasurement;
}
