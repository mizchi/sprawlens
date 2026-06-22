import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { svgDiff } from "./svgSnapshot.ts";

// Each case pins a reproducible view by URL alone (nuqs); the layout is seeded
// and we wait for the converged signal before capturing. Baselines live under
// e2e/__svg__ and are compared with svgDiff: the skeleton (structure / attrs /
// colours / order) must match exactly, numbers within ~1.5px. That absorbs the
// sub-pixel convergence wobble (so rings and the large `sprawlens` fixture are
// reliable) while still failing on any real render change. Refresh baselines
// with `UPDATE_SVG=1 pnpm test:render`.
const BASELINE_DIR = join(dirname(fileURLToPath(import.meta.url)), "__svg__");

type Case = { source: string; layout: string; showEdges?: boolean; tag: string };
const CASES: Case[] = [
  { source: "synthetic", layout: "treemap", tag: "synthetic-treemap" },
  { source: "synthetic", layout: "rings", tag: "synthetic-rings" },
  { source: "synthetic", layout: "treemap", showEdges: true, tag: "synthetic-treemap-edges" },
  { source: "sprawlens", layout: "treemap", tag: "sprawlens-treemap" },
  { source: "sprawlens", layout: "rings", tag: "sprawlens-rings" },
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
    await page.waitForFunction(
      () => (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged === true,
      null,
      { timeout: 90_000 },
    );
    const svg = await page.evaluate(() => {
      const root = document.querySelector("[data-converged]");
      return root?.querySelector("svg")?.outerHTML ?? "";
    });
    expect(svg.length).toBeGreaterThan(0);

    const file = join(BASELINE_DIR, `${c.tag}.svg`);
    if (process.env.UPDATE_SVG) {
      mkdirSync(BASELINE_DIR, { recursive: true });
      writeFileSync(file, svg);
      return;
    }
    const baseline = readFileSync(file, "utf8");
    const diff = svgDiff(baseline, svg);
    expect(diff.ok, diff.ok ? "" : diff.reason).toBe(true);
  });
}
