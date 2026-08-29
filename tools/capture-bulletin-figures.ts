import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Page } from "playwright";

const projectRoot = resolve(import.meta.dirname, "..");
const outputRoot = resolve(projectRoot, "research/figures");
const port = 5183;
const ownedBaseUrl = `http://127.0.0.1:${port}`;
const baseUrl = process.env.BULLETIN_BASE_URL ?? ownedBaseUrl;

type Capture = {
  name: string;
  query: string;
  viewport: { width: number; height: number };
};

const captures: Capture[] = [
  {
    name: "sprawlens-treemap-overview.png",
    query: "source=sprawlens&layout=treemap&seed=1&dark=false",
    viewport: { width: 1280, height: 800 },
  },
];

async function waitReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Preview is still starting.
    }
    await sleep(200);
  }
  throw new Error(`bulletin capture server not ready: ${url}`);
}

async function waitForConvergence(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged === true,
    undefined,
    { timeout: 90_000 },
  );
  // `true` can be observed between frame-budgeted solver batches. Give camera
  // fitting and deferred LOD one full quiet window, then require convergence
  // again before capturing the publication figure.
  await page.waitForTimeout(1_500);
  await page.waitForFunction(
    () => (window as unknown as { __sprawlensConverged?: boolean }).__sprawlensConverged === true,
    undefined,
    { timeout: 30_000 },
  );
}

let server: ChildProcess | undefined;
if (!process.env.BULLETIN_BASE_URL) {
  server = spawn(
    "pnpm",
    ["--filter", "@sprawlens/viz", "preview", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      stdio: "ignore",
      env: { ...process.env, SPRAWLENS_QUIET_PROXY: "1" },
    },
  );
}

try {
  await waitReady(baseUrl, 120_000);
  await mkdir(outputRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  for (const capture of captures) {
    const page = await browser.newPage({ viewport: capture.viewport });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/?${capture.query}`, { waitUntil: "domcontentloaded" });
    await waitForConvergence(page);
    if (errors.length > 0) throw new Error(`${capture.name}: ${errors.join("; ")}`);
    const path = resolve(outputRoot, capture.name);
    await page.screenshot({ path });
    process.stdout.write(`${path}\n`);
    await page.close();
  }
  await browser.close();
} finally {
  server?.kill("SIGTERM");
}
