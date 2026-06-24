import type { AtlasEdge, TraceTimeline } from "@sprawlens/schema";

/**
 * Project a TraceTimeline at a playback cursor onto the same {traceEdges,
 * traceHeat} the static overlay produces — but as a moving "comet": the step at
 * the cursor burns brightest, recently-active symbols fade behind it, and the
 * lit edges are the current call chain plus the path the cursor just travelled.
 * Feeding this into the existing trace overlay animates the execution path.
 */

const TRAIL = 24; // how many steps of tail the comet keeps
const DECAY = 0.85; // per-step heat falloff (0.85^24 ≈ 0.02)

export type TraceOverlayFrame = {
  traceEdges: AtlasEdge[];
  traceHeat: Map<string, number>;
};

const EMPTY: TraceOverlayFrame = { traceEdges: [], traceHeat: new Map() };

export function projectTimelineCursor(
  timeline: TraceTimeline | null,
  cursor: number,
): TraceOverlayFrame {
  if (!timeline || timeline.steps.length === 0) return EMPTY;
  const steps = timeline.steps;
  const c = Math.max(0, Math.min(cursor, steps.length - 1));

  const heat = new Map<string, number>();
  const edges = new Map<string, AtlasEdge>();
  const addEdge = (source: string, target: string) => {
    if (source === target) return;
    edges.set(`${source}\t${target}`, { source, target, kind: "call" });
  };

  const lo = Math.max(0, c - TRAIL);
  for (let i = lo; i <= c; i++) {
    const step = steps[i]!;
    const w = DECAY ** (c - i);
    if (step.symbolId) heat.set(step.symbolId, Math.max(heat.get(step.symbolId) ?? 0, w));
    // the transition the cursor took: previous active → this active
    const prev = steps[i - 1];
    if (prev?.symbolId && step.symbolId) addEdge(prev.symbolId, step.symbolId);
  }

  // the current call chain (caller→callee) — where execution *is* right now
  const top = steps[c]!;
  for (let j = 0; j < top.stack.length - 1; j++) addEdge(top.stack[j]!, top.stack[j + 1]!);

  return { traceEdges: [...edges.values()], traceHeat: heat };
}

/** Global wall-clock position of a step (plane offset + in-plane time), so the
 * scrubber and playback advance in real captured time across both planes. */
export function stepClockUs(timeline: TraceTimeline, index: number): number {
  const step = timeline.steps[index];
  if (!step) return 0;
  const plane = timeline.planes.find((p) => p.plane === step.plane);
  return (plane?.startUs ?? 0) + step.t;
}

/** Total captured wall-clock span across all planes. */
export function timelineDurationUs(timeline: TraceTimeline): number {
  return timeline.planes.reduce((sum, p) => sum + p.durationUs, 0);
}

/**
 * The wall-clock span actually populated by steps: the first step's clock to the
 * last step's clock. Unlike {@link timelineDurationUs} (the full plane duration,
 * which includes the pre-roll before the first sample and any trailing idle with
 * no steps), this is what playback should pace over — so the comet doesn't sit
 * still through dead head/tail time. 0 for fewer than two steps.
 */
export function timelineSpanUs(timeline: TraceTimeline): number {
  const n = timeline.steps.length;
  if (n < 2) return 0;
  return stepClockUs(timeline, n - 1) - stepClockUs(timeline, 0);
}
