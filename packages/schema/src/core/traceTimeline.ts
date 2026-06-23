import type { Snapshot, TracePlane, TraceStep, TraceTimeline } from "@sprawlens/contracts";
import { buildSymbolResolver } from "./trace.ts";

// A V8 cpuprofile (node:inspector Profiler / CDP Profiler / `node --cpu-prof`).
// Both the server and browser planes emit exactly this shape.
type CpuFrame = { functionName: string; url: string; lineNumber: number };
type CpuNode = { id: number; callFrame: CpuFrame; children?: number[] };
export type CpuProfileLike = {
  nodes: CpuNode[];
  /** Top-of-stack node id per sample, in capture order. */
  samples: number[];
  /** Microseconds elapsed *before* the corresponding sample. */
  timeDeltas: number[];
  startTime?: number;
  endTime?: number;
};

/** Absolute frame url → repo-relative path, or undefined when it is outside the
 * repo (node_modules, node/V8 builtins with no file url). Mirrors the cpuprofile
 * adapter so timeline and overlay resolve frames identically. */
function repoRelative(url: string, repoRoot: string): string | undefined {
  if (!url) return undefined;
  const path = url.startsWith("file://") ? decodeURIComponent(url.slice("file://".length)) : url;
  if (!path.startsWith("/")) return undefined;
  if (path.includes("/node_modules/")) return undefined;
  const root = repoRoot.endsWith("/") ? repoRoot : `${repoRoot}/`;
  return path.startsWith(root) ? path.slice(root.length) : undefined;
}

/**
 * Build a single plane's ordered execution timeline from a V8 cpuprofile.
 *
 * Walks the sample stream in capture order; for each sample the "active" symbol
 * is the deepest first-party frame on its stack (so a library leaf is charged to
 * the repo function that called it). Consecutive samples with the same active
 * symbol collapse into one navigable step whose `durUs` sums their slices. A
 * sample with no first-party frame at all charges its slice to the running step
 * (or, before any step, is pre-roll and only advances the clock). Frames resolve
 * to snapshot symbols by file + line, in-repo only — never by a bare name match,
 * so a library frame can't masquerade as a same-named symbol.
 */
export function buildTraceTimeline(
  profile: CpuProfileLike,
  opts: { repoRoot: string; snapshot: Snapshot; plane: TracePlane },
): TraceTimeline {
  const resolve = buildSymbolResolver(opts.snapshot);
  const byId = new Map<number, CpuNode>();
  const parent = new Map<number, number>();
  for (const node of profile.nodes) byId.set(node.id, node);
  for (const node of profile.nodes)
    for (const child of node.children ?? []) parent.set(child, node.id);

  // resolved symbol per node id (undefined = library / unresolved)
  const symOf = new Map<number, string>();
  for (const node of profile.nodes) {
    const file = repoRelative(node.callFrame.url, opts.repoRoot);
    if (file === undefined) continue;
    const sid = resolve(
      file,
      node.callFrame.functionName || "(anonymous)",
      node.callFrame.lineNumber + 1,
    );
    if (sid) symOf.set(node.id, sid);
  }

  // root→leaf node chain for a sampled leaf (memoized: the same leaf id recurs
  // across many samples)
  const chainCache = new Map<number, number[]>();
  const chainOf = (leaf: number): number[] => {
    const cached = chainCache.get(leaf);
    if (cached) return cached;
    const chain: number[] = [];
    let id: number | undefined = leaf;
    while (id !== undefined) {
      chain.push(id);
      id = parent.get(id);
    }
    chain.reverse();
    chainCache.set(leaf, chain);
    return chain;
  };

  const steps: TraceStep[] = [];
  let cur: TraceStep | null = null;
  let now = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const slice = profile.timeDeltas[i] ?? 0;
    const chain = chainOf(profile.samples[i]!);
    const resolvedStack = chain.map((id) => symOf.get(id)).filter((s): s is string => !!s);
    const active = resolvedStack.length ? resolvedStack[resolvedStack.length - 1]! : null;
    if (active === null) {
      if (cur) cur.durUs += slice; // library run charged to the open step
      now += slice;
      continue;
    }
    if (cur && cur.symbolId === active) {
      cur.durUs += slice;
    } else {
      if (cur) steps.push(cur);
      cur = {
        t: now,
        durUs: slice,
        plane: opts.plane,
        symbolId: active,
        depth: chain.length,
        stack: resolvedStack,
      };
    }
    now += slice;
  }
  if (cur) steps.push(cur);

  return {
    schemaVersion: 1,
    steps,
    planes: [{ plane: opts.plane, startUs: 0, durationUs: now }],
  };
}

/**
 * Concatenate per-plane timelines in wall-clock order (server before browser).
 * Steps keep their plane-relative `t`; each plane's `startUs` is the cumulative
 * offset, so a player orders globally with `plane.startUs + step.t`.
 */
export function mergeTimelines(...timelines: TraceTimeline[]): TraceTimeline {
  const steps: TraceTimeline["steps"] = [];
  const planes: TraceTimeline["planes"] = [];
  let startUs = 0;
  for (const tl of timelines) {
    steps.push(...tl.steps);
    for (const p of tl.planes) {
      planes.push({ plane: p.plane, startUs, durationUs: p.durationUs });
      startUs += p.durationUs;
    }
  }
  return { schemaVersion: 1, steps, planes };
}
