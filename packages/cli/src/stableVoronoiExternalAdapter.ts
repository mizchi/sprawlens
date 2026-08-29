import { solveStableVoronoi } from "@sprawlens/layout";
import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
  ExternalLayoutGraphV1,
  ExternalLayoutImplementationV1,
  ExternalLayoutSequenceImplementationV2,
  ExternalLayoutSequenceRequestV2,
  ExternalLayoutSequenceResponseV2,
} from "@sprawlens/schema";

const PARAMETERS = {
  hilbertVariant: "thesis-algorithm-8-variable-order",
  curveOrders: "1-extended,2,3,8",
  fractionUpdate: "forward-normalized-position",
  algorithm6Implemented: true,
  algorithm8Implemented: true,
  algorithm9Implemented: false,
  authorAwpSweepLine: false,
  powerSolver: "sprawlens-capacity-power-diagram",
  maxIterations: 5_000,
  tolerance: 0.01,
  paperDoi: "10.1016/j.infsof.2016.10.003",
} as const;

const IMPLEMENTATION = {
  id: "stable-vt-algorithm8-power-reimplementation",
  revision: "stable-vt-reimplementation-v2",
  sourceUrl: "https://github.com/mizchi/sprawlens",
  license: "MIT",
  adapterRevision: "2",
  parameters: PARAMETERS,
} satisfies ExternalLayoutImplementationV1;

export const STABLE_VT_SEQUENCE_IMPLEMENTATION = {
  ...IMPLEMENTATION,
  adapterRevision: "3",
  temporalAccess: "current-only",
  stateModel: "stateless",
  capabilities: {
    initializationModes: ["native"],
    nodeCount: { min: 2, max: 80 },
    boundary: "convex-polygon",
    cellGeometry: "convex-polygons",
    siteSemantics: "native",
    dependencySemantics: "ignored",
    deterministicForFixedSeed: true,
  },
} satisfies ExternalLayoutSequenceImplementationV2;

function unsupported(
  requestId: string,
  code: string,
  message: string,
): ExternalLayoutBaselineResponseV1 {
  return {
    schemaVersion: 1,
    requestId,
    status: "unsupported",
    implementation: IMPLEMENTATION,
    reason: { code, message },
  };
}

function supportedGraph(graph: ExternalLayoutGraphV1): boolean {
  return graph.nodes.length >= 2 && graph.nodes.length <= 80;
}

function runGraph(
  graph: ExternalLayoutGraphV1,
  request: Pick<ExternalLayoutBaselineRequestV1, "boundary" | "seed">,
) {
  const solved = solveStableVoronoi(
    graph.nodes,
    { kind: "polygon", ring: request.boundary },
    {
      seed: request.seed,
      hilbertVariant: "algorithm-8-variable",
      maxIterations: PARAMETERS.maxIterations,
      tolerance: PARAMETERS.tolerance,
    },
  );
  return {
    cells: solved.state.cells.map((cell) => ({
      id: cell.id,
      site: cell.site,
      polygon: cell.polygon,
    })),
    steps: solved.state.iteration,
    converged: solved.converged,
  };
}

function unsupportedSequence(
  requestId: string,
  code: string,
  message: string,
): ExternalLayoutSequenceResponseV2 {
  return {
    schemaVersion: 2,
    requestId,
    status: "unsupported",
    implementation: STABLE_VT_SEQUENCE_IMPLEMENTATION,
    reason: { code, message },
  };
}

/** Run the variable Algorithm-8 Hilbert baseline over the common process contract. */
export function runStableVoronoiAdapterRequest(
  request: ExternalLayoutBaselineRequestV1,
): ExternalLayoutBaselineResponseV1 {
  if (request.schemaVersion !== 1) {
    return unsupported(request.requestId, "schema-version", "only schemaVersion 1 is supported");
  }
  if (!supportedGraph(request.before) || !supportedGraph(request.after)) {
    return unsupported(request.requestId, "node-count", "before and after require 2 to 80 nodes");
  }
  if (request.boundary.length < 3) {
    return unsupported(request.requestId, "boundary", "a convex boundary is required");
  }
  if (
    request.semantics.nodeWeight !== "loc" ||
    request.semantics.dependencyEdges !== "undirected-constraints"
  ) {
    return unsupported(
      request.requestId,
      "semantics",
      "the shared LOC/constraint semantics are required",
    );
  }
  return {
    schemaVersion: 1,
    requestId: request.requestId,
    status: "ok",
    implementation: IMPLEMENTATION,
    before: runGraph(request.before, request),
    after: runGraph(request.after, request),
  };
}

/**
 * Run each snapshot from native initialization. This is an intentionally
 * history-free comparison condition, not a native dynamic-layout baseline.
 */
export function runStableVoronoiSequenceAdapterRequest(
  request: ExternalLayoutSequenceRequestV2,
): ExternalLayoutSequenceResponseV2 {
  if (request.schemaVersion !== 2) {
    return unsupportedSequence(
      request.requestId,
      "schema-version",
      "only schemaVersion 2 is supported",
    );
  }
  if (!request.snapshots.every(({ graph }) => supportedGraph(graph))) {
    return unsupportedSequence(
      request.requestId,
      "node-count",
      "every snapshot requires 2 to 80 nodes",
    );
  }
  if (request.boundary.length < 3) {
    return unsupportedSequence(request.requestId, "boundary", "a convex boundary is required");
  }
  if (
    request.semantics.nodeWeight !== "loc" ||
    request.semantics.dependencyEdges !== "undirected-constraints"
  ) {
    return unsupportedSequence(
      request.requestId,
      "semantics",
      "the shared LOC/constraint input semantics are required",
    );
  }
  if (request.initialization.mode !== "native") {
    return unsupportedSequence(
      request.requestId,
      "initialization",
      "this adapter supports native initialization only",
    );
  }
  if (
    request.identitySemantics !== "path-stable-id" ||
    request.nodeOrderSemantics !== "request-order" ||
    request.lifecycle.resetBeforeRequest !== true ||
    request.lifecycle.hostDoesNotResetWithinRequest !== true ||
    request.lifecycle.rngReset !== "request-seed"
  ) {
    return unsupportedSequence(
      request.requestId,
      "lifecycle",
      "the v2 identity, order, and lifecycle contract is required",
    );
  }
  return {
    schemaVersion: 2,
    requestId: request.requestId,
    status: "ok",
    implementation: STABLE_VT_SEQUENCE_IMPLEMENTATION,
    runs: request.snapshots.map(({ snapshotId, graph }) => {
      const run = runGraph(graph, request);
      return {
        snapshotId,
        cells: run.cells,
        work: { nativeIterations: run.steps },
        nativeConverged: run.converged,
      };
    }),
  };
}
