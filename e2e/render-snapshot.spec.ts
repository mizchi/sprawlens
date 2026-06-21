import { test, expect } from "@playwright/test";
import { normalizeSvg } from "./svgSnapshot.ts";

// Each case pins a reproducible view by URL alone (nuqs); the layout is seeded
// and we wait for the converged signal before capturing, so the normalized SVG
// is a stable fingerprint. A refactor that changes the render fails here.
// Coverage spans the edge paths a refactor touches: the ambient mesh
// (showEdges), and the stacked satellite planes + cross-layer ropes (tilt).
type Case = {
  source: string;
  layout: string;
  showEdges?: boolean;
  tag: string;
};
const CASES: Case[] = [
  { source: "sprawlens", layout: "treemap", tag: "sprawlens-treemap" },
  { source: "sprawlens", layout: "rings", tag: "sprawlens-rings" },
  { source: "synthetic", layout: "treemap", tag: "synthetic-treemap" },
  { source: "synthetic", layout: "rings", tag: "synthetic-rings" },
  // ambient dependency mesh (the treemap file-edge loop draws it at the
  // default granularity; rings gates it behind file granularity, harder to pin)
  { source: "sprawlens", layout: "treemap", showEdges: true, tag: "sprawlens-treemap-edges" },
];

function urlFor(c: Case): string {
  const q = new URLSearchParams({ source: c.source, layout: c.layout, seed: "1" });
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
