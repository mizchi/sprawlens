import { representationReliabilityMetricContractV1 } from "@sprawlens/contracts";
import type { LayoutSequenceGraph } from "./sequenceBenchmark.ts";

export const CONTROLLED_INPUT_ENDPOINT_CONTRACT =
  representationReliabilityMetricContractV1.inputEndpoint;

const finiteNumberToken = (value: number, field: string) => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`controlled endpoint ${field} must be finite`);
  }
  return Object.is(value, -0) ? "-0" : String(value);
};

/**
 * Collision-free serialization for the current LayoutSequenceGraph contract.
 * Array order is preserved intentionally because request order can influence
 * a stateful layout even when the unordered node and edge sets are equal.
 */
export function controlledInputEndpointSignature(graph: LayoutSequenceGraph): string {
  return JSON.stringify({
    nodes: graph.nodes.map((node, index) => [
      node.id,
      finiteNumberToken(node.weight, `node[${index}].weight`),
      node.hint
        ? [
            finiteNumberToken(node.hint.x, `node[${index}].hint.x`),
            finiteNumberToken(node.hint.y, `node[${index}].hint.y`),
          ]
        : null,
    ]),
    edges: graph.edges.map((edge) => [edge.source, edge.target]),
  });
}

export function requireControlledInputEndpointEqual(
  label: string,
  left: LayoutSequenceGraph,
  right: LayoutSequenceGraph,
): void {
  if (controlledInputEndpointSignature(left) !== controlledInputEndpointSignature(right)) {
    throw new RangeError(`${label} endpoint mismatch`);
  }
}
