// Ordered execution timeline: the time-resolved counterpart to the aggregate
// Trace. Where Trace collapses a run into heat + edge counts, a TraceTimeline
// keeps the sample order so the viz can *replay* the path the program took —
// the active symbol advancing step by step, a caller→callee trail behind it.
// Built from the ordered V8 cpuprofile sample stream (samples + timeDeltas).
// See docs/design/2026-06-22-entrypoint-trace-player.md.

/** Which runtime the steps came from. */
export type TracePlane = "server" | "browser";

/** One navigable step: a run of consecutive samples sharing a top first-party
 * symbol, collapsed into a span. */
export type TraceStep = {
  /** Microseconds from this plane's capture start (monotonic within a plane). */
  t: number;
  /** CPU time the span held before the next distinct step. */
  durUs: number;
  plane: TracePlane;
  /** Deepest first-party (resolved) symbol on the sampled stack — the code
   * "currently executing". Null only when the whole stack is library/runtime. */
  symbolId: string | null;
  /** Sampled call depth (full stack, including unresolved frames). */
  depth: number;
  /** Resolved stack caller→callee (unresolved frames dropped); the last entry is
   * `symbolId`. Drives the edge trail and the future debugger's call stack. */
  stack: string[];
};

export type TraceTimeline = {
  schemaVersion: 1;
  /** Ordered: each plane's steps in capture order, planes in wall-clock order
   * (server boots before the browser renders). */
  steps: TraceStep[];
  /** Per-plane wall-clock spans, so the player can mark the phase boundary. */
  planes: { plane: TracePlane; startUs: number; durationUs: number }[];
};
