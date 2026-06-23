/**
 * Render preview images of the atlas for the current code, so a change's macro
 * shape is visible at a glance (e.g. uploaded as a CI artifact on every PR).
 * Boots the real CLI server on this repo — a live analysis, not the committed
 * fixture — and screenshots a few views to PNG.
 *
 *   pnpm build && npx tsx e2e/capturePreview.mts   # writes preview/*.png
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const cli = join(repoRoot, "packages/cli/src/index.ts");
const outDir = join(repoRoot, "preview");
const PORT = 4790;
const base = `http://127.0.0.1:${PORT}`;

const VIEWS = [
  {
    tag: "treemap",
    query: "source=served&layout=treemap&seed=1&displayLevels=module,class,symbol",
  },
  { tag: "rings", query: "source=served&layout=rings&seed=1&displayLevels=module,class,symbol" },
];

mkdirSync(outDir, { recursive: true });

async function waitReady(url: string, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error(`server not ready at ${url}`);
}

console.log("[preview] booting server (live analysis)…");
const server = spawn(
  process.execPath,
  ["--import", "tsx", cli, "serve", repoRoot, "--port", String(PORT), "--no-open"],
  { cwd: repoRoot, stdio: ["ignore", "inherit", "inherit"] },
);

try {
  await waitReady(`${base}/api/snapshot`, 180_000);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });
  for (const view of VIEWS) {
    await page.goto(`${base}/?${view.query}`);
    await page.waitForFunction(
      () => (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged === true,
      null,
      { timeout: 90_000 },
    );
    await page.waitForTimeout(400);
    const file = join(outDir, `atlas-${view.tag}.png`);
    await page.screenshot({ path: file });
    console.log(`[preview] wrote ${file}`);
  }
  await browser.close();
} finally {
  server.kill("SIGTERM");
}
