import { expect, test } from "lightbringer";
import type { Page } from "@playwright/test";

// Per-step memory profile of the sprawlens atlas. Two shapes:
//   1. static per-step deltas across a sequence of view changes, and
//   2. measureRepeat toggles, whose monotonic heap / listener / DOM growth is
//      the real leak signal (a single delta can't be told apart from GC noise).
// SPA-internal state transitions are driven by keybinds (r/t = layout, e =
// edges; see vizCommands.ts) so each step re-layouts in place instead of
// reloading. Run PERF_MEM=1 for retained-only (post-GC) deltas, and add
// --repeat-each=5 + the median gate (scripts/median.mjs) for stable numbers.

const READY_URL = "/?source=sprawlens&layout=treemap&seed=1";

/** The rendering harness flips this once the capacity layout settles. */
async function waitConverged(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged === true,
    null,
    { timeout: 120_000 },
  );
}

async function loadAtlas(page: Page) {
  await page.goto(READY_URL);
  await expect(page.locator("svg polygon").first()).toBeVisible();
  await waitConverged(page);
}

// Press a keybind, let the solver flip to active (re-layout), then wait for it
// to settle again so the step's memory delta covers the whole transition.
async function key(page: Page, k: string) {
  await page.keyboard.press(k);
  await page.waitForTimeout(60);
  await waitConverged(page);
}

test.describe("atlas memory profile", () => {
  test("per-step view changes", async ({ page, perf }) => {
    await perf.measure("initial-load", () => loadAtlas(page));
    await perf.measure("layout->rings", () => key(page, "r"));
    await perf.measure("edges->on", () => key(page, "e"));
    await perf.measure("layout->treemap", () => key(page, "t"));
    await perf.measure("edges->off", () => key(page, "e"));
  });

  test("layout-toggle leak", async ({ page, perf }) => {
    await perf.measure("initial-load", () => loadAtlas(page));
    // rings <-> treemap each cold-warm re-layouts the whole map; if warm-start
    // state or listeners accumulate, heap/listeners climb monotonically here.
    await perf.measureRepeat(
      "layout-toggle",
      async () => {
        await key(page, "r");
        await key(page, "t");
      },
      { times: 5 },
    );
  });

  test("edges-toggle leak", async ({ page, perf }) => {
    await perf.measure("initial-load", () => loadAtlas(page));
    // toggling dependency edges rebuilds the edge scene each time; watch for
    // SVG node / listener growth that never comes back down.
    await perf.measureRepeat(
      "edges-toggle",
      async () => {
        await key(page, "e");
        await key(page, "e");
      },
      { times: 5 },
    );
  });
});
