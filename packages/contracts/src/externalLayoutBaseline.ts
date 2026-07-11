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
