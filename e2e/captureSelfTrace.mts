/**
 * Capture sprawlens' own execution as an ordered TraceTimeline and save it as a
 * dev fixture. Phase 1: the **server plane** — boot the real CLI `serve` on the
 * sprawlens repo under `node --cpu-prof` (profiling from process start, so the
 * entry + analyze are sampled), grab its snapshot, then shut it down so the
 * profile flushes. The browser plane is appended by the Playwright harness.
 *
 *   npx tsx e2e/captureSelfTrace.mts        # writes e2e/__trace__/self-timeline.json
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { buildTraceTimeline } from "@sprawlens/schema";
import type { Snapshot } from "@sprawlens/contracts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const cli = join(repoRoot, "packages/cli/src/index.ts");
const outDir = join(here, "__trace__");
const profDir = join(outDir, "_prof");
const PORT = 4731;

mkdirSync(profDir, { recursive: true });

async function waitFor(url: string, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error(`server did not become ready at ${url}`);
}

console.log("[capture] booting profiled server…");
const child = spawn(
  process.execPath,
  [
    "--cpu-prof",
    `--cpu-prof-dir=${profDir}`,
    "--cpu-prof-name=server.cpuprofile",
    "--import",
    "tsx",
    cli,
    "serve",
    repoRoot,
    "--port",
    String(PORT),
    "--no-open",
  ],
  { cwd: repoRoot, stdio: ["ignore", "inherit", "inherit"] },
);

const base = `http://127.0.0.1:${PORT}`;
await waitFor(`${base}/api/snapshot?repo=sprawlens`, 120_000);

const snapshot = (await (await fetch(`${base}/api/snapshot?repo=sprawlens`)).json()) as Snapshot;
console.log(`[capture] snapshot: ${snapshot.nodes?.length ?? 0} nodes`);

// shut down → SIGTERM handler closes the server and exits, flushing --cpu-prof
const exited = new Promise<void>((r) => child.once("exit", () => r()));
child.kill("SIGTERM");
await Promise.race([exited, sleep(8000)]);

const profName = readdirSync(profDir).find((f) => f.endsWith(".cpuprofile"));
if (!profName) throw new Error("no .cpuprofile written — did the server flush on exit?");
const profile = JSON.parse(readFileSync(join(profDir, profName), "utf8"));

const server = buildTraceTimeline(profile, { repoRoot, snapshot, plane: "server" });
const resolved = server.steps.filter((s) => s.symbolId).length;
console.log(
  `[capture] server plane: ${server.steps.length} steps, ${resolved} resolved, ${(server.planes[0]!.durationUs / 1000).toFixed(0)}ms`,
);

const timeline = server; // browser plane merged in by the Playwright harness
writeFileSync(join(outDir, "self-timeline.json"), JSON.stringify(timeline));
console.log(`[capture] wrote ${join(outDir, "self-timeline.json")}`);

// surface a few resolved symbols so we can eyeball that the entry path is real
const sample = server.steps.filter((s) => s.symbolId).slice(0, 8).map((s) => s.symbolId);
console.log("[capture] sample symbols:", sample);
