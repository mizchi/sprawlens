import type { Trace, TraceAdapter, TraceEdge, TraceNode } from "@sprawlens/schema";

/**
 * Ingest a V8 `.cpuprofile` (node --cpu-prof / inspector Profiler) into a
 * neutral Trace. The profile is a sampled call tree; we keep the frames that
 * live in the repo, attribute self samples/time from the sample stream, and
 * connect each repo frame to its nearest repo ancestor so caller→callee edges
 * survive through library/runtime frames. Source positions come straight from
 * the V8 callFrame, so nodes resolve to snapshot symbols by file + line.
 */

type CpuFrame = {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
};
type CpuNode = { id: number; callFrame: CpuFrame; children?: number[] };
type CpuProfile = {
  nodes: CpuNode[];
  samples: number[];
  timeDeltas: number[];
  startTime?: number;
  endTime?: number;
};

/** Absolute frame url → repo-relative path, or undefined when it is outside the
 * repo (node_modules, node internals, V8 builtins with no url). */
function toRepoRelative(url: string, repoRoot: string): string | undefined {
  if (!url) return undefined;
  let path = url.startsWith("file://")
    ? decodeURIComponent(url.slice("file://".length))
    : url;
  if (!path.startsWith("/")) return undefined; // builtins like "node:fs"
  if (path.includes("/node_modules/")) return undefined;
  const root = repoRoot.endsWith("/") ? repoRoot : `${repoRoot}/`;
  if (!path.startsWith(root)) return undefined;
  return path.slice(root.length);
}

export function parseCpuProfile(raw: unknown, repoRoot: string): Trace {
  const profile = raw as CpuProfile;
  const byId = new Map<number, CpuNode>();
  const parent = new Map<number, number>();
  for (const node of profile.nodes) byId.set(node.id, node);
  for (const node of profile.nodes)
    for (const child of node.children ?? []) parent.set(child, node.id);

  // self samples + self time from the sample stream (timeDeltas[i] precedes
  // samples[i]); these stay 0 for never-sampled frames.
  const selfSamples = new Map<number, number>();
  const selfTime = new Map<number, number>();
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i]!;
    selfSamples.set(id, (selfSamples.get(id) ?? 0) + 1);
    selfTime.set(id, (selfTime.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0));
  }

  // inclusive samples/time per node (self + descendants), memoized over the tree
  const inclSamples = new Map<number, number>();
  const inclTime = new Map<number, number>();
  const computeIncl = (id: number): [number, number] => {
    const cached = inclSamples.get(id);
    if (cached !== undefined) return [cached, inclTime.get(id)!];
    let s = selfSamples.get(id) ?? 0;
    let t = selfTime.get(id) ?? 0;
    for (const child of byId.get(id)?.children ?? []) {
      const [cs, ct] = computeIncl(child);
      s += cs;
      t += ct;
    }
    inclSamples.set(id, s);
    inclTime.set(id, t);
    return [s, t];
  };
  for (const node of profile.nodes) computeIncl(node.id);

  const relOf = new Map<number, string>();
  for (const node of profile.nodes) {
    const rel = toRepoRelative(node.callFrame.url, repoRoot);
    if (rel !== undefined) relOf.set(node.id, rel);
  }

  const nodes: TraceNode[] = [];
  for (const node of profile.nodes) {
    const file = relOf.get(node.id);
    if (file === undefined) continue;
    nodes.push({
      id: String(node.id),
      ref: {
        file,
        name: node.callFrame.functionName || "(anonymous)",
        line: node.callFrame.lineNumber + 1,
      },
      selfSamples: selfSamples.get(node.id) ?? 0,
      selfTimeUs: Math.round(selfTime.get(node.id) ?? 0),
      totalTimeUs: Math.round(inclTime.get(node.id) ?? 0),
    });
  }

  // nearest repo ancestor, so repo→repo edges survive through library frames
  const edges: TraceEdge[] = [];
  for (const node of profile.nodes) {
    if (!relOf.has(node.id)) continue;
    let anc = parent.get(node.id);
    while (anc !== undefined && !relOf.has(anc)) anc = parent.get(anc);
    if (anc === undefined) continue;
    const count = inclSamples.get(node.id) ?? 0;
    if (count > 0) edges.push({ from: String(anc), to: String(node.id), count });
  }

  const duration =
    profile.endTime !== undefined && profile.startTime !== undefined
      ? profile.endTime - profile.startTime
      : undefined;
  return {
    schemaVersion: 1,
    source: "v8-cpuprofile",
    sampleCount: profile.samples.length,
    ...(duration !== undefined ? { durationUs: duration } : {}),
    nodes,
    edges,
  };
}

/** The TS/JS sampling-trace adapter (V8 `.cpuprofile`). */
export const tsCpuProfileAdapter: TraceAdapter = {
  source: "v8-cpuprofile",
  parse: parseCpuProfile,
};

type V8Coverage = {
  result?: {
    url: string;
    functions?: {
      functionName: string;
      ranges?: { count: number }[];
    }[];
  }[];
};

/**
 * Ingest a V8 precise-coverage JSON (a `NODE_V8_COVERAGE` file, or the result of
 * `Profiler.takePreciseCoverage`) into a coverage Trace: one node per executed
 * in-repo function with its exact call count (the function's outer range), no
 * edges. Frames resolve to snapshot symbols by name within the file.
 */
export function parseV8Coverage(raw: unknown, repoRoot: string): Trace {
  const coverage = raw as V8Coverage;
  const nodes: TraceNode[] = [];
  let index = 0;
  for (const script of coverage.result ?? []) {
    const file = toRepoRelative(script.url, repoRoot);
    if (file === undefined) continue;
    for (const fn of script.functions ?? []) {
      if (!fn.functionName) continue; // anonymous frames have no symbol to hit
      const count = fn.ranges?.[0]?.count ?? 0;
      if (count <= 0) continue;
      nodes.push({
        id: `cov:${file}:${fn.functionName}:${index++}`,
        ref: { file, name: fn.functionName },
        calls: count,
      });
    }
  }
  return { schemaVersion: 1, source: "v8-coverage", nodes, edges: [] };
}

/** The TS/JS coverage-trace adapter (V8 precise coverage). */
export const tsV8CoverageAdapter: TraceAdapter = {
  source: "v8-coverage",
  parse: parseV8Coverage,
};
