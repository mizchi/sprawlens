import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type {
  ExternalLayoutCellV1,
  ExternalLayoutSequenceImplementationV2,
  ExternalLayoutSequenceRequestV2,
  ExternalLayoutSequenceResponseV2,
} from "@sprawlens/schema";

export const GIT_AUTHOR_REVISION = "19b0f52c268838b31db32a200cf7b340a4b705fe";
export const GIT_AUTHOR_PARSER_SEED = 42;
export const GIT_AUTHOR_CANVAS_SIZE = 1_000_000;

export const GIT_AUTHOR_SEQUENCE_IMPLEMENTATION = {
  id: "git-author-java",
  revision: GIT_AUTHOR_REVISION,
  sourceUrl: "https://github.com/EduardoVernier/greedy-insertion-treemap",
  license: "NO-LICENSE-FILE-AT-FIXED-REVISION",
  adapterRevision: "1",
  parameters: {
    entrypoint: "com.eduardovernier.Main",
    parserSeed: GIT_AUTHOR_PARSER_SEED,
    canvasSize: GIT_AUTHOR_CANVAS_SIZE,
    boundaryRestriction: "normalized-axis-aligned-rectangle",
    rectangleOutput: "MetricsCollector .rect, 10 decimal places",
    sourceModified: false,
    paperDoi: "10.1109/SIBGRAPI.2018.00027",
  },
  // Parser.parseCSVs discovers the union of ids across every input revision
  // before shuffling and constructing revision zero. This is future access in
  // the fixed author source, even though the layout tree then updates in order.
  temporalAccess: "full-sequence",
  stateModel: "sequence-global",
  capabilities: {
    initializationModes: ["native"],
    nodeCount: { min: 1, max: 80 },
    boundary: "axis-aligned-rectangle",
    cellGeometry: "convex-polygons",
    siteSemantics: "derived",
    dependencySemantics: "ignored",
    deterministicForFixedSeed: true,
  },
} satisfies ExternalLayoutSequenceImplementationV2;

export type GitAuthorCsvInput = { name: string; contents: string };

export type GitAuthorAdapterRuntime = {
  execute: (inputs: readonly GitAuthorCsvInput[]) => Promise<readonly string[]>;
};

export type GitAuthorJavaOptions = {
  upstreamRoot: string;
  javaBin?: string;
  javacBin?: string;
  /** Precompiled fixed-author classes. When absent, one standalone request
   * compiles into its own disposable directory. */
  classesRoot?: string;
  xvfbRunBin?: string;
};

const unsupported = (
  requestId: string,
  code: string,
  message: string,
): ExternalLayoutSequenceResponseV2 => ({
  schemaVersion: 2,
  requestId,
  status: "unsupported",
  implementation: GIT_AUTHOR_SEQUENCE_IMPLEMENTATION,
  reason: { code, message },
});

const failed = (
  requestId: string,
  code: string,
  message: string,
): ExternalLayoutSequenceResponseV2 => ({
  schemaVersion: 2,
  requestId,
  status: "failed",
  implementation: GIT_AUTHOR_SEQUENCE_IMPLEMENTATION,
  reason: { code, message },
});

const canonicalBoundary = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const isCanonicalBoundary = (boundary: ExternalLayoutSequenceRequestV2["boundary"]) =>
  boundary.length === canonicalBoundary.length &&
  boundary.every(
    (point, index) =>
      point.x === canonicalBoundary[index]!.x && point.y === canonicalBoundary[index]!.y,
  );

const invalidNodeId = (id: string): boolean => {
  const segments = id.split("/");
  return (
    id.length === 0 ||
    /[\s,\r\n]/.test(id) ||
    id.startsWith("/") ||
    id.endsWith("/") ||
    id.includes("//") ||
    segments.some((segment) => segment.endsWith("_"))
  );
};

const hasHierarchyCollision = (ids: ReadonlySet<string>): boolean => {
  for (const id of ids) {
    const segments = id.split("/");
    for (let index = 1; index < segments.length; index++) {
      if (ids.has(segments.slice(0, index).join("/"))) return true;
    }
  }
  return false;
};

function unsupportedReason(
  request: ExternalLayoutSequenceRequestV2,
): { code: string; message: string } | null {
  if (request.schemaVersion !== 2) {
    return { code: "schema-version", message: "only schemaVersion 2 is supported" };
  }
  if (request.seed !== GIT_AUTHOR_PARSER_SEED) {
    return {
      code: "seed",
      message: `the fixed author parser hard-codes Random(${GIT_AUTHOR_PARSER_SEED})`,
    };
  }
  if (!isCanonicalBoundary(request.boundary)) {
    return {
      code: "boundary",
      message:
        "the fixed author implementation supports only the normalized axis-aligned rectangle",
    };
  }
  if (request.snapshots.length < 2) {
    return { code: "snapshots", message: "at least two ordered snapshots are required" };
  }
  if (
    request.semantics.nodeWeight !== "loc" ||
    request.semantics.dependencyEdges !== "undirected-constraints"
  ) {
    return { code: "semantics", message: "the shared LOC input semantics are required" };
  }
  if (request.initialization.mode !== "native") {
    return { code: "initialization", message: "only native initialization is supported" };
  }
  if (
    request.identitySemantics !== "path-stable-id" ||
    request.nodeOrderSemantics !== "request-order" ||
    request.lifecycle.resetBeforeRequest !== true ||
    request.lifecycle.hostDoesNotResetWithinRequest !== true ||
    request.lifecycle.rngReset !== "request-seed"
  ) {
    return {
      code: "lifecycle",
      message: "the v2 identity, order, and lifecycle contract is required",
    };
  }
  const sequenceIds = new Set<string>();
  for (const [snapshotIndex, snapshot] of request.snapshots.entries()) {
    const { nodes, edges } = snapshot.graph;
    if (
      nodes.length < GIT_AUTHOR_SEQUENCE_IMPLEMENTATION.capabilities.nodeCount.min ||
      nodes.length > GIT_AUTHOR_SEQUENCE_IMPLEMENTATION.capabilities.nodeCount.max
    ) {
      return {
        code: "node-count",
        message: `snapshot ${snapshotIndex} requires ${GIT_AUTHOR_SEQUENCE_IMPLEMENTATION.capabilities.nodeCount.min} to ${GIT_AUTHOR_SEQUENCE_IMPLEMENTATION.capabilities.nodeCount.max} active nodes`,
      };
    }
    const ids = nodes.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      return { code: "node-id", message: `snapshot ${snapshotIndex} contains duplicate ids` };
    }
    if (ids.some(invalidNodeId)) {
      return {
        code: "node-id",
        message:
          "ids must round-trip through the author's unquoted CSV and whitespace .rect formats",
      };
    }
    for (const id of ids) sequenceIds.add(id);
    if (nodes.some(({ weight }) => !Number.isFinite(weight) || weight <= 0)) {
      return {
        code: "node-weight",
        message: "every active node weight must be finite and positive",
      };
    }
    const idSet = new Set(ids);
    if (edges.some(({ source, target }) => !idSet.has(source) || !idSet.has(target))) {
      return {
        code: "edge-endpoint",
        message: `snapshot ${snapshotIndex} has an unknown edge endpoint`,
      };
    }
  }
  if (hasHierarchyCollision(sequenceIds)) {
    return {
      code: "node-id",
      message: "an id cannot also be the slash-delimited ancestor of another id in the sequence",
    };
  }
  return null;
}

/** Serialize only the active leaves. The author parser supplies zero-weight
 * placeholders for identities absent from a revision after its full-sequence
 * discovery pass. */
export function gitAuthorCsvInputs(request: ExternalLayoutSequenceRequestV2): GitAuthorCsvInput[] {
  return request.snapshots.map(({ graph }, index) => ({
    name: `revision-${String(index).padStart(6, "0")}.csv`,
    contents: `id,weight\n${graph.nodes.map(({ id, weight }) => `${id},${weight}`).join("\n")}\n`,
  }));
}

const normalized = (value: number, canvasSize: number): number => {
  const result = value / canvasSize;
  return Object.is(result, -0) ? 0 : result;
};

/** Parse the author's `id x y width height` format into the shared polygon
 * contract and restore the exact request order. */
export function parseGitAuthorRectangles(
  contents: string,
  expectedIds: readonly string[],
  canvasSize = GIT_AUTHOR_CANVAS_SIZE,
): ExternalLayoutCellV1[] {
  const byId = new Map<string, ExternalLayoutCellV1>();
  for (const [lineIndex, line] of contents.split(/\r?\n/).entries()) {
    if (line.length === 0) continue;
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 5) throw new Error(`invalid .rect line ${lineIndex + 1}`);
    const id = fields[0]!;
    const rawX = Number(fields[1]!);
    const rawY = Number(fields[2]!);
    const rawWidth = Number(fields[3]!);
    const rawHeight = Number(fields[4]!);
    if ([rawX, rawY, rawWidth, rawHeight].some((value) => !Number.isFinite(value))) {
      throw new Error(`non-finite .rect geometry for ${id}`);
    }
    if (rawWidth <= 0 || rawHeight <= 0) throw new Error(`degenerate .rect geometry for ${id}`);
    const epsilon = 1e-6;
    if (
      rawX < -epsilon ||
      rawY < -epsilon ||
      rawX + rawWidth > canvasSize + epsilon ||
      rawY + rawHeight > canvasSize + epsilon
    ) {
      throw new Error(`out-of-canvas .rect geometry for ${id}`);
    }
    if (byId.has(id)) throw new Error(`duplicate .rect id ${id}`);
    const x = normalized(rawX, canvasSize);
    const y = normalized(rawY, canvasSize);
    const width = normalized(rawWidth, canvasSize);
    const height = normalized(rawHeight, canvasSize);
    byId.set(id, {
      id,
      site: { x: x + width / 2, y: y + height / 2 },
      polygon: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
    });
  }
  if (byId.size !== expectedIds.length || expectedIds.some((id) => !byId.has(id))) {
    throw new Error("author rectangle ids do not exactly match the request snapshot");
  }
  return expectedIds.map((id) => byId.get(id)!);
}

type ProcessResult = { stdout: string; stderr: string };

function runProcess(
  executable: string,
  args: readonly string[],
  cwd: string,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(new Error(`${basename(executable)} exited with ${String(code)}: ${stderr.trim()}`));
    });
  });
}

async function fixedAuthorSources(upstreamRoot: string): Promise<string[]> {
  if (!existsSync(join(upstreamRoot, ".git"))) {
    throw new Error("upstream root is not a git checkout");
  }
  const revision = (await runProcess("git", ["rev-parse", "HEAD"], upstreamRoot)).stdout.trim();
  if (revision !== GIT_AUTHOR_REVISION) {
    throw new Error(`upstream revision ${revision} does not match ${GIT_AUTHOR_REVISION}`);
  }
  const dirty = (
    await runProcess("git", ["status", "--porcelain", "--untracked-files=no"], upstreamRoot)
  ).stdout.trim();
  if (dirty.length > 0) throw new Error("fixed author checkout has modified tracked files");
  const sourceRoot = join(upstreamRoot, "src", "com", "eduardovernier");
  const sources = readdirSync(sourceRoot)
    .filter((name) => name.endsWith(".java"))
    .sort()
    .map((name) => join(sourceRoot, name));
  if (sources.length === 0) throw new Error("fixed author checkout has no Java sources");
  return sources;
}

/** Compile verified, unmodified author sources outside measured path
 * processes. The caller owns the fresh destination and may reuse its immutable
 * classes across separate JVM invocations. */
export async function prepareGitAuthorJavaClasses(
  options: Pick<GitAuthorJavaOptions, "upstreamRoot" | "javacBin"> & { classesRoot: string },
): Promise<void> {
  const sources = await fixedAuthorSources(options.upstreamRoot);
  mkdirSync(options.classesRoot, { recursive: true });
  await runProcess(
    options.javacBin ?? "javac",
    ["-d", options.classesRoot, ...sources],
    options.upstreamRoot,
  );
  if (!existsSync(join(options.classesRoot, "com", "eduardovernier", "Main.class"))) {
    throw new Error("javac did not produce the fixed author entrypoint");
  }
}

/** Compile and execute the unmodified fixed author checkout in a disposable
 * directory. Compilation output and CSV/rectangle files never enter upstream. */
export function gitAuthorJavaRuntime(options: GitAuthorJavaOptions): GitAuthorAdapterRuntime {
  return {
    execute: async (inputs) => {
      const root = options.upstreamRoot;
      await fixedAuthorSources(root);

      const workRoot = mkdtempSync(join(tmpdir(), "sprawlens-git-author-"));
      const inputRoot = join(workRoot, "input");
      const outputRoot = join(workRoot, "output");
      const classesRoot = options.classesRoot ?? join(workRoot, "classes");
      mkdirSync(inputRoot);
      mkdirSync(outputRoot);
      if (options.classesRoot) {
        if (!existsSync(join(classesRoot, "com", "eduardovernier", "Main.class"))) {
          throw new Error("precompiled fixed author entrypoint is missing");
        }
      } else {
        mkdirSync(classesRoot);
      }
      try {
        for (const input of inputs)
          writeFileSync(join(inputRoot, input.name), input.contents, "utf8");
        if (!options.classesRoot) {
          await prepareGitAuthorJavaClasses({
            upstreamRoot: root,
            classesRoot,
            ...(options.javacBin ? { javacBin: options.javacBin } : {}),
          });
        }
        const javaArgs = [
          "-cp",
          classesRoot,
          "com.eduardovernier.Main",
          inputRoot,
          String(GIT_AUTHOR_CANVAS_SIZE),
          String(GIT_AUTHOR_CANVAS_SIZE),
          outputRoot,
        ];
        if (options.xvfbRunBin) {
          await runProcess(
            options.xvfbRunBin,
            ["-a", options.javaBin ?? "java", ...javaArgs],
            root,
          );
        } else {
          await runProcess(options.javaBin ?? "java", javaArgs, root);
        }
        return inputs.map((_, index) => readFileSync(join(outputRoot, `t${index}.rect`), "utf8"));
      } finally {
        rmSync(workRoot, { recursive: true, force: true });
      }
    },
  };
}

/** Execute one ordered path in the fixed author implementation. */
export async function runGitAuthorSequenceAdapterRequest(
  request: ExternalLayoutSequenceRequestV2,
  runtime: GitAuthorAdapterRuntime,
): Promise<ExternalLayoutSequenceResponseV2> {
  const reason = unsupportedReason(request);
  if (reason) return unsupported(request.requestId, reason.code, reason.message);
  try {
    const outputs = await runtime.execute(gitAuthorCsvInputs(request));
    if (outputs.length !== request.snapshots.length) {
      throw new Error("author output count does not match the request snapshots");
    }
    return {
      schemaVersion: 2,
      requestId: request.requestId,
      status: "ok",
      implementation: GIT_AUTHOR_SEQUENCE_IMPLEMENTATION,
      runs: request.snapshots.map(({ snapshotId, graph }, index) => ({
        snapshotId,
        cells: parseGitAuthorRectangles(
          outputs[index]!,
          graph.nodes.map(({ id }) => id),
        ),
        work: {},
        nativeConverged: true,
      })),
    };
  } catch (error) {
    return failed(
      request.requestId,
      "author-process",
      error instanceof Error ? error.message : String(error),
    );
  }
}
