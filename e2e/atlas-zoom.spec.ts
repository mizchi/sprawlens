// vendored lightbringer build (see e2e/vendor/README.md); importing the
// sibling checkout directly pulled a second @playwright/test instance
// from its node_modules, which playwright rejects
// @ts-expect-error vendored module has no type declarations
import { test, expect } from "./vendor/lightbringer.mjs";
import type { Page } from "@playwright/test";

// Zoom-in/out scenario on the playwright-sized atlas map, measured per step
// with lightbringer (network / cpu / render / INP). Used to chase the crash
// reported during interactive zooming.

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

test.describe("atlas zoom scenario (playwright fixture)", () => {
  test("zoom in / out cycles", async ({ page, perf }) => {
    let crashed: Error | null = null;
    page.on("crash", () => {
      crashed = new Error("page crashed (renderer died)");
    });

    await perf.measure("initial-load", async () => {
      await page.goto("/atlas.html");
      await expect(page.locator("svg polygon").first()).toBeVisible();
    });

    await perf.measure("load-playwright-data", async () => {
      // the data <select> is the one offering the playwright option
      const select = page
        .locator("select", {
          has: page.locator('option[value="playwright"]'),
        })
        .first();
      await select.selectOption("playwright");
      await page.waitForFunction(
        () => document.querySelectorAll("polygon").length > 1000,
        undefined,
        { timeout: 60_000 },
      );
    });

    await perf.measure("wait-converge", async () => {
      // open the floating stats section and wait for the solver to settle
      await page.locator("summary", { hasText: "ステータス" }).click();
      await expect(
        page.locator("details", { hasText: "max relative error" }),
      ).toContainText("(converged)", { timeout: 120_000 });
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

    // pan around at mid zoom, another reported trigger
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
