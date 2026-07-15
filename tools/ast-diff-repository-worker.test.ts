import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AstDiffRepositoryMeasurement } from "../packages/viz/src/astDiffRepositoryBenchmark.ts";

const exec = promisify(execFile);
let directory: string;
let fixturePath: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "sprawlens-repository-worker-"));
  fixturePath = join(directory, "fixture.json");
  await writeFile(
    fixturePath,
    `${JSON.stringify({
      schemaVersion: 1,
      sourceDatasetId: "ast-diff-confirmatory-v1-phase1",
      status: "post-hoc development corpus; not confirmatory evidence",
      cases: [
        {
          id: "fixture-case",
          repository: "owner/repo",
          beforeRevision: "a".repeat(40),
          afterRevision: "b".repeat(40),
          files: [
            {
              changeStatus: "modified",
              beforePath: "src/a.ts",
              afterPath: "src/a.ts",
              before: [symbol(1, "old")],
              after: [symbol(2, "new")],
              hunks: [{ oldStart: 1, oldLines: 1, newStart: 2, newLines: 1 }],
            },
          ],
        },
      ],
    })}\n`,
  );
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("AST diff repository worker", () => {
  it("produces equivalent projection output in isolated conditions", async () => {
    const indexed = await runWorker("projection-indexed");
    const naive = await runWorker("projection-naive");

    expect(indexed).toMatchObject({
      caseId: "fixture-case",
      repository: "owner/repo",
      condition: "projection-indexed",
      batchIterations: 5,
      fileCount: 1,
      beforeSymbolCount: 1,
      afterSymbolCount: 1,
      hunkCount: 1,
      status: "ok",
    });
    expect(indexed.outputDigest).toBe(naive.outputDigest);
    expect(indexed.outputItems).toBe(naive.outputItems);
    expect(indexed.durationPerIterationMs).toBeGreaterThan(0);
  });

  it("measures the parent-aware condition with the same case contract", async () => {
    expect(await runWorker("parent-aware")).toMatchObject({
      caseId: "fixture-case",
      condition: "parent-aware",
      status: "ok",
      outputItems: 1,
    });
  });
});

async function runWorker(
  condition: AstDiffRepositoryMeasurement["condition"],
): Promise<AstDiffRepositoryMeasurement> {
  const { stdout } = await exec(
    "pnpm",
    [
      "exec",
      "tsx",
      "tools/ast-diff-repository-worker.ts",
      "--fixture",
      fixturePath,
      "--case",
      "fixture-case",
      "--condition",
      condition,
      "--repetition",
      "1",
      "--warmups",
      "1",
      "--iterations",
      "5",
    ],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 },
  );
  return JSON.parse(stdout) as AstDiffRepositoryMeasurement;
}

function symbol(line: number, fingerprint: string) {
  return {
    id: `symbol:src/a.ts:function:a:${line}`,
    name: "a",
    kind: "function",
    startLine: line,
    endLine: line,
    loc: 1,
    complexity: 1,
    fingerprint,
  };
}
