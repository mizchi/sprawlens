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
    assertion:
      "This is a treemap layout: the canvas is filled with nested rectangular cells packed edge-to-edge with little empty space. It is NOT a circular or radial arrangement.",
  },
  {
    source: "sprawlens",
    layout: "rings",
    tag: "rings",
    assertion:
      "This is a radial 'rings' layout: cells are arranged in roughly concentric circular bands around a center point. It is NOT a grid of packed rectangles.",
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
