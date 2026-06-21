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

type RepoNode = {
  id: string;
  type: "repo";
  name: string;
};

type DirNode = {
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
  /** Visual layer this file belongs to: absent/"source" = the main map, any
   * other value = a satellite plane (test, deps, docs, ...). Stamped by
   * applyLayers from a LayersConfig; absent in raw analyzer output. */
  layer?: string;
};

export type CodeNode = RepoNode | DirNode | FileNode;

export type CodeSymbolKind =
  | "function"
  | "class"
  | "interface"
  | "enum"
  | "type"
  | "variable"
  // a macro definition (e.g. Rust `macro_rules!`); declares a callable unit
  // that is not a function
  | "macro"
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

/**
 * A node in the test-case tree. The hierarchy is `dir` → `file` → `suite` →
 * `case`: directories and files scaffold the location, suites are grouping
 * blocks (vitest/jest `describe`, Rust test `mod`, Go package), and cases are
 * the leaf tests (`it`/`test`, `#[test] fn`, `func TestXxx`, MoonBit `test`).
 * Language analyzers emit the suite/case forest per file; `buildTestTree` adds
 * the dir/file scaffolding. Surfaced as its own plane in the visualizer.
 */
type TestNodeKind = "dir" | "file" | "suite" | "case";

export type TestNode = {
  /** Stable id: dir/file keyed by path, suite/case by file + name + line. */
  id: string;
  kind: TestNodeKind;
  /** Display name: a basename for dir/file, the literal title for suite/case. */
  name: string;
  /** Owning test file path (file/suite/case nodes); absent on dir nodes. */
  file?: string;
  /** 1-based declaration line of the suite/case (suite/case only). */
  startLine?: number;
  endLine?: number;
  children: TestNode[];
};

export type TestTree = {
  /** Synthetic dir root holding the directory/file forest. */
  root: TestNode;
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

type ContainsEdge = {
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
   * `external:<specifier>` id with no node, like unresolved imports. The
   * specifier is grouped to the dependency unit (the go.mod module, the Cargo
   * crate), not the raw sub-path. */
  external?: boolean;
  /** A standard-library import (Go stdlib, Rust std/core/alloc, ...): external
   * but not a project dependency, so the deps view excludes it by default. */
  stdlib?: boolean;
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
  /** Test-case forest (dir → file → suite → case), when the analyzer extracts
   * it. Absent for analyzers/repos without test extraction. */
  tests?: TestTree;
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
