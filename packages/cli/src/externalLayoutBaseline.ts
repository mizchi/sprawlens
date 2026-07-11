import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import {
  parseExternalLayoutBaselineResponse,
  type ExternalLayoutBaselineRequestV1,
  type ExternalLayoutBaselineResponseV1,
} from "@sprawlens/schema";
import type { DeltaBenchmarkCase } from "@sprawlens/layout";

/** Convert one internal module delta to the implementation-neutral wire format. */
export function createExternalLayoutBaselineRequest(
  input: DeltaBenchmarkCase,
  seed: number,
): ExternalLayoutBaselineRequestV1 {
  const graph = (value: DeltaBenchmarkCase["before"]) => ({
    nodes: value.nodes.map(({ id, weight }) => ({ id, weight })),
    edges: value.edges.map(({ source, target, weight }) => ({
      source,
      target,
      ...(weight === undefined ? {} : { weight }),
    })),
  });
  return {
    schemaVersion: 1,
    requestId: `${input.name}:${seed}`,
    caseName: input.name,
    seed,
    boundary: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    before: graph(input.before),
    after: graph(input.after),
    semantics: { nodeWeight: "loc", dependencyEdges: "undirected-constraints" },
  };
}

type ExternalBaselineExecutionFailureCode =
  | "spawn-error"
  | "timeout"
  | "nonzero-exit"
  | "output-too-large"
  | "invalid-output";
type ExternalBaselineFailure = {
  code: ExternalBaselineExecutionFailureCode;
  message: string;
};

type ExternalBaselineExecution =
  | {
      status: "completed";
      response: ExternalLayoutBaselineResponseV1;
      wallTimeMs: number;
      stderr: string;
    }
  | {
      status: "failed";
      failure: ExternalBaselineFailure;
      wallTimeMs: number;
      stderr: string;
      exitCode: number | null;
    };

type ExternalBaselineProcessOptions = {
  timeoutMs?: number;
  maxOutputBytes?: number;
  cwd?: string;
};

/**
 * Run a separately versioned baseline adapter without a shell. The adapter reads
 * exactly one ExternalLayoutBaselineRequestV1 from stdin and writes one response
 * JSON value to stdout. Diagnostic output belongs on stderr.
 */
export function runExternalLayoutBaseline(
  command: readonly [string, ...string[]],
  request: ExternalLayoutBaselineRequestV1,
  options: ExternalBaselineProcessOptions = {},
): Promise<ExternalBaselineExecution> {
  const [executable, ...args] = command;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxOutputBytes = options.maxOutputBytes ?? 16 * 1024 * 1024;
  const started = performance.now();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let forcedFailure: ExternalBaselineFailure | null = null;
    const child = spawn(executable, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const finishFailure = (failure: ExternalBaselineFailure, exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        status: "failed",
        failure,
        wallTimeMs: performance.now() - started,
        stderr,
        exitCode,
      });
    };
    const timer = setTimeout(() => {
      forcedFailure = { code: "timeout", message: `baseline exceeded ${timeoutMs} ms` };
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > maxOutputBytes && forcedFailure === null) {
        forcedFailure = {
          code: "output-too-large",
          message: `baseline stdout exceeded ${maxOutputBytes} bytes`,
        };
        child.kill("SIGKILL");
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (Buffer.byteLength(stderr) < maxOutputBytes) stderr += chunk;
    });
    child.on("error", (error) => {
      finishFailure({ code: "spawn-error", message: error.message }, null);
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      if (forcedFailure) {
        finishFailure(forcedFailure, exitCode);
        return;
      }
      if (exitCode !== 0) {
        finishFailure(
          { code: "nonzero-exit", message: `baseline exited with code ${String(exitCode)}` },
          exitCode,
        );
        return;
      }
      try {
        const response = parseExternalLayoutBaselineResponse(JSON.parse(stdout), request);
        settled = true;
        clearTimeout(timer);
        resolve({
          status: "completed",
          response,
          wallTimeMs: performance.now() - started,
          stderr,
        });
      } catch (error) {
        finishFailure(
          {
            code: "invalid-output",
            message: error instanceof Error ? error.message : String(error),
          },
          exitCode,
        );
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
