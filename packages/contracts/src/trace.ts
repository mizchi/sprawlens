// Runtime trace: the dynamic counterpart to Snapshot. A profiler artifact is
// ingested and normalized (by a per-language TraceAdapter) into this neutral
// shape, then joined to the snapshot's symbols and overlaid on the graph as the
// execution path the program actually took. See docs/design/2026-06-20-runtime-trace.md.

/** Which tool produced the artifact; tells the viz what is reliable. */
type TraceSource =
  // sampling (caller→callee edges + self/total time; approximate)
  | "v8-cpuprofile"
  | "samply"
  | "folded"
  // coverage (exact per-function call counts; no edges)
  | "v8-coverage"
  | "llvm-coverage"
  | (string & {});

/** How a trace node links back to a source function — the join key to the graph.
 * Reused by a test case's `covers` (the source it exercised). */
export type TraceSymbolRef = {
  /** Resolved snapshot symbol id (`symbol:<path>:<kind>:<name>:<line>`) when
   * the server could map this frame to a symbol. */
  symbolId?: string;
  /** Repo-relative source file, for resolution to the nearest enclosing symbol. */
  file?: string;
  /** Function name as the profiler reported it. */
  name: string;
  /** 1-based source line of the frame, when known. */
  line?: number;
};

export type TraceNode = {
  /** Stable within a single trace. */
  id: string;
  ref: TraceSymbolRef;
  /** Exact entry count (coverage sources); absent for sampling-only sources. */
  calls?: number;
  /** Self weight for sampling sources. */
  selfSamples?: number;
  selfTimeUs?: number;
  /** Inclusive (self + descendants) time, when the source provides it. */
  totalTimeUs?: number;
};

export type TraceEdge = {
  /** Caller TraceNode id. */
  from: string;
  /** Callee TraceNode id. */
  to: string;
  /** Call count (instrumented) or transition sample count (sampling). */
  count: number;
};

export type Trace = {
  schemaVersion: 1;
  source: TraceSource;
  /** What produced it: a test name, a command, a binary. */
  label?: string;
  capturedAt?: string;
  /** Totals for normalizing node/edge weights into [0,1]. */
  sampleCount?: number;
  durationUs?: number;
  nodes: TraceNode[];
  /** Empty for coverage-only sources. */
  edges: TraceEdge[];
};

/** Per-language artifact parser, sibling to LanguageProvider / TestAdapter. The
 * adapter only normalizes one captured artifact; capture is out-of-band and
 * symbol resolution is the server's job. */
export interface TraceAdapter {
  source: TraceSource;
  /** Normalize one captured artifact (already parsed from disk) into a Trace.
   * `repoRoot` lets the adapter rewrite absolute frame paths to repo-relative. */
  parse(rawArtifact: unknown, repoRoot: string): Trace;
}
