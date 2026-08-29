export type ExternalLayoutPointV1 = { x: number; y: number };

export type ExternalLayoutGraphV1 = {
  nodes: Array<{ id: string; weight: number }>;
  /** Directed dependencies. Adapters treat endpoint pairs as undirected constraints. */
  edges: Array<{ source: string; target: string; weight?: number }>;
};

export type ExternalLayoutBaselineRequestV1 = {
  schemaVersion: 1;
  requestId: string;
  caseName: string;
  seed: number;
  /** Convex normalized boundary shared by every implementation. */
  boundary: ExternalLayoutPointV1[];
  before: ExternalLayoutGraphV1;
  after: ExternalLayoutGraphV1;
  semantics: {
    nodeWeight: "loc";
    dependencyEdges: "undirected-constraints";
  };
};

export type ExternalLayoutImplementationV1 = {
  id: string;
  revision: string;
  sourceUrl: string;
  license: string;
  adapterRevision: string;
  parameters: Record<string, string | number | boolean>;
};

export type ExternalLayoutCellV1 = {
  id: string;
  site: ExternalLayoutPointV1;
  polygon: ExternalLayoutPointV1[];
};

export type ExternalLayoutRunV1 = {
  cells: ExternalLayoutCellV1[];
  steps: number;
  converged: boolean;
};

export type ExternalLayoutBaselineResponseV1 =
  | {
      schemaVersion: 1;
      requestId: string;
      status: "ok";
      implementation: ExternalLayoutImplementationV1;
      before: ExternalLayoutRunV1;
      after: ExternalLayoutRunV1;
    }
  | {
      schemaVersion: 1;
      requestId: string;
      status: "unsupported" | "failed";
      implementation: ExternalLayoutImplementationV1;
      reason: { code: string; message: string };
    };

export type ExternalLayoutSequenceRequestV2 = {
  schemaVersion: 2;
  requestId: string;
  caseName: string;
  seed: number;
  /** Convex normalized boundary shared by every snapshot and implementation. */
  boundary: ExternalLayoutPointV1[];
  snapshots: Array<{ snapshotId: string; graph: ExternalLayoutGraphV1 }>;
  semantics: ExternalLayoutBaselineRequestV1["semantics"];
  /** Node identity persists by id; array order is part of the adapter input contract. */
  identitySemantics: "path-stable-id";
  nodeOrderSemantics: "request-order";
  initialization: { mode: "native" } | { mode: "common-cells"; cells: ExternalLayoutCellV1[] };
  /** Each path is a fresh request/process; state may persist only inside that path. */
  lifecycle: {
    resetBeforeRequest: true;
    hostDoesNotResetWithinRequest: true;
    rngReset: "request-seed";
  };
};

export type ExternalLayoutSequenceImplementationV2 = ExternalLayoutImplementationV1 & {
  /** Declared and adapter-audited; whole-sequence JSON cannot enforce this boundary. */
  temporalAccess: "current-only" | "past-and-present" | "full-sequence";
  stateModel: "stateless" | "predecessor-layout" | "sequence-global";
  capabilities: {
    initializationModes: Array<"native" | "common-cells">;
    nodeCount: { min: number; max: number };
    boundary: "convex-polygon";
    cellGeometry: "convex-polygons";
    siteSemantics: "native" | "derived" | "none";
    dependencySemantics: "ignored" | "undirected-constraints";
    deterministicForFixedSeed: boolean;
  };
};

export type ExternalLayoutSequenceRunV2 = {
  snapshotId: string;
  cells: Array<Omit<ExternalLayoutCellV1, "site"> & { site?: ExternalLayoutPointV1 }>;
  /** Native work counters are descriptive and must not be compared as common units. */
  work: {
    nativeIterations?: number;
    weightedSolves?: number;
    candidateEvaluations?: number;
    algorithmTimeMs?: number;
  };
  nativeConverged: boolean;
};

export type ExternalLayoutSequenceResponseV2 =
  | {
      schemaVersion: 2;
      requestId: string;
      status: "ok";
      implementation: ExternalLayoutSequenceImplementationV2;
      runs: ExternalLayoutSequenceRunV2[];
    }
  | {
      schemaVersion: 2;
      requestId: string;
      status: "unsupported" | "failed";
      implementation: ExternalLayoutSequenceImplementationV2;
      reason: { code: string; message: string };
    };
