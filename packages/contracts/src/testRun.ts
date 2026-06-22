// Test run: the dynamic counterpart to TestTree. A test runner's report is
// ingested and normalized (by a per-runner TestRunAdapter) into this neutral
// shape, then joined to the test tree by test-case id and overlaid on the test
// plane as pass/fail/skip status and duration. The optional per-case `covers`
// links each case to the source symbols it exercised. See
// docs/design/2026-06-21-test-reporter.md.

import type { TraceSymbolRef } from "./trace.js";

export type TestStatus = "pass" | "fail" | "skip" | "todo";

export type TestCaseResult = {
  /** Join key into the TestTree: `test:<file>:<line>:<title>`. */
  testId: string;
  /** Repo-relative test file, for re-resolution when the id's line drifts. */
  file?: string;
  /** Full title (`suite › case`), the other re-resolution key. */
  name?: string;
  status: TestStatus;
  durationMs?: number;
  /** Failure message / assertion diff (fail only). */
  message?: string;
  /** Captured stdout/stderr of the run (click-to-run pipes the process output),
   * shown in the selection log panel. Absent for batch-ingested reports whose
   * runner didn't capture console output. */
  output?: string;
  /** Source symbols this case exercised — the edges to code. Resolved
   * server-side from a per-test trace; absent when none was captured. */
  covers?: TraceSymbolRef[];
};

export type TestRun = {
  schemaVersion: 1;
  /** What produced it: a command, a CI job. */
  label?: string;
  capturedAt?: string;
  results: TestCaseResult[];
};

/** Per-runner report parser, sibling to TraceAdapter. Normalizes one runner's
 * report into a neutral TestRun; capture is out-of-band and joining results to
 * the tree / resolving `covers` to symbols is the server's job. */
export interface TestRunAdapter {
  /** Normalize one runner report (already parsed from disk) into a TestRun.
   * `repoRoot` lets the adapter rewrite absolute file paths to repo-relative. */
  parse(rawReport: unknown, repoRoot: string): TestRun;
}
