# Entry-point execution-trace player

Capture sprawlens' own execution — from the CLI entry point through to the
browser render — and replay it as a **time-ordered, animated path** over the
atlas. Approach C (hybrid): ship a sampled-timeline player now, with a data
model shaped so a live debugger can drive the same player later.

## Goal & non-goal

- **Goal**: run sprawlens on the sprawlens repo, record what executed (server
  side: entry → analyze → serve; browser side: viz render), and scrub/play the
  execution path in the dev viz — the active symbol pulses, the caller→callee
  edge lights warm-orange, a trail decays behind it.
- **Non-goal (Phase 1)**: stitching call stacks across the HTTP boundary into
  one cross-runtime stack; precise enter/exit of every fast call; live debugger
  stepping (Phase 2).

## What already exists (reuse)

Mapped in exploration — the _ingest_ side is built:

- Contract `Trace`/`TraceNode`/`TraceEdge` + `resolveTraceSymbols()`
  (`packages/schema/src/core/trace.ts`) joins frames to snapshot symbols by
  (file, name, line) via `buildSymbolResolver()`.
- Adapters parse `.cpuprofile` (`packages/analyzer-ts/src/trace.ts`,
  `parseCpuProfile`), V8 coverage, llvm-cov, folded stacks.
- Viz renders trace edges + heat (warm orange `#ff7a1a`) in `RingsMapSvg` /
  `TreemapSvg` via `SceneEdges.trace` / `traceHeat`.
- `/api/trace` serves a `Trace`; CLI `--trace <path>` ingests one.

**Missing** = (1) a _capture driver_ that records sprawlens' own run, and (2) a
_time-ordered_ model + player. The existing `Trace` is aggregate (heat/counts),
not ordered — so the timeline is a new, parallel artifact.

## Data model (new contract)

`packages/contracts/src/traceTimeline.ts` — ordered, resolvable, plane-tagged.
The cpuprofile sample stream is already time-ordered (`samples` + `timeDeltas`);
we collapse consecutive identical stack-tops into spans to keep the step count
navigable.

```ts
export type TracePlane = "server" | "browser";

export interface TraceStep {
  /** microseconds from this plane's capture start (monotonic within plane) */
  t: number;
  /** CPU time the stack-top held before the next distinct step (collapsed span) */
  durUs: number;
  plane: TracePlane;
  /** resolved top-of-stack symbol id, or null for unresolved/library frames */
  symbolId: string | null;
  /** call depth of the sampled stack */
  depth: number;
  /** resolved stack ids caller→callee — drives the edge trail and future debugger */
  stack: (string | null)[];
}

export interface TraceTimeline {
  /** ordered server steps, then browser steps (wall-clock: server boots first) */
  steps: TraceStep[];
  /** per-plane wall-clock spans so the player can show the phase boundary */
  planes: { plane: TracePlane; startUs: number; durationUs: number }[];
}
```

`schema/src/core/traceTimeline.ts` builds a `TraceTimeline` from a parsed
cpuprofile + the snapshot resolver: walk samples in order, map each node id →
callFrames → `resolveTraceSymbols` ids, collapse runs of identical top symbol
into one step. Library-only spans (all-null stack) are dropped or merged so the
animation stays on first-party code.

### Step granularity (decision)

- Collapse consecutive samples whose **top resolved symbol** is unchanged into
  one step (a span). This turns ~10⁴ raw samples into ~10²–10³ navigable steps.
- Drop spans shorter than a floor (e.g. `< 1` sample after collapse is already
  impossible; additionally merge spans whose top symbol is `null`/library into
  the surrounding first-party step so the trail doesn't blink into the void).
- Keep the full resolved `stack` per step for depth shading and Phase 2.

## Capture harness (Playwright e2e)

New `e2e/trace-self.spec.ts` + `playwright.trace.config.ts`. Runs the **real**
CLI on the sprawlens repo (not the static fixture) so the entry path is real.

**Browser plane is captured against the vite _dev_ server (unbundled ESM), not
the production bundle**, so `callFrame.url` resolves to real source files
without sourcemaps. (Resolving the minified production bundle via sourcemap is a
later option; dev is what "確認したい開発環境" means anyway.)

1. **Server plane**: spawn the sprawlens server with an in-process inspector
   `Profiler` (Node `node:inspector` `Session`: `Profiler.enable` +
   `Profiler.start`, write the profile on `SIGINT`). A thin capture entry wraps
   the existing serve boot so the profile flushes deterministically on shutdown
   — more reliable than `--cpu-prof` + signal timing. Output:
   `e2e/__trace__/self-server.cpuprofile`.
   - Risk to validate first: getting a clean flush on shutdown and that the
     entry/analyze frames (not just the idle server loop) are in the samples —
     capture must start _before_ analyze runs.
2. **Browser plane**: Playwright `context.newCDPSession(page)` →
   `Profiler.enable` → `Profiler.start` → `goto` the dev server → wait
   `__sprawlensConverged` → `Profiler.stop` returns the profile. Output:
   `e2e/__trace__/self-browser.cpuprofile`.
3. **Resolve + merge**: parse both profiles, build per-plane `TraceTimeline`
   against the sprawlens snapshot, concatenate (server then browser), write
   `e2e/__trace__/self-timeline.json`.

Driven by a task: `pnpm test:trace` (and `:update` to refresh the saved
timeline), mirroring the render harness.

## Dev viewing & wiring

- The saved `self-timeline.json` loads in dev as a fixture (like the `sprawlens`
  snapshot source) — a new data source `served`/`trace-self`, or a
  `--trace-timeline <path>` CLI flag served at `/api/trace-timeline`. Phase 1
  picks the fixture path (no server change needed to view).
- `App.tsx` fetches the timeline alongside the existing `/api/trace`.

## Viz: the trace player

- **Cursor**: ephemeral component state `timelineCursor` (step index) +
  play/pause + speed. Like camera/selection, it is **not** URL-synced (excluded
  per the render-affecting-settings rule).
- **Drive the existing overlay from the cursor** instead of the static
  aggregate: the active step's `symbolId` cell pulses; the last _N_ steps'
  caller→callee pairs render as warm-orange edges (reusing `BundledEdges` /
  `SceneEdges.trace`), opacity decaying with age → a moving comet trail.
- **Plane phase**: a scrubber marked with the server→browser boundary; a label
  shows the current plane.
- **Playback**: `requestAnimationFrame` advances the cursor by wall-clock-scaled
  `durUs` (with a speed multiplier); scrubbing seeks.

## Phase 2 (design only — debugger)

The player consumes a **cursor over an ordered step stream**. A live CDP
`Debugger` (paused events: current frame + call stack) emits the same
`TraceStep` shape in real time. Phase 2 swaps the recorded timeline for a live
stream and adds step/continue controls — no player rewrite. The `stack` field is
already the debugger's call stack.

## Verification (TDD)

- **Contract/schema**: feeding a hand-built ordered cpuprofile to the timeline
  builder yields the expected ordered, collapsed, symbol-resolved steps
  (including: null/library spans merged, span durations summed).
- **Capture**: `pnpm test:trace` produces a non-empty `self-timeline.json` with
  both planes present and a non-trivial fraction of steps resolved to real
  sprawlens symbols (entry-point symbols appear early in the server plane).
- **Player**: a focused test that setting `timelineCursor = k` lights the
  expected cell + trail; playback advances monotonically and stops at the end.
- Gates unchanged: `pnpm test` / typecheck / check-layers / lint:exports.

## Out of scope

- Cross-runtime stack stitching; production-bundle (sourcemap) browser
  resolution; sub-sample precise call enter/exit; persisting timelines beyond
  the dev fixture.

## Phasing

1. **Phase 1**: `TraceTimeline` contract + builder; capture harness
   (server inspector profile + browser CDP profile) saving the fixture; the
   cursor-driven player (scrub + play, two planes, comet trail). Dogfoods on
   sprawlens itself.
2. **Phase 2**: live CDP `Debugger` driving the same player; step/continue.

---

## Revision (v2): dynamic capture tied to test runs

Feedback after Phase 1: replaying one baked recording is not useful. The value
is in **fresh** traces tied to activity, with the **recent ones reviewable**.
Decisions: trigger from **both** an in-app test run and an external watcher;
**play after the run completes** (not live-streamed); pick from the **recent N**
captures. The Phase 1 player (projection + playback + scrubber) is reused
unchanged — only the _source_ of timelines changes from a baked fixture to a
live store.

### Server: a recent-traces store

`@sprawlens/server` keeps an in-memory ring buffer of the last N (≈10)
`TraceTimeline`s, each with `{ id, label, capturedAt, stepCount, planes }`.

- `GET /api/traces` → the list (metadata only).
- `GET /api/traces/:id` → one full timeline.
- `GET /api/traces/stream` (SSE) → ping on each new capture, so the viz refreshes
  the list and can auto-select the newest.

### Capture sources (both feed the store)

1. **External watch** — watch a drop dir (default `.sprawlens/traces/`, configurable
   via `--trace-watch <dir>`). A test command configured to emit a `.cpuprofile`
   there (e.g. `vitest` under `node --cpu-prof`, or a per-test profile) lands a
   file; the server builds a timeline against the current snapshot and pushes it
   to the store, labelled by filename. Decoupled and editor-agnostic.
2. **In-app click-to-run** — extend the existing `runTestCase` (#22): run the
   chosen case under `--cpu-prof`, build a timeline for that run, push to the
   store, and return its id alongside the test result so the viz auto-selects it.

Both reuse `buildTraceTimeline` + the snapshot resolver; server-only (a future
browser plane can be merged when a captured run drives a page).

### Viz: recent picker + auto-follow

- Fetch `/api/traces` for the recent list; subscribe to `/api/traces/stream`.
- A small picker (recent N, newest first, labelled) selects one → fetch its
  timeline → load into the existing player.
- On a new capture, refresh the list; auto-select+play the newest unless the user
  pinned an older one.
- The baked `/self-timeline.json` fixture stays as a zero-setup demo fallback.

### Phasing (revised)

- **v2a** (done, 2026-06-24): server trace store (`createTraceStore` ring buffer)
  - endpoints (`/api/traces`, `/api/traces/:id`, `/api/traces/stream` SSE) +
    external-watch source (`sprawlens serve --trace-watch [dir]`, the CLI builds a
    timeline against the live snapshot and the server stores/serves it); viz recent
    picker (`TraceRecentPicker`) + SSE auto-follow of the newest capture. Delivers
    "dynamic + recent" with any test runner that drops a `.cpuprofile`.
- **v2b**: click-to-run capture integration (#22) for in-app triggering.
- **Phase 2** (unchanged): live CDP debugger driving the player.
