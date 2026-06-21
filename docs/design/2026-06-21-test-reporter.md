# Test reporter view

Status: Phase A implemented (2026-06-21). Builds on the `TestTree` contract and
the runtime trace overlay.

Implements #22 (test reporter: hierarchical runs with source edges and
click-to-run). Relates to #16 (runtime trace) — the source edges reuse the same
symbol-join machinery.

## Goal

Turn the static test plane (nested dir → file → describe → it districts) into a
**reporter** driven by actual test execution:

- **Run + report** — pass / fail / skip status and duration per case, surfaced
  on the test-case cells.
- **Edges to source** — each test case carries edges to the code it exercises;
  selecting a case lights up that code (and the reverse).
- **Click to run** — clicking a case runs just that one test and reflects the
  fresh result.

## Contract shape: a `TestRun` is the dynamic sibling of `TestTree`

Mirror the `Snapshot` / `Trace` split already in the repo. `TestTree` stays a
pure static extraction (regenerable from source); a **`TestRun`** is the dynamic
overlay, joined to the tree by **test-case id** (`test:<file>:<line>:<title>`)
and to the symbol graph by symbol ref. Keeping results out of `TestTree` keeps
the analyzer's extraction deterministic and the run an ingestible artifact —
consistent with "contracts strict, implementation regenerable".

```ts
// @sprawlens/contracts/src/testRun.ts
type TestStatus = "pass" | "fail" | "skip" | "todo";

type TestCaseResult = {
  /** Join key into TestTree: test:<file>:<line>:<title>. */
  testId: string;
  /** Raw locators for (re)resolution when ids drift across a re-extraction. */
  file?: string;
  name?: string;       // full title ("suite › case")
  status: TestStatus;
  durationMs?: number;
  /** Failure message / assertion diff (fail only). */
  message?: string;
  /** Symbols this case exercised — the source edges. Resolved server-side from
   *  a per-test coverage/trace artifact; absent when no per-test trace exists. */
  covers?: TraceSymbolRef[];
};

type TestRun = {
  schemaVersion: 1;
  /** What produced it: a command, a CI job. */
  label?: string;
  capturedAt?: string;
  results: TestCaseResult[];
};

/** Per-runner report parser, sibling to TraceAdapter. */
interface TestRunAdapter {
  /** Normalize one runner's report (vitest/node:test JSON) into a TestRun. */
  parse(rawReport: unknown, repoRoot: string): TestRun;
}
```

`covers` reuses `TraceSymbolRef` so the existing `resolveTraceSymbols`-style
join (nearest enclosing line → name) resolves it to snapshot symbol ids without
a new mechanism. A per-test trace is just a `Trace` captured under one test; its
resolved node symbol ids become that case's `covers`.

## Resolution + overlay (schema)

- `resolveTestRun(run, tree, snapshot)` — match each result to a `TestNode`
  case id; fall back to file + full-title when ids drifted. Resolve `covers`
  refs to symbol ids (reuse the trace resolver).
- `testRunOverlay(run)` — `statusOf: Map<testId, TestStatus>`,
  `durationOf: Map<testId, number>`, and `coversOf: Map<testId, symbolId[]>`.
  The viz tints test-case cells by status, labels duration, and on selection of
  a case drives the existing `traceEdges` / `traceHeat` overlay from `coversOf`.

## Ingest (CLI), mirroring `--trace`

- `sprawlens serve --test-report <path>` — read the runner's JSON report,
  detect format (vitest `--reporter=json` → `{ testResults: [{ assertionResults }] }`;
  node:test TAP/JSON later), parse to `TestRun`, resolve against the snapshot,
  pass to `createAtlasServer`. `GET /api/test-run` returns it (or null), exactly
  like `/api/trace`.
- Per-test source edges (`covers`) come from per-test coverage artifacts in a
  conventional dir (`--test-traces <dir>/<testId>.json`), each ingested via the
  existing trace adapters; deferred to Phase B.

## Click-to-run (the one place sprawlens drives a runner)

This is the only part that breaks the "ingest only, sprawlens does not drive the
profiler" rule from the runtime-trace design, and #22 asks for it explicitly. It
needs a configured command and a mutating endpoint:

- `sprawlens.toml` gains `[test] command = "pnpm vitest run"` (the base run
  command; the case is appended as `-t <title>` or by `file`).
- `POST /api/test-run/case { testId }` — the server spawns
  `<command> <file> -t <title> --reporter=json`, parses the fresh report for
  that case, updates the in-memory `TestRun`, and returns the new
  `TestCaseResult`. No command runs unless `[test] command` is set; the endpoint
  404s otherwise. The command is read from the repo's own config, never from a
  request body, so a page cannot inject a command to run.

## Phasing

- **Phase A — report ingest + status on nodes. (done)** `TestRun` contract,
  `resolveTestRun` / `testRunOverlay`, the vitest-json adapter, `--test-report`
  + `GET /api/test-run`, and test-case cells tinted pass/fail/skip with a
  duration label. No runner driving. Verified e2e: a vitest `--reporter=json`
  report joins to the extracted tree (by file + full title when the runner omits
  task locations) and tints the cases.
- **Phase B — source edges per test.** Ingest per-test traces, populate
  `covers`, and drive the symbol overlay from the selected case.
- **Phase C — click-to-run.** `[test] command` config + `POST /api/test-run/case`
  that spawns one test and refreshes its result. Adds command execution to the
  server — confirm before building.

## Open questions

- Hierarchical outline vs the spatial treemap: #22 sketches a plain indented
  outline (no tilt). Phase A keeps the existing treemap and only tints it; an
  outline panel is a separate UI question.
- node:test / other runners: one `TestRunAdapter` each, like the trace adapters.
- Stale results across a re-extraction: match by file + title when the line in a
  test id drifts.
