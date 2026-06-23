// Allocation-sampling heap profile of the real hot path (rings/treemap build
// on the 1.4k-file playwright snapshot). Run with tsx so the TS sources load:
//   NODE_OPTIONS= node --import tsx scripts/heapprof.mjs [rings|treemap] [runs]
// Prints the top allocation sites aggregated by function (self bytes), so we
// can see which algorithm allocates the most before touching anything.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import inspector from "node:inspector";
import { snapshotToAtlasGraph } from "@sprawlens/schema";
import { createRingsState } from "../packages/viz/src/ringsController.ts";
import { createTreemapState } from "../packages/viz/src/treemapController.ts";

const which = process.argv[2] ?? "rings";
const runs = Number(process.argv[3] ?? 40);
const build = which === "treemap" ? createTreemapState : createRingsState;

const opts = { width: 960, height: 640, seed: 1, adaptationRate: 0.8, lloydRate: 0.7 };
const path = fileURLToPath(
  new URL("../packages/viz/public-atlas/fixtures/playwright.json", import.meta.url),
);
const graph = snapshotToAtlasGraph(JSON.parse(readFileSync(path, "utf8")));

// warm up the JIT + module graph so steady-state allocations dominate
for (let i = 0; i < 5; i++) build(graph, opts);

const session = new inspector.Session();
session.connect();
const post = (m, p) =>
  new Promise((res, rej) => session.post(m, p, (e, r) => (e ? rej(e) : res(r))));

// fine sampling interval to resolve true allocation volume
await post("HeapProfiler.enable");
await post("HeapProfiler.startSampling", { samplingInterval: 512 });

const t0 = process.hrtime.bigint();
for (let i = 0; i < runs; i++) build(graph, opts);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;

const { profile } = await post("HeapProfiler.stopSampling");
await post("HeapProfiler.disable");
session.disconnect();

// aggregate sampled self-size by (function, file) across the call tree
const self = new Map();
const ours = (url) => url.includes("/packages/") || url.includes("/scripts/");
function walk(node) {
  const cf = node.callFrame;
  const bytes = node.selfSize ?? 0;
  if (bytes > 0) {
    const key = `${cf.functionName || "(anonymous)"}\t${cf.url.split("/").slice(-2).join("/")}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + bytes);
  }
  for (const c of node.children ?? []) walk(c);
}
walk(profile.head);

const sorted = [...self.entries()].sort((a, b) => b[1] - a[1]);
const total = sorted.reduce((s, [, b]) => s + b, 0);
const totalOurs = sorted
  .filter(([k]) => ours(k.split("\t")[1] ? "/packages/" + k : k))
  .reduce((s, [, b]) => s + b, 0);

console.log(`\n${which}: ${runs} runs in ${ms.toFixed(0)}ms (${(ms / runs).toFixed(2)}ms/run)`);
console.log(`sampled heap total ~${(total / 1e6).toFixed(1)}MB\n`);
console.log("top self-allocation sites:");
for (const [key, bytes] of sorted.slice(0, 25)) {
  const [fn, loc] = key.split("\t");
  const pct = ((bytes / total) * 100).toFixed(1);
  console.log(`  ${(bytes / 1e6).toFixed(2)}MB ${pct.padStart(5)}%  ${fn}  ${loc}`);
}
