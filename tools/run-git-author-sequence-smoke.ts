import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildExternalCommonSequenceProbe } from "../packages/layout/src/index.ts";
import { runExternalCommonSequenceProbe } from "../packages/cli/src/externalControlledSequence.ts";
import {
  GIT_AUTHOR_SEQUENCE_IMPLEMENTATION,
  gitAuthorCsvInputs,
  prepareGitAuthorJavaClasses,
} from "../packages/cli/src/gitAuthorExternalAdapter.ts";

const upstreamRoot = process.argv[2];
if (!upstreamRoot)
  throw new Error("usage: run-git-author-sequence-smoke.ts <upstream-root> [java-home] [xvfb-run]");
const javaHome = process.argv[3] ?? "";
const xvfbRun = process.argv[4] ?? "";
const outputPath = process.argv[5] ?? "";

const probe = buildExternalCommonSequenceProbe({
  nodes: [
    { id: "src/core", weight: 12 },
    { id: "src/layout", weight: 9 },
    { id: "src/schema", weight: 6 },
    { id: "src/cli", weight: 3 },
  ],
  edges: [
    { source: "src/cli", target: "src/schema" },
    { source: "src/layout", target: "src/core" },
  ],
});

const preparedRoot = mkdtempSync(join(tmpdir(), "sprawlens-git-author-prepared-"));
const classesRoot = join(preparedRoot, "classes");
const preparationStarted = performance.now();
await prepareGitAuthorJavaClasses({
  upstreamRoot,
  classesRoot,
  ...(javaHome ? { javacBin: `${javaHome}/bin/javac` } : {}),
});
const preparationTimeMs = performance.now() - preparationStarted;
let result: Awaited<ReturnType<typeof runExternalCommonSequenceProbe>>;
try {
  const command = [
    process.execPath,
    "--import",
    "tsx",
    resolve("tools/git-author-adapter.ts"),
    upstreamRoot,
    javaHome,
    classesRoot,
    xvfbRun,
  ] as const;
  result = await runExternalCommonSequenceProbe(command, probe, {
    seed: 42,
    timeoutMs: 120_000,
    expectedImplementation: GIT_AUTHOR_SEQUENCE_IMPLEMENTATION,
    validityThresholds: {
      maxRelativeAreaError: 1e-8,
      maxAreaCoverageError: 1e-8,
      maxBoundaryGapAreaRatio: 1e-8,
      maxOverlapAreaRatio: 1e-8,
      maxOutsideBoundaryAreaRatio: 1e-8,
      requireNativeConverged: true,
    },
  });
} finally {
  rmSync(preparedRoot, { recursive: true, force: true });
}

const summary = {
  schemaVersion: result.schemaVersion,
  seed: result.seed,
  preparationTimeMs,
  implementation: GIT_AUTHOR_SEQUENCE_IMPLEMENTATION,
  pathStatus: Object.fromEntries(
    Object.entries(result.paths).map(([name, path]) => [name, path.status]),
  ),
  failures: result.failures,
  metadataConsistent: result.metadataConsistent,
  artifactHashes: Object.fromEntries(
    Object.entries(result.paths).map(([name, path]) => {
      const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
      return [
        name,
        {
          requestSha256: sha256(JSON.stringify(path.request)),
          authorInputSha256: sha256(
            gitAuthorCsvInputs(path.request)
              .map(({ name: fileName, contents }) => `${fileName}\0${contents}`)
              .join("\0"),
          ),
          ...(path.status === "ok"
            ? { normalizedResponseSha256: sha256(JSON.stringify(path.response)) }
            : {}),
        },
      ];
    }),
  ),
  hostValidity: Object.fromEntries(
    Object.entries(result.paths).flatMap(([name, path]) =>
      path.status === "ok"
        ? [
            [
              name,
              {
                hostValid: path.hostValid,
                maxRelativeAreaError: Math.max(
                  ...path.evaluation.runs.map((run) => run.maxAreaError),
                ),
                maxAreaCoverageError: Math.max(
                  ...path.evaluation.runs.map((run) => run.validity.areaCoverageError),
                ),
                maxBoundaryGapAreaRatio: Math.max(
                  ...path.evaluation.runs.map(
                    (run) => run.validity.boundaryGapAreaRatio ?? Number.POSITIVE_INFINITY,
                  ),
                ),
                maxOverlapAreaRatio: Math.max(
                  ...path.evaluation.runs.map((run) => run.validity.overlapAreaRatio),
                ),
                maxOutsideBoundaryAreaRatio: Math.max(
                  ...path.evaluation.runs.map((run) => run.validity.outsideBoundaryAreaRatio),
                ),
              },
            ],
          ]
        : [],
    ),
  ),
  expectedSupport: Object.fromEntries(
    Object.entries(result.paths).map(([name, path]) => [name, path.expectedSupport]),
  ),
  calibration: result.calibration,
  confirmatoryEffect: result.confirmatoryEffect,
  runEligibilityGatesApplied: result.runEligibilityGatesApplied,
};

const output = `${JSON.stringify(process.argv.includes("--full") ? result : summary, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(resolve(outputPath), output, "utf8");
}
process.stdout.write(output);
