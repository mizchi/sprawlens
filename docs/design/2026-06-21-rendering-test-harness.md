# Rendering-test harness for the viz

Status: Design (2026-06-21). Unblocks #1 Phase 5 (and any viz refactor) by
catching visual regressions; adds reproducible config URLs as a side benefit.

## Why

The viz has no rendering tests — every edge/layout refactor risked a silent
visual regression (the reason #1 Phase 5 was deferred). The map is also
stochastic-looking but actually deterministic (seeded), so a reproducible
capture is feasible. Two layers: a cheap deterministic structural snapshot that
gates refactors, and a VLM visual evaluation for intent-level checks a DOM diff
can't express.

## Determinism — the control mechanism

The placement is already seeded (mulberry32, `layout/src/rng.ts`); no
`Math.random`/`Date.now` in layout. `App.tsx` `SEED = 1` drives the outer
layouts, inner Voronoi uses `seed: 1`. Louvain is deterministic. Stepping is
iteration-based, not wall-clock. So a render is reproducible once three things
hold:

1. **Fixed seed.** Promote `SEED` to a `seed` parameter (default 1) threaded
   into the layout calls, so a render's randomness is pinned (and variable for
   stability testing).
2. **Settled state.** The solver converges by error threshold, not time; a
   capture mid-convergence differs. Expose an explicit signal — a
   `window.__sprawlensConverged` flag / `data-converged` attribute set when
   `isConverged` holds — for the harness to await (instead of scraping status
   text like the existing e2e).
3. **Normalized capture.** Serialize the top-level `<svg>` (`outerHTML`) and
   round coordinates (e.g. 1 decimal) so float jitter across runs/arches
   doesn't cause spurious diffs. The normalized SVG is the snapshot.

## Reproducible config via URL (nuqs)

The render-affecting settings become URL query state with **nuqs**, so a config
is shareable and a test can pin a state by URL alone — the harness's state
driver. Synced: `source`, `layout`, `boundaries`, `displayLevels`, `showEdges`,
`groupByService`, `dark`, `tilt` (enabled), `seed`. **Excluded:** camera
position, zoom, selection, hover — these are not reproducible and stay local.

`params` is assembled from nuqs URL state (the synced settings) plus the
remaining local UI state. nuqs targets React; the viz is Preact, but
`@preact/preset-vite` aliases `react` → `preact/compat`. **Risk:** nuqs v2 leans
on `useSyncExternalStore`/`startTransition`; a feasibility spike runs first. If
it fails under preact/compat, fall back to plain `URLSearchParams` sync — same
design (URL ⇄ settings), different plumbing.

## Capture & evaluation

- **Layer 1 — deterministic structural snapshot (no token).** Playwright loads
  `/atlas.html?source=…&layout=…&seed=1&tilt=…`, awaits the converged signal,
  serializes + normalizes the `<svg>`, and snapshots it. Any change to the
  rendered SVG (attrs, paths, structure) fails the test — the refactor-safety
  net. Lives in `e2e/` reusing `playwright.atlas.config.ts`.
- **Layer 2 — VLM visual evaluation (vlmkit + ui-tars).** Screenshot the
  converged viz to PNG; hand it to `@mizchi/vlmkit` (its `/playwright` export or
  CLI) with a natural-language expectation (e.g. "the runtime-trace path is lit
  in warm orange", "test cells read green/red/grey", "labels don't overlap"),
  evaluated by **ui-tars** via OpenRouter. Reads `OPENROUTER_API_KEY` +
  `VLM_MODEL` from the env (wired by the user's home-manager, not read here);
  **skipped when `OPENROUTER_API_KEY` is unset** so Layer 1 always runs.

## Phasing

- **Phase 1 — deterministic snapshot.** nuqs feasibility spike → migrate the
  render-affecting settings to URL state (or URLSearchParams fallback) → `seed`
  param + converged signal → `e2e/` snapshot spec covering rings & treemap on a
  fixed fixture, with SVG normalization. Unblocks #1 Phase 5.
- **Phase 2 — VLM evaluation.** vlmkit integration: capture PNG → ui-tars
  expectations for the trace / test-reporter / edge overlays; token-gated.

## Out of scope

- Cross-machine pixel-exact PNG baselines (float/font drift); Layer 1 uses
  normalized SVG, Layer 2 uses VLM judgment, neither needs pixel equality.
- URL-syncing ephemeral state (camera/selection) — deliberately excluded.
