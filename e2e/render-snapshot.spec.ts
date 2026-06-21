import { test, expect } from "@playwright/test";
import { normalizeSvg } from "./svgSnapshot.ts";

// Each case pins a reproducible view by URL alone (nuqs); the layout is seeded
// and we wait for the converged signal before capturing, so the normalized SVG
// is a stable fingerprint. A refactor that changes the render fails here.
//
// Why synthetic-only: the solver steps within a wall-clock budget and stops at
// the production tolerance (0.02), so a large fixture's final coordinates wobble
// sub-pixel with machine timing — not a fixed point. The synthetic graph is
// small enough to fully settle every frame, so its capture IS deterministic.
// It exercises the same render code (rings/treemap, cells, the ambient edge
// mesh), which is what a refactor changes; real-fixture geometry is out of scope
// until the solver can be driven to a deep fixed point in a test mode.
type Case = {
  layout: string;
  showEdges?: boolean;
  tag: string;
};
const CASES: Case[] = [
  { layout: "treemap", tag: "synthetic-treemap" },
  { layout: "rings", tag: "synthetic-rings" },
  // ambient dependency mesh (the file-edge loop)
  { layout: "treemap", showEdges: true, tag: "synthetic-treemap-edges" },
];

function urlFor(c: Case): string {
  const q = new URLSearchParams({ source: "synthetic", layout: c.layout, seed: "1" });
  if (c.showEdges) q.set("showEdges", "true");
  return `/?${q.toString()}`;
}

for (const c of CASES) {
  test(`render ${c.tag}`, async ({ page }) => {
    await page.goto(urlFor(c));
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
    expect(normalizeSvg(svg)).toMatchSnapshot(`${c.tag}.svg`);
  });
}
