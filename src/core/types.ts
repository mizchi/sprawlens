export type AIIndicator =
  | "claude-code"
  | "codex"
  | "copilot"
  | "cursor"
  | "devin"
  | "aider"
  | "unknown-ai-marker";

export type CommitAIInfo = {
  likelyAI: boolean;
  indicators: AIIndicator[];
  rawMatches: string[];
};

export type CommitMetadataInput = {
  hash?: string;
  shortHash?: string;
  timestamp?: string;
  authorName: string;
  authorEmail?: string;
  message: string;
};

export type SnapshotCommit = {
  hash: string;
  shortHash: string;
  timestamp: string;
  authorName: string;
  authorEmail?: string;
  message: string;
  aiIndicators: AIIndicator[];
};

export type RepoNode = {
  id: string;
  type: "repo";
  name: string;
};

export type DirNode = {
  id: string;
  type: "dir";
  path: string;
};

export type FileNode = {
  id: string;
  type: "file";
  path: string;
  ext: string;
  loc: number;
  sizeBytes: number;
  symbols?: CodeSymbol[];
};

export type CodeNode = RepoNode | DirNode | FileNode;

export type CodeSymbolKind =
  | "function"
  | "class"
  | "interface"
  | "enum"
  | "type"
  | "variable"
  // class members; static- variants are the static counterparts
  | "method"
  | "property"
  | "static-method"
  | "static-property";

export type CodeSymbol = {
  id: string;
  kind: CodeSymbolKind;
  name: string;
  startLine: number;
  endLine: number;
  loc: number;
  /** Cyclomatic complexity: 1 + branch points in the declaration. */
  complexity: number;
  exported: boolean;
  /** For class members: the parent class's symbol id. */
  parentClass?: string;
};

export type CodeImportBindingKind = "named" | "default" | "namespace" | "side-effect" | "reexport-named" | "reexport-all" | "require" | "dynamic";

export type CodeImportBinding = {
  imported: string;
  local: string;
  kind: CodeImportBindingKind;
  typeOnly?: boolean;
};

export type CodeSymbolImport = CodeImportBinding & {
  fromSymbolId?: string;
  fromSymbolName?: string;
  toSymbolId?: string;
  toSymbolName?: string;
};

export type ContainsEdge = {
  id: string;
  type: "contains";
  from: string;
  to: string;
};

export type ImportsEdge = {
  id: string;
  type: "imports";
  from: string;
  to: string;
  specifier: string;
  resolved: boolean;
  /** An import of an external package (bare specifier); `to` is a synthetic
   * `external:<specifier>` id with no node, like unresolved imports. */
  external?: boolean;
  bindings?: CodeImportBinding[];
  symbolImports?: CodeSymbolImport[];
};

export type CodeEdge = ContainsEdge | ImportsEdge;

export type SnapshotMetrics = {
  loc: number;
  fileCount: number;
  dirCount: number;
  importEdgeCount: number;
  unresolvedImportCount: number;
  cycleCount: number;
  largestComponentSize: number;
  maxFanIn: number;
  maxFanOut: number;
};

export type Snapshot = {
  schemaVersion: 1;
  repoPath: string;
  commit: SnapshotCommit;
  nodes: CodeNode[];
  edges: CodeEdge[];
  metrics: SnapshotMetrics;
};

export type FileGraphMetric = {
  fanIn: number;
  fanOut: number;
  inCycle: boolean;
};

export type MetricsComputation = {
  metrics: SnapshotMetrics;
  fileMetrics: Record<string, FileGraphMetric>;
  cycleFiles: string[];
  cyclicNodeIds: string[];
};

export type ChangedFile = {
  path: string;
  locBefore?: number;
  locAfter?: number;
  locDelta: number;
  fanInBefore?: number;
  fanInAfter?: number;
  fanOutBefore?: number;
  fanOutAfter?: number;
};

export type HotspotReason =
  | "large-loc-growth"
  | "high-churn"
  | "fan-in-increased"
  | "fan-out-increased"
  | "new-cycle"
  | "new-unresolved-import"
  | "large-new-file"
  | "possible-duplicate";

export type Hotspot = {
  path: string;
  score: number;
  reasons: HotspotReason[];
};

export type GraphDiff = {
  schemaVersion: 1;
  fromCommit: string;
  toCommit: string;
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
  changedFiles: ChangedFile[];
  metricDelta: Partial<Record<keyof SnapshotMetrics, number>>;
  hotspots: Hotspot[];
};

export type CodesprawlConfig = {
  schemaVersion: 1;
  repoPath: string;
  createdAt: string;
  options: {
    commits?: number;
    since?: string;
    step?: "weekly";
  };
};

export type CommitRecord = SnapshotCommit & {
  likelyAI: boolean;
};
