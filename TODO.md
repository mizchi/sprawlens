# TODO

## Experimental features to finish

All gated behind `sprawlens serve --experimental` (or `?experimental=1`); see the
"exp on/off" chip in the viz. Each needs a decision + polish before it graduates.

- **Trace player** (`docs/design/2026-06-22-entrypoint-trace-player.md`)
  - Recorded replay proved low-value; the intended direction is dynamic capture
    tied to test runs (v2: recent-traces store + external watch + click-to-run,
    pick from recent N). v2a/v2b not built yet.
  - Browser-plane capture (Playwright CDP profile) + merge is still TODO; only
    the server plane is wired.
  - Comet visuals are thin (edge trail sparse, heat over-saturates large cells).
  - Decide: build v2, or retire the player.

- **Commit-log / history** 
  - Vertical (right) and horizontal (bottom) layouts both exist for A/B — pick
    one as the default and drop the toggle.
  - The vertical "graph" column is a single lane; draw real branch lanes if the
    history fixture carries parents.
  - Confirm shift-range highlight reads well at module vs symbol granularity.

- **Test reporter** (`docs/design/2026-06-21-test-reporter.md`)
  - Dot panel + selection log panel + failing-cell pulse are in.
  - Click-to-run output capture works; surface a re-run button in the log panel.
  - Decide whether the dot panel or the on-map tint is the primary preview.

- **VLM render eval** (`docs/design/2026-06-21-rendering-test-harness.md`)
  - Already opt-in (`pnpm test:render:vlm`, token-gated); default judge
    `google/gemini-2.5-flash`. Not part of the served app.

## CI preview images

- Generate atlas preview images on every code change so a diff's macro shape is
  visible at a glance (rendered from the live analysis of the current code).
