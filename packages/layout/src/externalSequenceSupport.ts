import type {
  ExternalLayoutSequenceImplementationV2,
  ExternalLayoutSequenceRequestV2,
} from "@sprawlens/contracts";
import { assessRingValidity, isAxisAlignedRectangle } from "./externalPolygonValidity.ts";

export type ExternalSequenceSupportReason = {
  code:
    | "invalid-boundary"
    | "invalid-graph"
    | "boundary-capability"
    | "initialization-mode"
    | "node-count";
  message: string;
};

/** Decide expected support solely from a request and the frozen capability manifest. */
export function assessExternalLayoutSequenceSupport(
  request: ExternalLayoutSequenceRequestV2,
  implementation: ExternalLayoutSequenceImplementationV2,
): { expectedSupported: boolean; reasons: ExternalSequenceSupportReason[] } {
  const reasons: ExternalSequenceSupportReason[] = [];
  const boundary = assessRingValidity(request.boundary);
  if (
    !boundary.finite ||
    !boundary.hasMinimumVertices ||
    !boundary.counterClockwise ||
    boundary.degenerate ||
    boundary.nonConvex ||
    boundary.duplicateVertex ||
    boundary.zeroLengthEdge ||
    boundary.selfIntersecting
  ) {
    reasons.push({
      code: "invalid-boundary",
      message: "boundary must be a simple CCW convex ring",
    });
  } else if (
    implementation.capabilities.boundary === "axis-aligned-rectangle" &&
    !isAxisAlignedRectangle(request.boundary)
  ) {
    reasons.push({
      code: "boundary-capability",
      message: "implementation supports only an axis-aligned rectangle",
    });
  }
  if (!implementation.capabilities.initializationModes.includes(request.initialization.mode)) {
    reasons.push({
      code: "initialization-mode",
      message: `initialization mode ${request.initialization.mode} is outside the manifest`,
    });
  }
  for (const snapshot of request.snapshots) {
    const nodeIds = snapshot.graph.nodes.map(({ id }) => id);
    const nodeIdSet = new Set(nodeIds);
    const invalidWeight = snapshot.graph.nodes.some(
      ({ weight }) => !Number.isFinite(weight) || weight <= 0,
    );
    const invalidEdge = snapshot.graph.edges.some(
      ({ source, target, weight }) =>
        source === target ||
        !nodeIdSet.has(source) ||
        !nodeIdSet.has(target) ||
        (weight !== undefined && (!Number.isFinite(weight) || weight <= 0)),
    );
    const undirectedEdges = snapshot.graph.edges.map(({ source, target }) =>
      source < target ? `${source}\0${target}` : `${target}\0${source}`,
    );
    if (
      nodeIdSet.size !== nodeIds.length ||
      invalidWeight ||
      invalidEdge ||
      new Set(undirectedEdges).size !== undirectedEdges.length
    ) {
      reasons.push({
        code: "invalid-graph",
        message: `${snapshot.snapshotId} violates positive-weight, unique-id, or simple-edge invariants`,
      });
    }
    const count = snapshot.graph.nodes.length;
    const { min, max } = implementation.capabilities.nodeCount;
    if (count < min || count > max) {
      reasons.push({
        code: "node-count",
        message: `${snapshot.snapshotId} has ${count} nodes; manifest range is ${min}..${max}`,
      });
    }
  }
  return { expectedSupported: reasons.length === 0, reasons };
}
