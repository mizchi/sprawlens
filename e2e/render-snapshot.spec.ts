import { test, expect } from "@playwright/test";
import { normalizeSvg } from "./svgSnapshot.ts";

// Each case pins a reproducible view by URL alone (nuqs); the layout is seeded
// and we wait for the converged signal before capturing, so the normalized SVG
// is a stable fingerprint. A refactor that changes the render fails here.
const CASES = [
  { source: "sprawlens", layout: "treemap" },
  { source: "sprawlens", layout: "rings" },
  { source: "synthetic", layout: "treemap" },
  { source: "synthetic", layout: "rings" },
] as const;

for (const { source, layout } of CASES) {
  test(`render ${source}/${layout}`, async ({ page }) => {
    await page.goto(`/?source=${source}&layout=${layout}&seed=1`);
    // settled signal: the solver stopped advancing on a built layout
    await page.waitForFunction(
      () => (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged === true,
      null,
      { timeout: 90_000 },
    );
    // the map's own <svg> (inside the data-converged container), not an icon
    const svg = await page.evaluate(() => {
      const root = document.querySelector("[data-converged]");
      return root?.querySelector("svg")?.outerHTML ?? "";
    });
    expect(svg.length).toBeGreaterThan(0);
    expect(normalizeSvg(svg)).toMatchSnapshot(`${source}-${layout}.svg`);
  });
}
