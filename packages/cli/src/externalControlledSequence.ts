import {
  centroid,
  compareLayoutGeometry,
  assessExternalLayoutSequenceSupport,
  canProduceExternalSequenceEffect,
  evaluateExternalLayoutSequenceResponse,
  classifyExternalSequenceResponse,
  type ComparableCell,
  type ExternalCommonSequenceProbe,
} from "@sprawlens/layout";
import type {
  ExternalLayoutSequenceImplementationV2,
  ExternalLayoutSequenceRequestV2,
  ExternalLayoutSequenceResponseV2,
} from "@sprawlens/schema";
import {
  createExternalLayoutSequenceRequest,
  runExternalLayoutSequenceBaseline,
  type ExternalBaselineProcessOptions,
} from "./externalLayoutBaseline.ts";

const PATH_NAMES = [
  "noOp",
  "weight",
  "leafInsertion",
  "combined",
  "orderAB",
  "orderBA",
  "orderABDuplicate",
] as const;
type PathName = (typeof PATH_NAMES)[number];

const METRICS = [
  "representativePointDisplacement",
  "centroidDisplacement",
  "boundaryDisplacement",
  "polygonIoULoss",
  "relativeDirectionChange",
] as const;
type Metric = (typeof METRICS)[number];
type GeometryMetrics = Record<Metric, number>;
type ExpectedSupport = ReturnType<typeof assessExternalLayoutSequenceSupport> | null;

const asComparable = (
  run: Extract<ExternalLayoutSequenceResponseV2, { status: "ok" }>["runs"][number],
): ComparableCell[] =>
  run.cells.map((cell) => ({
    id: cell.id,
    site: cell.site ?? centroid(cell.polygon),
    polygon: cell.polygon,
  }));

const compare = (
  before: Extract<ExternalLayoutSequenceResponseV2, { status: "ok" }>["runs"][number],
  after: Extract<ExternalLayoutSequenceResponseV2, { status: "ok" }>["runs"][number],
): GeometryMetrics => {
  const beforeCells = asComparable(before);
  const afterCells = asComparable(after);
  const beforeSites = new Map(beforeCells.map((cell) => [cell.id, cell.site] as const));
  const distances = afterCells.flatMap((cell) => {
    const site = beforeSites.get(cell.id);
    return site ? [Math.hypot(cell.site.x - site.x, cell.site.y - site.y)] : [];
  });
  return {
    representativePointDisplacement:
      distances.reduce((sum, distance) => sum + distance, 0) / Math.max(1, distances.length),
    ...compareLayoutGeometry(beforeCells, afterCells, 1),
  };
};

const subtract = (value: GeometryMetrics, floor: GeometryMetrics): GeometryMetrics =>
  Object.fromEntries(
    METRICS.map((metric) => [metric, value[metric] - floor[metric]]),
  ) as GeometryMetrics;

type SuccessfulPath = {
  status: "ok";
  request: ExternalLayoutSequenceRequestV2;
  response: Extract<ExternalLayoutSequenceResponseV2, { status: "ok" }>;
  evaluation: Extract<ReturnType<typeof evaluateExternalLayoutSequenceResponse>, { status: "ok" }>;
  wallTimeMs: number;
  hostValid: boolean | null;
  hostValidityFailures: string[];
  implementationMatchesExpected: boolean | null;
  expectedSupport: ExpectedSupport;
};

type PathResult =
  | SuccessfulPath
  | {
      status: "unsupported" | "failed";
      request: ExternalLayoutSequenceRequestV2;
      reason: { code: string; message: string };
      implementation: ExternalLayoutSequenceImplementationV2;
      wallTimeMs: number;
      implementationMatchesExpected: boolean | null;
      expectedSupport: ExpectedSupport;
    }
  | {
      status: "execution-failed";
      request: ExternalLayoutSequenceRequestV2;
      reason: { code: string; message: string };
      expectedSupport: ExpectedSupport;
    };

const successful = (path: PathResult): path is SuccessfulPath => path.status === "ok";

export type ExternalSequenceValidityThresholds = {
  maxRelativeAreaError: number;
  maxAreaCoverageError: number;
  maxBoundaryGapAreaRatio: number;
  maxOverlapAreaRatio: number;
  maxOutsideBoundaryAreaRatio: number;
  requireNativeConverged: boolean;
};

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const input = value as Record<string, unknown>;
    return `{${Object.keys(input)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(input[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const assessHostValidity = (
  evaluation: SuccessfulPath["evaluation"],
  thresholds: ExternalSequenceValidityThresholds,
) => {
  const boundaryFailures: string[] = [];
  const boundary = evaluation.boundaryValidity;
  if (!boundary.finite) boundaryFailures.push("boundary:non-finite");
  if (!boundary.hasMinimumVertices) boundaryFailures.push("boundary:too-few-vertices");
  if (!boundary.counterClockwise) boundaryFailures.push("boundary:orientation");
  if (boundary.degenerate) boundaryFailures.push("boundary:degenerate");
  if (boundary.nonConvex) boundaryFailures.push("boundary:non-convex");
  if (boundary.duplicateVertex) boundaryFailures.push("boundary:duplicate-vertex");
  if (boundary.zeroLengthEdge) boundaryFailures.push("boundary:zero-length-edge");
  if (boundary.selfIntersecting) boundaryFailures.push("boundary:self-intersection");
  return boundaryFailures.concat(
    evaluation.runs.flatMap((run) => {
      const failures: string[] = [];
      if (run.validity.degenerateCellCount > 0) failures.push("degenerate-cells");
      if (run.validity.nonConvexCellCount > 0) failures.push("non-convex-cells");
      if (run.validity.selfIntersectingCellCount > 0) failures.push("self-intersecting-cells");
      if (run.validity.duplicateVertexCellCount > 0) failures.push("duplicate-vertices");
      if (run.validity.zeroLengthEdgeCellCount > 0) failures.push("zero-length-edges");
      if (run.validity.nativeSiteMissingCount > 0) failures.push("missing-native-sites");
      if (run.validity.nativeSiteOutsideCellCount > 0) failures.push("native-sites-outside-cells");
      if (run.validity.areaCoverageError > thresholds.maxAreaCoverageError) {
        failures.push("area-coverage");
      }
      if (run.validity.overlapAreaRatio > thresholds.maxOverlapAreaRatio) failures.push("overlap");
      if (
        run.validity.boundaryGapAreaRatio === null ||
        run.validity.boundaryGapAreaRatio > thresholds.maxBoundaryGapAreaRatio
      ) {
        failures.push("boundary-gap");
      }
      if (run.validity.outsideBoundaryAreaRatio > thresholds.maxOutsideBoundaryAreaRatio) {
        failures.push("outside-boundary");
      }
      if (run.maxAreaError > thresholds.maxRelativeAreaError) failures.push("relative-area");
      if (thresholds.requireNativeConverged && !run.nativeConverged) {
        failures.push("native-non-convergence");
      }
      return failures.map((failure) => `${run.snapshotId}:${failure}`);
    }),
  );
};

/**
 * Run each controlled path as a separate process. This makes the path reset a
 * host-enforced property instead of trusting an adapter's hidden global state.
 */
export async function runExternalCommonSequenceProbe(
  command: readonly [string, ...string[]],
  probe: ExternalCommonSequenceProbe,
  options: ExternalBaselineProcessOptions & {
    seed: number;
    validityThresholds?: ExternalSequenceValidityThresholds;
    expectedImplementation?: ExternalLayoutSequenceImplementationV2;
  },
) {
  const graphsByPath = {
    noOp: probe.noOp,
    weight: probe.weightReversal,
    leafInsertion: probe.leafInsertionReversal,
    combined: probe.combinedReversal,
    orderAB: probe.orderAB,
    orderBA: probe.orderBA,
    orderABDuplicate: probe.orderAB,
  } satisfies Record<PathName, ExternalCommonSequenceProbe[keyof ExternalCommonSequenceProbe]>;
  const paths = {} as Record<PathName, PathResult>;
  for (const name of PATH_NAMES) {
    const request = createExternalLayoutSequenceRequest(
      `external-common-${name}`,
      graphsByPath[name],
      options.seed,
    );
    const expectedSupport = options.expectedImplementation
      ? assessExternalLayoutSequenceSupport(request, options.expectedImplementation)
      : null;
    const execution = await runExternalLayoutSequenceBaseline(command, request, options);
    if (execution.status === "failed") {
      paths[name] = {
        status: "execution-failed",
        request,
        reason: execution.failure,
        expectedSupport,
      };
      continue;
    }
    const implementationMatchesExpected = options.expectedImplementation
      ? canonicalJson(execution.response.implementation) ===
        canonicalJson(options.expectedImplementation)
      : null;
    if (execution.response.status !== "ok") {
      paths[name] = {
        status: execution.response.status,
        request,
        reason: execution.response.reason,
        implementation: execution.response.implementation,
        wallTimeMs: execution.wallTimeMs,
        implementationMatchesExpected,
        expectedSupport,
      };
      continue;
    }
    const evaluation = evaluateExternalLayoutSequenceResponse(execution.response, request);
    if (evaluation.status !== "ok") throw new Error("successful response produced no evaluation");
    const hostValidityFailures = options.validityThresholds
      ? assessHostValidity(evaluation, options.validityThresholds)
      : [];
    paths[name] = {
      status: "ok",
      request,
      response: execution.response,
      evaluation,
      wallTimeMs: execution.wallTimeMs,
      hostValid: options.validityThresholds ? hostValidityFailures.length === 0 : null,
      hostValidityFailures,
      implementationMatchesExpected,
      expectedSupport,
    };
  }
  const failures: Array<{
    path: PathName;
    status:
      | "unsupported"
      | "failed"
      | "execution-failed"
      | "host-invalid"
      | "implementation-mismatch"
      | "unexpected-unsupported"
      | "capability-violation";
    reason: { code: string; message: string };
  }> = [];
  for (const name of PATH_NAMES) {
    const path = paths[name];
    if (!successful(path)) {
      if (path.status === "execution-failed") {
        failures.push({ path: name, status: path.status, reason: path.reason });
        continue;
      }
      if (path.implementationMatchesExpected === false) {
        failures.push({
          path: name,
          status: "implementation-mismatch",
          reason: { code: "implementation", message: "implementation does not match manifest" },
        });
        continue;
      }
      const supportClass = classifyExternalSequenceResponse(
        path.status,
        path.expectedSupport?.expectedSupported ?? null,
      );
      if (supportClass === "expected-missingness") {
        continue;
      }
      failures.push({
        path: name,
        status: supportClass === "unexpected-unsupported" ? "unexpected-unsupported" : path.status,
        reason: path.reason,
      });
      continue;
    }
    if (
      classifyExternalSequenceResponse(
        path.status,
        path.expectedSupport?.expectedSupported ?? null,
      ) === "capability-violation"
    ) {
      failures.push({
        path: name,
        status: "capability-violation",
        reason: {
          code: "capability-manifest",
          message:
            path.expectedSupport?.reasons.map(({ message }) => message).join("; ") ??
            "request is outside the capability manifest",
        },
      });
      continue;
    }
    if (path.hostValid === false) {
      failures.push({
        path: name,
        status: "host-invalid",
        reason: { code: "host-validity", message: path.hostValidityFailures.join(", ") },
      });
      continue;
    }
    if (path.implementationMatchesExpected === false) {
      failures.push({
        path: name,
        status: "implementation-mismatch",
        reason: { code: "implementation", message: "implementation does not match manifest" },
      });
    }
  }
  const metadata = PATH_NAMES.flatMap((name) =>
    paths[name].status === "execution-failed"
      ? []
      : [
          canonicalJson(
            paths[name].status === "ok"
              ? paths[name].response.implementation
              : paths[name].implementation,
          ),
        ],
  );
  const allSuccessful = PATH_NAMES.every((name) => successful(paths[name]));
  const allEligible = allSuccessful && failures.length === 0;
  const runEligibilityGatesApplied = Boolean(
    options.validityThresholds && options.expectedImplementation,
  );
  let calibration: null | {
    noOp: GeometryMetrics;
    reversalExcess: Record<"weight" | "leafInsertion" | "combined", GeometryMetrics>;
    orderABvsBA: GeometryMetrics;
    duplicateABNoise: GeometryMetrics;
  } = null;
  if (allEligible) {
    const okPaths = paths as Record<PathName, SuccessfulPath>;
    const recovery = (name: "noOp" | "weight" | "leafInsertion" | "combined") => {
      const runs = okPaths[name].response.runs;
      return compare(runs[0]!, runs.at(-1)!);
    };
    const noOp = recovery("noOp");
    calibration = {
      noOp,
      reversalExcess: {
        weight: subtract(recovery("weight"), noOp),
        leafInsertion: subtract(recovery("leafInsertion"), noOp),
        combined: subtract(recovery("combined"), noOp),
      },
      orderABvsBA: compare(
        okPaths.orderAB.response.runs.at(-1)!,
        okPaths.orderBA.response.runs.at(-1)!,
      ),
      duplicateABNoise: compare(
        okPaths.orderAB.response.runs.at(-1)!,
        okPaths.orderABDuplicate.response.runs.at(-1)!,
      ),
    };
  }
  const confirmatoryEffectEligible =
    runEligibilityGatesApplied &&
    canProduceExternalSequenceEffect(
      PATH_NAMES.map((name) => {
        const path = paths[name];
        return {
          responseOk: successful(path),
          hostValid: successful(path) && path.hostValid === true,
          expectedSupported: path.expectedSupport?.expectedSupported === true,
          metadataMatches:
            "implementationMatchesExpected" in path && path.implementationMatchesExpected === true,
        };
      }),
    );
  return {
    schemaVersion: 1 as const,
    seed: options.seed,
    paths,
    failures,
    metadataConsistent: new Set(metadata).size <= 1,
    runEligibilityGatesApplied,
    calibration,
    confirmatoryEffect: confirmatoryEffectEligible ? calibration : null,
  };
}
