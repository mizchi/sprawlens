import { resolve } from "node:path";
import { buildExternalCommonSequenceProbe } from "../packages/layout/src/index.ts";
import { runExternalCommonSequenceProbe } from "../packages/cli/src/externalControlledSequence.ts";
import { STABLE_VT_SEQUENCE_IMPLEMENTATION } from "../packages/cli/src/stableVoronoiExternalAdapter.ts";

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

const result = await runExternalCommonSequenceProbe(
  [process.execPath, "--import", "tsx", resolve("tools/stable-vt-adapter.ts")],
  probe,
  {
    seed: 7,
    timeoutMs: 120_000,
    expectedImplementation: STABLE_VT_SEQUENCE_IMPLEMENTATION,
    validityThresholds: {
      maxRelativeAreaError: 0.01,
      maxAreaCoverageError: 1e-8,
      maxOverlapAreaRatio: 1e-8,
      maxOutsideBoundaryAreaRatio: 1e-8,
      requireNativeConverged: true,
    },
  },
);

const summary = {
  schemaVersion: result.schemaVersion,
  seed: result.seed,
  pathStatus: Object.fromEntries(
    Object.entries(result.paths).map(([name, path]) => [name, path.status]),
  ),
  failures: result.failures,
  metadataConsistent: result.metadataConsistent,
  hostValidity: Object.fromEntries(
    Object.entries(result.paths).flatMap(([name, path]) =>
      path.status === "ok"
        ? [
            [
              name,
              {
                allNativeConverged: path.evaluation.runs.every((run) => run.nativeConverged),
                maxDegenerateCellCount: Math.max(
                  ...path.evaluation.runs.map((run) => run.validity.degenerateCellCount),
                ),
                maxNonConvexCellCount: Math.max(
                  ...path.evaluation.runs.map((run) => run.validity.nonConvexCellCount),
                ),
                maxAreaCoverageError: Math.max(
                  ...path.evaluation.runs.map((run) => run.validity.areaCoverageError),
                ),
                maxOverlapAreaRatio: Math.max(
                  ...path.evaluation.runs.map((run) => run.validity.overlapAreaRatio),
                ),
                maxOutsideBoundaryAreaRatio: Math.max(
                  ...path.evaluation.runs.map((run) => run.validity.outsideBoundaryAreaRatio),
                ),
                maxRelativeAreaError: Math.max(
                  ...path.evaluation.runs.map((run) => run.maxAreaError),
                ),
              },
            ],
          ]
        : [],
    ),
  ),
  calibration: result.calibration,
  runEligibilityGatesApplied: result.runEligibilityGatesApplied,
};

process.stdout.write(
  `${JSON.stringify(process.argv.includes("--full") ? result : summary, null, 2)}\n`,
);
