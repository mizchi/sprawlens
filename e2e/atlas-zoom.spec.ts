import { expect, test } from "lightbringer";
import type { Page } from "@playwright/test";

// Zoom-in/out + pan scenario on the sprawlens atlas map, measured per step with
// lightbringer (network / cpu / render / INP / memory). Originally chased the
// crash reported during interactive zooming; the per-step memory gauges also
// surface any heap/listener growth across a zoom session (run PERF_MEM=1).

const READY_URL = "/?source=sprawlens&layout=treemap&seed=1";

/** The rendering harness flips this once the capacity layout settles. */
async function waitConverged(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged === true,
    null,
    { timeout: 120_000 },
  );
}

/** Trackpad-ish zoom gesture: N wheel ticks at the viewport center. */
async function zoomGesture(page: Page, deltaY: number, ticks: number) {
  const box = (await page.locator("svg").first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < ticks; i++) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(16); // ~1 tick per frame, like a real gesture
  }
}

const polygonCount = (page: Page) =>
  page.evaluate(() => document.querySelectorAll("polygon").length);

test.describe("atlas zoom scenario", () => {
  test("zoom in / out cycles", async ({ page, perf }) => {
    let crashed: Error | null = null;
    page.on("crash", () => {
      crashed = new Error("page crashed (renderer died)");
    });

    await perf.measure("initial-load", async () => {
      await page.goto(READY_URL);
      await expect(page.locator("svg polygon").first()).toBeVisible();
      await waitConverged(page);
    });

    await perf.measure("zoom-in-deep", async () => {
      await zoomGesture(page, -300, 30);
      await page.waitForTimeout(300); // settle → LOD commit
    });

    await perf.measure("zoom-out-full", async () => {
      await zoomGesture(page, 300, 30);
      await page.waitForTimeout(300);
    });

    for (let cycle = 0; cycle < 3; cycle++) {
      await perf.measure(`zoom-cycle-${cycle}`, async () => {
        await zoomGesture(page, -300, 25);
        await zoomGesture(page, 300, 25);
        await page.waitForTimeout(300);
      });
      expect(crashed, `cycle ${cycle}`).toBeNull();
    }

    // pan around at mid zoom, another reported crash trigger
    await perf.measure("pan-at-mid-zoom", async () => {
      await zoomGesture(page, -300, 12);
      const box = (await page.locator("svg").first().boundingBox())!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      for (let i = 0; i < 4; i++) {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 300, cy + 200, { steps: 12 });
        await page.mouse.up();
      }
      await page.waitForTimeout(300);
    });

    expect(crashed).toBeNull();
    expect(await polygonCount(page)).toBeGreaterThan(0);
  });
});
