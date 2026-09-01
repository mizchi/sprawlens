import {
  controlledEndpointRelationContractV1,
  type ControlledEndpointRelationKind,
} from "@sprawlens/contracts";
import { controlledInputEndpointSignature } from "./controlledEndpoint.ts";
import type { LayoutSequenceGraph } from "./sequenceBenchmark.ts";

export const CONTROLLED_ENDPOINT_RELATION_CONTRACT = controlledEndpointRelationContractV1;

export type ControlledEndpointIdBijection = ReadonlyArray<readonly [string, string]>;

export type ControlledEndpointRelationResult = {
  relation: ControlledEndpointRelationKind;
  status: "equivalent" | "different" | "unsupported";
  reason: string;
};

type ApplicableOrderPermutation = {
  status: "applicable";
  graph: LayoutSequenceGraph;
};

type ApplicableRenamePermutation = ApplicableOrderPermutation & {
  idBijection: ControlledEndpointIdBijection;
};

type InapplicablePermutation = {
  status: "inapplicable";
  reason: string;
};

type UnsupportedPermutation = {
  status: "unsupported";
  reason: string;
};

export type ControlledEndpointPermutationVariant =
  | ApplicableOrderPermutation
  | ApplicableRenamePermutation
  | InapplicablePermutation
  | UnsupportedPermutation;

export type ControlledEndpointPermutationProbe = {
  nodeOrder: ApplicableOrderPermutation | InapplicablePermutation;
  edgeOrder: ApplicableOrderPermutation | InapplicablePermutation;
  stableIdRename: ApplicableRenamePermutation | InapplicablePermutation;
  hierarchySerialization: UnsupportedPermutation;
};

const lexicalCompare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const cloneGraph = (graph: LayoutSequenceGraph): LayoutSequenceGraph => ({
  nodes: graph.nodes.map((node) => ({
    ...node,
    hint: node.hint ? { ...node.hint } : undefined,
  })),
  edges: graph.edges.map((edge) => ({ ...edge })),
});

const validateLabeledGraphDomain = (graph: LayoutSequenceGraph, side: string): void => {
  controlledInputEndpointSignature(graph);
  const ids = new Set<string>();
  graph.nodes.forEach((node) => {
    if (ids.has(node.id)) {
      throw new RangeError(`${side} endpoint node IDs must be unique; duplicate ${node.id}`);
    }
    ids.add(node.id);
  });
  const directedEdges = new Set<string>();
  graph.edges.forEach((edge, index) => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      throw new RangeError(`${side} endpoint edge[${index}] must reference known node IDs`);
    }
    const edgeToken = JSON.stringify([edge.source, edge.target]);
    if (directedEdges.has(edgeToken)) {
      throw new RangeError(`${side} endpoint directed edges must be unique`);
    }
    directedEdges.add(edgeToken);
  });
};

/** Stable IDs and v1 fields remain significant; request order is erased. */
export function controlledLabeledGraphEndpointSignature(graph: LayoutSequenceGraph): string {
  validateLabeledGraphDomain(graph, "labeled graph");
  const canonical = cloneGraph(graph);
  canonical.nodes.sort((left, right) => lexicalCompare(left.id, right.id));
  canonical.edges.sort(
    (left, right) =>
      lexicalCompare(left.source, right.source) || lexicalCompare(left.target, right.target),
  );
  return controlledInputEndpointSignature(canonical);
}

const explicitRenameMap = (
  left: LayoutSequenceGraph,
  right: LayoutSequenceGraph,
  bijection: ControlledEndpointIdBijection,
): ReadonlyMap<string, string> => {
  validateLabeledGraphDomain(left, "left");
  validateLabeledGraphDomain(right, "right");
  const leftIds = new Set(left.nodes.map(({ id }) => id));
  const rightIds = new Set(right.nodes.map(({ id }) => id));
  const mapping = new Map<string, string>();
  const targets = new Set<string>();
  for (const [source, target] of bijection) {
    if (
      !leftIds.has(source) ||
      mapping.has(source) ||
      !rightIds.has(target) ||
      targets.has(target)
    ) {
      throw new RangeError("rename-equivalent requires an explicit total bijection");
    }
    mapping.set(source, target);
    targets.add(target);
  }
  if (
    mapping.size !== leftIds.size ||
    targets.size !== rightIds.size ||
    [...leftIds].some((id) => !mapping.has(id)) ||
    [...rightIds].some((id) => !targets.has(id))
  ) {
    throw new RangeError("rename-equivalent requires an explicit total bijection");
  }
  return mapping;
};

const renameGraph = (
  graph: LayoutSequenceGraph,
  mapping: ReadonlyMap<string, string>,
): LayoutSequenceGraph => ({
  nodes: graph.nodes.map((node) => ({
    ...node,
    id: mapping.get(node.id)!,
    hint: node.hint ? { ...node.hint } : undefined,
  })),
  edges: graph.edges.map((edge) => ({
    ...edge,
    source: mapping.get(edge.source)!,
    target: mapping.get(edge.target)!,
  })),
});

export function compareControlledInputEndpoints(
  relation: ControlledEndpointRelationKind,
  left: LayoutSequenceGraph,
  right: LayoutSequenceGraph,
  options: { idBijection?: ControlledEndpointIdBijection } = {},
): ControlledEndpointRelationResult {
  if (relation === "hierarchy-equivalent") {
    return {
      relation,
      status: "unsupported",
      reason: "LayoutSequenceGraph v1 does not represent hierarchy",
    };
  }
  if (relation === "isomorphic" && !options.idBijection) {
    return {
      relation,
      status: "unsupported",
      reason: "graph isomorphism requires a separately audited ID-bijection witness",
    };
  }

  let leftSignature: string;
  let rightSignature: string;
  if (relation === "serialized-equal") {
    leftSignature = controlledInputEndpointSignature(left);
    rightSignature = controlledInputEndpointSignature(right);
  } else if (relation === "labeled-graph-equal") {
    leftSignature = controlledLabeledGraphEndpointSignature(left);
    rightSignature = controlledLabeledGraphEndpointSignature(right);
  } else {
    if (!options.idBijection) {
      return {
        relation,
        status: "unsupported",
        reason: "rename equivalence requires an explicit left-to-right ID bijection",
      };
    }
    const mapping = explicitRenameMap(left, right, options.idBijection);
    leftSignature = controlledLabeledGraphEndpointSignature(renameGraph(left, mapping));
    rightSignature = controlledLabeledGraphEndpointSignature(right);
  }
  const equivalent = leftSignature === rightSignature;
  return {
    relation,
    status: equivalent ? "equivalent" : "different",
    reason: equivalent ? "relation contract satisfied" : "endpoint signatures differ",
  };
}

const renamedIds = (graph: LayoutSequenceGraph): ControlledEndpointIdBijection => {
  const existing = new Set(graph.nodes.map(({ id }) => id));
  let namespace = "sprawlens-endpoint-probe-id-";
  while ([...existing].some((id) => id.startsWith(namespace))) namespace = `_${namespace}`;
  return [...existing]
    .sort(lexicalCompare)
    .map((id, index) => [id, `${namespace}${index}`] as const);
};

/** Deterministic probes retain inapplicable/unsupported cases in the denominator. */
export function buildControlledEndpointPermutationProbe(
  graph: LayoutSequenceGraph,
): ControlledEndpointPermutationProbe {
  validateLabeledGraphDomain(graph, "probe");
  const nodeOrderGraph = cloneGraph(graph);
  nodeOrderGraph.nodes.reverse();
  const edgeOrderGraph = cloneGraph(graph);
  edgeOrderGraph.edges.reverse();
  const nodeOrder =
    graph.nodes.length < 2
      ? ({ status: "inapplicable", reason: "node-order probe requires two nodes" } as const)
      : ({ status: "applicable", graph: nodeOrderGraph } as const);
  const edgeOrder =
    graph.edges.length < 2
      ? ({ status: "inapplicable", reason: "edge-order probe requires two edges" } as const)
      : ({ status: "applicable", graph: edgeOrderGraph } as const);
  const idBijection = renamedIds(graph);
  const stableIdRename =
    graph.nodes.length === 0
      ? ({ status: "inapplicable", reason: "rename probe requires one node" } as const)
      : ({
          status: "applicable",
          graph: renameGraph(graph, new Map(idBijection)),
          idBijection,
        } as const);
  return {
    nodeOrder,
    edgeOrder,
    stableIdRename,
    hierarchySerialization: {
      status: "unsupported",
      reason: "LayoutSequenceGraph v1 does not represent hierarchy",
    },
  };
}
