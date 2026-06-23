# Runtime trace overlay

Status: Sampling + coverage overlays implemented (2026-06-20). Per-test deferred.

Relates to #16 (runtime trace / coverage visualization).

Shipped: the `Trace` contract, schema `resolveTraceSymbols` / `traceOverlay` /
`parseFoldedStacks` / `parseLlvmCoverage`, the TS adapters `tsCpuProfileAdapter`
(`.cpuprofile`, sampling) and `tsV8CoverageAdapter` (V8 precise coverage), the
`/api/trace` endpoint + `sprawlens serve --trace <artifact>` (auto-detects the
artifact format, resolves frames against the snapshot), and the viz
execution-path overlay (hot symbols tinted by self time / call count, the call
path drawn as a warm edge for sampling sources) in both the rings and treemap
layouts.

Verified end-to-end (demo repos):

- **sampling** — `.cpuprofile` (TS): 6/7 frames resolved, call path lit.
- **coverage** — V8 precise coverage (TS): 4/4 functions, exact counts; llvm-cov
  export (Rust `-C instrument-coverage`): 5/6 functions, exact counts. Coverage
  traces carry `calls` and no edges, so the overlay shows a node heatmap (no
  path lines), reusing the same renderer.

Format detection in the CLI (`loadTrace`): `{nodes,samples}` → cpuprofile;
`{result:[{functions}]}` → V8 coverage; `{data:[{functions}]}` → llvm coverage;
otherwise folded/collapsed stacks.

Deviation from the plan below: the Rust sampling ingest is **folded/collapsed
stacks** (`parseFoldedStacks`, the perf/inferno interchange — already
symbolicated text), not samply's raw profile. samply's `--save-only` output is
unsymbolicated module-relative offsets; resolving them offline against the
binary's DWARF is a larger task deferred to a follow-up. Folded stacks are what
`cargo flamegraph` / perf emit and are language-agnostic, so the path is covered
today; native samply parsing can be added as another `TraceAdapter` later.

## Goal

Capture a program's runtime execution and light up the path it took on the
existing symbol graph: which functions ran, which call edges were exercised, and
(where available) how hot each was. The trace is a language-neutral artifact
overlaid on the snapshot's symbols and call edges — the dynamic counterpart to
the static `Snapshot`.

## Feasibility (verified empirically)

Same call structure measured in both languages (`main → alpha → beta → gamma`,
`main → delta`). Two capture families exist per language, both without sudo:

|                         | TypeScript                                                                                                | Rust                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Node counts (exact)     | V8 `Profiler.takePreciseCoverage` → exact call counts (gamma=800, beta=400, alpha=200, delta=200, main=1) | `-C instrument-coverage` + `llvm-cov export` → same exact counts (rustup `llvm-tools` only) |
| Edges + time (sampling) | `--cpu-prof` / inspector `Profiler` → call tree (`main→delta`, `alpha→beta`, `beta→gamma`) + self time    | `samply record` → sampled call stacks + module-relative addresses (no sudo on macOS)        |
| Source mapping          | `callFrame`: url + lineNumber + columnNumber + scriptId                                                   | function symbol + file:line via DWARF (`nm`/`atos`/`addr2line`/`llvm-symbolizer`)           |

Findings:

- **Two granularities, complementary.** _Coverage_ gives exact per-function
  call counts but no edges. _Sampling_ gives caller→callee edges and self/total
  time but is approximate (unsampled functions are missing).
- **Both normalize** to `function + source position + counts/time`, which maps
  onto the existing `symbol:<path>:<kind>:<name>:<line>` ids and the
  call-hierarchy / CFG graph.
- **Rust sampling needs symbolication.** `samply --save-only` leaves frames as
  module-relative offsets; resolving them against the binary's debuginfo yields
  function + file:line. samply does this itself when it serves its UI.

## Decisions

- **Ingest only.** sprawlens does not drive the profiler. The user runs their
  tool of choice and sprawlens ingests the resulting artifact (`.cpuprofile`,
  samply `profile.json`, coverage export JSON). A per-language `TraceAdapter`
  parses one artifact format into the neutral `Trace`; tool specifics stay in
  the adapter.
- **Sampling call-path is the first-class implementation.** The headline view is
  "the execution path on the graph": nodes lit by self time, edges lit as the
  call path. TS = `.cpuprofile`, Rust = samply. Coverage (exact node counts, no
  edges) is a later complement; the contract already carries its fields so a
  coverage adapter slots in without a schema change.

## Contract

Language-neutral, lives in `@sprawlens/contracts`. The `Trace` is the dynamic
sibling of `Snapshot`, joined to it by symbol reference.

```ts
type TraceSource =
  | "v8-cpuprofile" // TS/JS sampling
  | "v8-coverage" // TS/JS exact node counts
  | "samply" // Rust/native sampling
  | "llvm-coverage" // Rust/native exact node counts
  | string;

/** How a trace node links back to a source function. The join key to the graph. */
type TraceSymbolRef = {
  /** Resolved snapshot symbol id when computable. */
  symbolId?: string;
  /** Raw location for (re)resolution to the nearest enclosing symbol. */
  file?: string; // repo-relative
  name: string; // function name
  line?: number; // 1-based declaration line
};

type TraceNode = {
  id: string; // stable within a trace
  ref: TraceSymbolRef;
  /** Exact entry count (coverage sources); absent for sampling-only. */
  calls?: number;
  /** Sampling sources: self/total weight. */
  selfSamples?: number;
  selfTimeUs?: number;
  totalTimeUs?: number;
};

type TraceEdge = {
  from: string; // caller TraceNode id
  to: string; // callee TraceNode id
  /** Call count (instrumented) or transition sample count (sampling). */
  count: number;
};

type Trace = {
  schemaVersion: 1;
  source: TraceSource;
  /** What produced it: a test name, a command, a binary. */
  label?: string;
  capturedAt?: string;
  /** Normalizers for weighting. */
  sampleCount?: number;
  durationUs?: number;
  nodes: TraceNode[];
  edges: TraceEdge[]; // empty for coverage-only sources
};

/** Per-language artifact parser, sibling to LanguageProvider / TestAdapter. */
interface TraceAdapter {
  source: TraceSource;
  /** Normalize one captured artifact into a neutral Trace. */
  parse(rawArtifact: unknown, repoRoot: string): Trace;
}
```

Design notes:

- **Granularity is encoded in optional fields + `source`.** The viz reads
  `source` to know whether edges are reliable (sampling) and whether counts are
  exact (coverage). A coverage trace ships `calls` and an empty `edges`; a
  sampling trace ships `selfSamples`/`selfTimeUs` and a populated `edges`.
- **Symbol resolution is the server's job.** The adapter emits `TraceSymbolRef`
  (file + name + line). The server resolves it to a snapshot `symbolId` by the
  nearest enclosing symbol (the snapshot already has every symbol's line range),
  reusing the call-hierarchy/CFG machinery for the overlay.
- **Overlay semantics.** Trace nodes → lit symbols (weight by `selfTimeUs` or
  `calls`); trace edges → lit call edges. Reuses the existing symbol-edge
  rendering; no new layout. Selecting a trace shows its path; multiple traces
  (e.g. per test) can be compared.

## Data flow

```
profiler artifact ──[TraceAdapter.parse]──▶ Trace (neutral)
Trace + Snapshot ──[server: resolve refs → symbolId]──▶ resolved Trace
resolved Trace ──[/api/trace]──▶ viz overlay (lit path on the symbol graph)
```

## Scope

- **Done: sampling overlay.** `.cpuprofile` (TS) + folded stacks (Rust/native);
  server resolution to symbol ids; `/api/trace`; lit-path overlay in the viz.
- **Done: coverage complement.** `tsV8CoverageAdapter` (V8 precise coverage) and
  `parseLlvmCoverage` (llvm-cov export) feed the same `Trace` (node heatmap from
  `calls`, no edges).
- **Later: native samply parsing.** Symbolicate samply's raw offsets offline
  against the binary's DWARF, as another sampling `TraceAdapter`.
- **Later: per-test traces.** Ties into the deferred test-reporter (#22): one
  trace per test case, so selecting a test shows exactly the code it exercised.

## Open questions

- Artifact discovery: explicit path argument vs a conventional location
  (`.sprawlens/traces/*.json`) the server watches.
- Multiple traces: union vs switch vs diff in the UI.
- Cross-language: a single run that crosses a TS↔native boundary (e.g. napi)
  would need two artifacts merged by symbol ref — out of scope for now.
