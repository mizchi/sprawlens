import { test, expect } from "@playwright/test";
import { hasVlmKey, openRouterReviewer, vlmModel } from "./vlmReview.ts";

// Layer 2: judge the converged render against a natural-language expectation
// with a vision model (Layer 1 pins exact geometry; this pins what the picture
// *means*). Token-gated — skipped entirely unless OPENROUTER_API_KEY is set, so
// Layer 1 always runs. Each case pins a reproducible view by URL (seeded +
// converged signal) exactly like the SVG snapshots.
test.skip(!hasVlmKey(), "OPENROUTER_API_KEY unset — Layer 2 VLM eval skipped");

const reviewer = openRouterReviewer();

type Case = { source: string; layout: string; tag: string; assertion: string };
const CASES: Case[] = [
  {
    source: "sprawlens",
    layout: "treemap",
    tag: "treemap",
    // sprawlens' "treemap" is a capacity-Voronoi space-filling map (organic
    // polygonal cells, rounded district silhouettes), not a rectangular
    // treemap — so the assertion describes the real picture: a packed mosaic of
    // adjacent labelled cells. Still meaningful: catches a blank render, a
    // collapsed/empty field, or labels overlapping into illegibility.
    assertion:
      "This is a space-filling 'map' visualization: the area is filled with many adjacent cells/regions packed together sharing borders (a mosaic). Text labels for code modules such as 'atlas' and 'core' are visible and readable, not overlapping into an illegible blur.",
  },
  {
    source: "sprawlens",
    layout: "rings",
    tag: "rings",
    assertion:
      "This is a radial layout: most cells are clustered inside a large circular boundary around a center point, with connector lines, and module labels such as 'atlas' are visible. It is NOT a single rectangular grid.",
  },
];

function urlFor(c: Case): string {
  const q = new URLSearchParams({ source: c.source, layout: c.layout, seed: "1" });
  return `/?${q.toString()}`;
}

for (const c of CASES) {
  test(`vlm ${c.tag} (${vlmModel()})`, async ({ page }) => {
    await page.goto(urlFor(c));
    await page.waitForFunction(
      () => (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged === true,
      null,
      { timeout: 90_000 },
    );
    const png = await page.screenshot();
    const verdict = await reviewer({ assertion: c.assertion, image: png });
    expect(verdict.pass, `${verdict.reasoning} (confidence ${verdict.confidence ?? "?"})`).toBe(true);
  });
}
