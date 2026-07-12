import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Page } from "playwright";

const projectRoot = resolve(import.meta.dirname, "..");
const outputRoot = resolve(projectRoot, "preview/stable-layout-experiment");
const port = 5181;
const ownedBaseUrl = `http://127.0.0.1:${port}`;
const baseUrl = process.env.STABLE_EXPERIMENT_BASE_URL ?? ownedBaseUrl;
const experimentUrl = `${baseUrl}/?source=sprawlens-history&boundaries=module&displayLevels=module&changedPreview=false&dark=true&experimental=true`;

type StepMetrics = {
  row: number;
  commit: string;
  stableGroups: number;
  warmGroups: number;
  coldGroups: number;
  baselineSelections: number;
  contractViolations: number;
  adjacencyGain: number;
  displacementReduction: number;
  eligibleCandidates: number;
  weightedSolves: number;
  totalSteps: number;
};

const waitReady = async (url: string, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The preview server is still starting.
    }
    await sleep(200);
  }
  throw new Error(`stable visual experiment server not ready: ${url}`);
};

const waitForLayout = async (page: Page) => {
  await page.waitForTimeout(180);
  await page.waitForFunction(
    () => document.querySelector("[data-converged]")?.getAttribute("data-converged") === "1",
    undefined,
    { timeout: 30_000 },
  );
};

const waitForHistory = async (page: Page) => {
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="commit-row"]').length > 1,
    undefined,
    { timeout: 30_000 },
  );
};

const openExperimentPanel = async (page: Page) => {
  const panel = page.getByTestId("stable-layout-experiment");
  await page.getByTitle("layers").click();
  await panel.waitFor({ state: "attached" });
  await page.waitForTimeout(250);
};

const prepareOldestCommit = async (page: Page) => {
  await page.goto(experimentUrl, { waitUntil: "networkidle" });
  await waitForHistory(page);
  const rows = page.getByTestId("commit-row");
  const rowCount = await rows.count();
  await rows.nth(rowCount - 1).click();
  await waitForLayout(page);
  await page.getByTitle("layers").click();
  await page.waitForTimeout(250);
  await page
    .locator("label")
    .filter({ hasText: "stable delta" })
    .locator('input[type="checkbox"]')
    .check();
  await page.waitForTimeout(250);
  await page.getByTitle("layers").click();
  await page.waitForTimeout(250);
  return rowCount;
};

const readStep = async (page: Page, row: number): Promise<StepMetrics> => {
  const data = await page.getByTestId("stable-layout-experiment").evaluate((element) => ({
    ...element.dataset,
  }));
  const number = (key: string) => Number(data[key] ?? 0);
  return {
    row,
    commit: (await page.getByTestId("commit-row").nth(row).innerText()).replaceAll(/\s+/g, " "),
    stableGroups: number("stableGroups"),
    warmGroups: number("warmGroups"),
    coldGroups: number("coldGroups"),
    baselineSelections: number("baselineSelections"),
    contractViolations: number("contractViolations"),
    adjacencyGain: number("adjacencyGain"),
    displacementReduction: number("displacementReduction"),
    eligibleCandidates: number("eligibleCandidates"),
    weightedSolves: number("weightedSolves"),
    totalSteps: number("totalSteps"),
  };
};

const replayTo = async (page: Page, row: number) => {
  const rowCount = await prepareOldestCommit(page);
  const commitRows = page.getByTestId("commit-row");
  for (let index = rowCount - 2; index >= row; index--) {
    await commitRows.nth(index).click();
    await waitForLayout(page);
  }
};

let server: ChildProcess | undefined;
if (!process.env.STABLE_EXPERIMENT_BASE_URL) {
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
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const rowCount = await prepareOldestCommit(page);
  await openExperimentPanel(page);
  await page.screenshot({ path: resolve(outputRoot, "before.png") });
  await page.getByTitle("layers").click();

  const rows = page.getByTestId("commit-row");
  const steps: StepMetrics[] = [];
  for (let row = rowCount - 2; row >= 0; row--) {
    await rows.nth(row).click();
    await waitForLayout(page);
    const step = await readStep(page, row);
    steps.push(step);
    process.stderr.write(
      `[stable visual ${steps.length}/${rowCount - 1}] S${step.stableGroups} W${step.warmGroups} C${step.coldGroups} displacement=${step.displacementReduction.toFixed(4)} adjacency=${step.adjacencyGain.toFixed(4)}\n`,
    );
  }
  if (pageErrors.length > 0) throw new Error(`browser errors: ${pageErrors.join("; ")}`);
  const measured = steps.filter(({ stableGroups }) => stableGroups > 0);
  if (measured.length === 0) throw new Error("stable visual experiment produced no stable groups");
  const best = [...measured].sort(
    (left, right) =>
      right.displacementReduction - left.displacementReduction ||
      right.adjacencyGain - left.adjacencyGain,
  )[0]!;
  const stableGroupUpdates = measured.reduce((sum, step) => sum + step.stableGroups, 0);
  const aggregate = {
    historyTransitions: steps.length,
    measuredTransitions: measured.length,
    stableGroupUpdates,
    improvedTransitions: measured.filter(
      ({ displacementReduction }) => displacementReduction > 1e-12,
    ).length,
    baselineSelectionRate:
      measured.reduce((sum, step) => sum + step.baselineSelections, 0) / stableGroupUpdates,
    meanAdjacencyGain:
      measured.reduce((sum, step) => sum + step.adjacencyGain * step.stableGroups, 0) /
      stableGroupUpdates,
    meanDisplacementReduction:
      measured.reduce((sum, step) => sum + step.displacementReduction * step.stableGroups, 0) /
      stableGroupUpdates,
  };

  await replayTo(page, best.row);
  await openExperimentPanel(page);
  await page.screenshot({ path: resolve(outputRoot, "best.png") });
  await browser.close();

  const output = {
    schemaVersion: 1,
    status: "browser-level stable neighborhood visualization experiment",
    inferenceScope:
      "post-hoc path-dependent self-history visualization; not part of the preregistered repository inference",
    fixture: "packages/viz/public-atlas/fixtures/sprawlens-history.json",
    view: {
      layout: "treemap",
      grouping: "module",
      leaf: "file",
      direction: "oldest-to-newest",
      anchorMixes: [0, 0.25, 0.5, 0.75, 1],
      swapPasses: [8],
      maxNodes: 80,
      maxSteps: 800,
    },
    commits: rowCount,
    measuredSteps: measured.length,
    contractViolations: steps.reduce((sum, step) => sum + step.contractViolations, 0),
    aggregate,
    best,
    steps,
    screenshots: ["before.png", "best.png"],
  };
  await writeFile(resolve(outputRoot, "summary.json"), `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify(
      {
        outputRoot,
        commits: output.commits,
        measuredSteps: output.measuredSteps,
        contractViolations: output.contractViolations,
        aggregate: output.aggregate,
        best: output.best,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  server?.kill("SIGTERM");
}
