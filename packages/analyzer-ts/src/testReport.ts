import type {
  TestCaseResult,
  TestRun,
  TestRunAdapter,
  TestStatus,
  TraceSymbolRef,
} from "@sprawlens/schema";

/** Istanbul coverage-final.json (vitest `--coverage.provider=v8` already applies
 * sourcemaps, so the keys are real source paths and the fnMap decls point at the
 * original lines). */
type IstanbulFile = {
  path?: string;
  fnMap?: Record<string, { name?: string; decl?: { start?: { line?: number } } }>;
  f?: Record<string, number>;
};

/**
 * Executed functions of a click-to-run coverage report → unresolved symbol refs
 * (file + name + line). The server resolves these to symbol ids (a test's
 * `covers`), so the map can light up the code the case actually exercised.
 */
export function parseVitestCoverage(raw: unknown, repoRoot: string): TraceSymbolRef[] {
  const coverage = raw as Record<string, IstanbulFile>;
  const root = repoRoot.endsWith("/") ? repoRoot : `${repoRoot}/`;
  const refs: TraceSymbolRef[] = [];
  for (const [absPath, fileCov] of Object.entries(coverage ?? {})) {
    const path = fileCov.path ?? absPath;
    if (!path.startsWith(root) || path.includes("/node_modules/")) continue;
    const file = path.slice(root.length);
    for (const [id, fn] of Object.entries(fileCov.fnMap ?? {})) {
      if ((fileCov.f?.[id] ?? 0) <= 0 || !fn.name) continue;
      const line = fn.decl?.start?.line;
      refs.push({ name: fn.name, file, ...(line ? { line } : {}) });
    }
  }
  return refs;
}

/**
 * Ingest a vitest `--reporter=json` report into a neutral TestRun. Each
 * assertion becomes one case result; the id is shaped like the analyzer's test
 * extraction (`test:<file>:<line>:<title>`) so it joins the TestTree directly,
 * with the full title kept for re-resolution when the line is unavailable.
 * node:test's JSON is close enough to add as a second adapter later.
 */

type VitestAssertion = {
  ancestorTitles?: string[];
  title: string;
  status: string;
  duration?: number;
  failureMessages?: string[];
  location?: { line: number; column: number };
};
type VitestFile = { name: string; assertionResults?: VitestAssertion[] };
type VitestReport = { testResults?: VitestFile[] };

/** Absolute or file:// path → repo-relative; passes through already-relative. */
function repoRelative(value: string, repoRoot: string): string {
  const path = value.startsWith("file://")
    ? decodeURIComponent(value.slice("file://".length))
    : value;
  if (!path.startsWith("/")) return path;
  const root = repoRoot.endsWith("/") ? repoRoot : `${repoRoot}/`;
  return path.startsWith(root) ? path.slice(root.length) : path;
}

function statusOf(raw: string): TestStatus {
  switch (raw) {
    case "passed":
      return "pass";
    case "failed":
      return "fail";
    case "todo":
      return "todo";
    default:
      // skipped / pending / disabled
      return "skip";
  }
}

export function parseVitestReport(raw: unknown, repoRoot: string): TestRun {
  const report = raw as VitestReport;
  const results: TestCaseResult[] = [];
  for (const fileResult of report.testResults ?? []) {
    const file = repoRelative(fileResult.name, repoRoot);
    for (const a of fileResult.assertionResults ?? []) {
      const line = a.location?.line;
      const fullTitle = [...(a.ancestorTitles ?? []), a.title].join(" › ");
      results.push({
        testId: `test:${file}:${line ?? "?"}:${a.title}`,
        file,
        name: fullTitle,
        status: statusOf(a.status),
        ...(a.duration !== undefined ? { durationMs: a.duration } : {}),
        ...(a.failureMessages?.length
          ? { message: a.failureMessages.join("\n\n") }
          : {}),
      });
    }
  }
  return { schemaVersion: 1, results };
}

/** The vitest report adapter. */
export const vitestReportAdapter: TestRunAdapter = {
  parse: parseVitestReport,
};
