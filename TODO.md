# TODO

## Experimental features to finish

All gated behind `sprawlens serve --experimental` (or `?experimental=1`); see the
"exp on/off" chip in the viz. Each needs a decision + polish before it graduates.

- **Trace player** (`docs/design/2026-06-22-entrypoint-trace-player.md`)
  - v2a shipped: server recent-traces store (ring buffer) + `/api/traces`,
    `/api/traces/:id`, `/api/traces/stream` (SSE); external-watch source via
    `sprawlens serve --trace-watch [dir]` (drop a `.cpuprofile`); viz recent
    picker + auto-follow the newest capture.
  - v2b (in-app click-to-run capture, #22) not built yet — the player still
    only sees externally-dropped profiles.
  - Browser-plane capture (Playwright CDP profile) + merge is still TODO; only
    the server plane is wired.
  - Comet visuals are thin (edge trail sparse, heat over-saturates large cells).

- **Commit-log / history**
  - Decided: vertical (Git-client) layout is the default; the horizontal
    HistoryTimeline and the A/B toggle were dropped (4898ae1).
  - The vertical "graph" column is a single lane; draw real branch lanes if the
    history fixture carries parents.
  - Confirm shift-range highlight reads well at module vs symbol granularity.

- **Test reporter** (`docs/design/2026-06-21-test-reporter.md`)
  - Dot panel + selection log panel + failing-cell pulse are in.
  - Click-to-run output capture works; a re-run button is in the log panel
    (next to the double-click-the-cell gesture).
  - Decided: the on-map tint is the primary preview (the map is the focus); the
    dot panel stays as a secondary failures-first scan + jump.

- **VLM render eval** (`docs/design/2026-06-21-rendering-test-harness.md`)
  - Already opt-in (`pnpm test:render:vlm`, token-gated); default judge
    `google/gemini-2.5-flash`. Not part of the served app.

## CI preview images

- Generate atlas preview images on every code change so a diff's macro shape is
  visible at a glance (rendered from the live analysis of the current code).
