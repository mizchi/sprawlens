import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  buildAstDiffRenderSnapshot,
  type AstDiffRenderGoldSet,
} from "../packages/viz/src/astDiffRenderFixture.ts";
import {
  summarizeAstDiffRenderTrials,
  type AstDiffRenderTrial,
} from "../packages/viz/src/astDiffRenderPerf.ts";

type Variant = {
  id: "v1" | "v2" | "v3";
  label: string;
  dataset: string;
};

const VARIANTS: Variant[] = [
  {
    id: "v1",
    label: "declarations",
    dataset: "research/datasets/ast-diff-confirmatory-v1-phase1.json",
  },
  {
    id: "v2",
    label: "+ non-export variables",
    dataset: "research/datasets/ast-diff-extraction-v2-posthoc.json",
  },
  {
    id: "v3",
    label: "+ registration regions",
    dataset: "research/datasets/ast-diff-registration-v3-posthoc.json",
  },
];
const SCENARIOS = [
  { id: "actual-overview", repeat: 1 },
  {
    id: "actual-zoomed",
    repeat: 1,
    wheelDeltaY: -1_200,
  },
  { id: "stress-4x-overview", repeat: 4 },
] as const;
const TRIALS = Math.max(3, Number.parseInt(process.env.AST_DIFF_RENDER_TRIALS ?? "7", 10));
const SLOW_FRAME_THRESHOLD_MS = 20;
const INITIAL_FRAMES_TO_SKIP = 8;
const OVERVIEW_SAMPLE_FRAMES = 30;
const ZOOM_SAMPLE_FRAMES = 20;
const READY_URL =
  "/?source=served&layout=treemap&seed=1&boundaries=module,file&displayLevels=module,symbol";
const execFileAsync = promisify(execFile);

test("AST diff extraction render-density experiment", async ({ browser }) => {
  test.slow();
  const goldSets = new Map<string, AstDiffRenderGoldSet>();
  for (const variant of VARIANTS) {
    goldSets.set(
      variant.id,
      JSON.parse(await readFile(resolve(variant.dataset), "utf8")) as AstDiffRenderGoldSet,
    );
  }
  const rows: Array<{
    scenario: string;
    repeat: number;
    variant: string;
    label: string;
    inputFiles: number;
    inputSymbols: number;
    raw: AstDiffRenderTrial[];
    summary: ReturnType<typeof summarizeAstDiffRenderTrials>;
  }> = [];

  for (const scenario of SCENARIOS) {
    const wheelDeltaY = "wheelDeltaY" in scenario ? scenario.wheelDeltaY : undefined;
    const snapshots = new Map(
      VARIANTS.map((variant) => {
        const snapshot = buildAstDiffRenderSnapshot(goldSets.get(variant.id)!, {
          repeat: scenario.repeat,
        });
        return [variant.id, snapshot] as const;
      }),
    );
    // One unrecorded warmup per variant primes browser/JIT/assets.
    for (const variant of VARIANTS) {
      await measurePage(browser, snapshots.get(variant.id)!, wheelDeltaY);
    }
    const rawByVariant = new Map(
      VARIANTS.map((variant) => [variant.id, [] as AstDiffRenderTrial[]]),
    );
    // Rotate the starting variant each round to avoid ordering all v3 trials last.
    for (let round = 0; round < TRIALS; round++) {
      for (let offset = 0; offset < VARIANTS.length; offset++) {
        const variant = VARIANTS[(round + offset) % VARIANTS.length]!;
        rawByVariant
          .get(variant.id)!
          .push(await measurePage(browser, snapshots.get(variant.id)!, wheelDeltaY));
      }
    }
    for (const variant of VARIANTS) {
      const snapshot = snapshots.get(variant.id)!;
      const raw = rawByVariant.get(variant.id)!;
      const summary = summarizeAstDiffRenderTrials(raw, {
        slowFrameThresholdMs: SLOW_FRAME_THRESHOLD_MS,
      });
      expect(summary.renderMs.p50).toBeGreaterThan(0);
      expect(summary.svgNodes.p50).toBeGreaterThan(0);
      rows.push({
        scenario: scenario.id,
        repeat: scenario.repeat,
        variant: variant.id,
        label: variant.label,
        inputFiles: snapshot.nodes.filter((node) => node.type === "file").length,
        inputSymbols: snapshot.nodes.reduce((sum, node) => sum + (node.symbols?.length ?? 0), 0),
        raw,
        summary,
      });
    }
  }

  const [{ stdout: implementationRevision }, { stdout: implementationStatus }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"]),
    execFileAsync("git", ["status", "--short", "--untracked-files=no"]),
  ]);
  const output = {
    schemaVersion: 1,
    status: "exploratory; no preregistered performance threshold",
    trialsPerCondition: TRIALS,
    warmupsPerCondition: 1,
    slowFrameThresholdMs: SLOW_FRAME_THRESHOLD_MS,
    initialFramesSkipped: INITIAL_FRAMES_TO_SKIP,
    overviewSampleFrames: OVERVIEW_SAMPLE_FRAMES,
    zoomSampleFrames: ZOOM_SAMPLE_FRAMES,
    browser: browser.version(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    implementationRevision: implementationRevision.trim(),
    implementationDirty: implementationStatus.trim().length > 0,
    rows,
  };
  const outputRoot = resolve("research/results");
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeAtomic(
      resolve(outputRoot, "ast-diff-render-performance.json"),
      `${JSON.stringify(output, null, 2)}\n`,
    ),
    writeAtomic(resolve(outputRoot, "ast-diff-render-performance.md"), renderMarkdown(output)),
  ]);
});

async function measurePage(
  browser: Browser,
  snapshot: ReturnType<typeof buildAstDiffRenderSnapshot>,
  wheelDeltaY?: number,
): Promise<AstDiffRenderTrial> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await installProbe(page);
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pathname === "/api/snapshot" ? snapshot : {}),
      });
    });
    await page.goto(READY_URL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("svg polygon").first()).toBeVisible();
    await waitAnimationFrames(page, INITIAL_FRAMES_TO_SKIP);
    if (wheelDeltaY !== undefined) {
      const mapSvg = page.locator("svg[data-geometry-fingerprint]");
      const initialViewBox = await mapSvg.getAttribute("viewBox");
      await page.evaluate(() => {
        const probe = (
          window as unknown as {
            __astDiffRenderProbe: {
              startedAt: number;
              measuredRenderMs: number;
              frameIntervalsMs: number[];
              longTaskDurationsMs: number[];
            };
          }
        ).__astDiffRenderProbe;
        probe.startedAt = performance.now();
        probe.frameIntervalsMs.length = 0;
        probe.longTaskDurationsMs.length = 0;
      });
      const svgBox = await mapSvg.boundingBox();
      expect(svgBox).not.toBeNull();
      await page.mouse.move(svgBox!.x + svgBox!.width / 2, svgBox!.y + svgBox!.height / 2);
      await page.mouse.wheel(0, wheelDeltaY);
      await page.waitForFunction(
        (viewBox) =>
          document.querySelector("svg[data-geometry-fingerprint]")?.getAttribute("viewBox") !==
          viewBox,
        initialViewBox,
        { timeout: 3_000 },
      );
      // Includes the viewport's 120 ms deferred LOD commit.
      await waitAnimationFrames(page, ZOOM_SAMPLE_FRAMES);
      await page.evaluate(() => {
        const probe = (
          window as unknown as {
            __astDiffRenderProbe: { startedAt: number; measuredRenderMs: number };
          }
        ).__astDiffRenderProbe;
        probe.measuredRenderMs = performance.now() - probe.startedAt;
      });
    } else {
      await page.evaluate(() => {
        const probe = (
          window as unknown as {
            __astDiffRenderProbe: {
              startedAt: number;
              measuredRenderMs: number;
              frameIntervalsMs: number[];
              longTaskDurationsMs: number[];
            };
          }
        ).__astDiffRenderProbe;
        probe.measuredRenderMs = performance.now() - probe.startedAt;
        probe.frameIntervalsMs.length = 0;
        probe.longTaskDurationsMs.length = 0;
      });
      await waitAnimationFrames(page, OVERVIEW_SAMPLE_FRAMES);
    }
    return await page.evaluate(() => {
      const probe = (
        window as unknown as {
          __astDiffRenderProbe: {
            startedAt: number;
            measuredRenderMs: number;
            frameIntervalsMs: number[];
            longTaskDurationsMs: number[];
          };
        }
      ).__astDiffRenderProbe;
      const memory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
      return {
        renderMs: probe.measuredRenderMs,
        frameIntervalsMs: probe.frameIntervalsMs.filter(
          (value) => Number.isFinite(value) && value > 0 && value < 5_000,
        ),
        longTaskDurationsMs: [...probe.longTaskDurationsMs],
        domNodes: document.querySelectorAll("*").length,
        svgNodes: document.querySelectorAll("svg *").length,
        polygons: document.querySelectorAll("svg polygon").length,
        paths: document.querySelectorAll("svg path").length,
        texts: document.querySelectorAll("svg text").length,
        heapBytes: memory.memory?.usedJSHeapSize ?? 0,
      };
    });
  } finally {
    await page.close();
  }
}

async function installProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = {
      startedAt: performance.now(),
      measuredRenderMs: 0,
      frameIntervalsMs: [] as number[],
      longTaskDurationsMs: [] as number[],
    };
    (window as unknown as { __astDiffRenderProbe: typeof probe }).__astDiffRenderProbe = probe;
    let previous = performance.now();
    requestAnimationFrame(function tick(now) {
      probe.frameIntervalsMs.push(now - previous);
      previous = now;
      requestAnimationFrame(tick);
    });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) probe.longTaskDurationsMs.push(entry.duration);
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Older Chromium builds may not expose longtask entries.
    }
  });
}

function renderMarkdown(output: {
  status: string;
  trialsPerCondition: number;
  warmupsPerCondition: number;
  slowFrameThresholdMs: number;
  initialFramesSkipped: number;
  overviewSampleFrames: number;
  zoomSampleFrames: number;
  browser: string;
  node: string;
  platform: string;
  arch: string;
  implementationRevision: string;
  implementationDirty: boolean;
  rows: Array<{
    scenario: string;
    variant: string;
    label: string;
    inputFiles: number;
    inputSymbols: number;
    summary: ReturnType<typeof summarizeAstDiffRenderTrials>;
  }>;
}): string {
  const n = (value: number) => value.toFixed(1);
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  return [
    "# AST diff browser rendering performance",
    "",
    `Status: ${output.status}.`,
    "",
    `Environment: Chromium ${output.browser}, Node ${output.node}, ${output.platform}/${output.arch}. Implementation ${output.implementationRevision}${output.implementationDirty ? " (dirty)" : ""}. Each condition uses ${output.warmupsPerCondition} warmup and ${output.trialsPerCondition} measured trials in rotated order. The first ${output.initialFramesSkipped} frames are skipped; overview conditions sample ${output.overviewSampleFrames} subsequent frames and the zoomed condition samples ${output.zoomSampleFrames}.`,
    "",
    `Slow frame means a requestAnimationFrame interval above ${output.slowFrameThresholdMs} ms.`,
    "",
    "| Scenario | Variant | Files | Symbols | DOM p50 | SVG p50 | Ready/transition p50 | Ready/transition p95 | Ready/transition p99 | Frame p95 | Frame p99 | Slow frames | Long tasks | Heap p50 MiB |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...output.rows.map((row) => {
      const summary = row.summary;
      return `| ${row.scenario} | ${row.variant} ${row.label} | ${row.inputFiles} | ${row.inputSymbols} | ${n(summary.domNodes.p50)} | ${n(summary.svgNodes.p50)} | ${n(summary.renderMs.p50)} ms | ${n(summary.renderMs.p95)} ms | ${n(summary.renderMs.p99)} ms | ${n(summary.frames.p95)} ms | ${n(summary.frames.p99)} ms | ${pct(summary.frames.slowRate)} | ${summary.longTasks.count} | ${n(summary.heapBytes.p50 / 1024 / 1024)} |`;
    }),
    "",
    "For overview conditions, ready latency runs from navigation start through the eight skipped frames; for the zoomed condition, transition latency runs from a centered wheel input through the deferred LOD commit and twenty-frame observation window. The 4× condition repeats the same 12 files with unique ids; it is a stress test, not an independent repository sample. DOM/SVG counts are observation-window medians, not fully converged layouts. Heap is Chromium's non-standard usedJSHeapSize gauge and is diagnostic only.",
    "",
  ].join("\n");
}

async function writeAtomic(path: string, value: string): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

async function waitAnimationFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (target) =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const tick = () => {
          frames++;
          if (frames >= target) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );
}
