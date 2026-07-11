import { solveStableVoronoi } from "@sprawlens/layout";
import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutBaselineResponseV1,
  ExternalLayoutGraphV1,
  ExternalLayoutImplementationV1,
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

function runGraph(graph: ExternalLayoutGraphV1, request: ExternalLayoutBaselineRequestV1) {
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
