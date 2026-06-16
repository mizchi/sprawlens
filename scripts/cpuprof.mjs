// CPU self-time profile of the rings/treemap build, via the V8 inspector
// Profiler domain (same engine as --cpu-prof but we aggregate self-time by
// function). Warm up first so JIT-tier code dominates the samples.
//   NODE_OPTIONS= node --import tsx scripts/cpuprof.mjs [rings|treemap] [runs]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import inspector from "node:inspector";
import { snapshotToAtlasGraph } from "@sprawlens/schema";
import { createRingsState } from "../packages/viz/src/ringsController.ts";
import { createTreemapState } from "../packages/viz/src/treemapController.ts";

const which = process.argv[2] ?? "rings";
const runs = Number(process.argv[3] ?? 30);
const build = which === "treemap" ? createTreemapState : createRingsState;
const opts = { width: 960, height: 640, seed: 1, adaptationRate: 0.8, lloydRate: 0.7 };
const path = fileURLToPath(
  new URL("../packages/viz/public-atlas/fixtures/playwright.json", import.meta.url),
);
const graph = snapshotToAtlasGraph(JSON.parse(readFileSync(path, "utf8")));

for (let i = 0; i < 8; i++) build(graph, opts);

const session = new inspector.Session();
session.connect();
const post = (m, p) =>
  new Promise((res, rej) => session.post(m, p, (e, r) => (e ? rej(e) : res(r))));

await post("Profiler.enable");
await post("Profiler.setSamplingInterval", { interval: 100 }); // µs
await post("Profiler.start");
const t0 = process.hrtime.bigint();
for (let i = 0; i < runs; i++) build(graph, opts);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
const { profile } = await post("Profiler.stop");
session.disconnect();

// self time per node is proportional to hitCount; aggregate by function
const self = new Map();
for (const node of profile.nodes) {
  const hits = node.hitCount ?? 0;
  if (hits === 0) continue;
  const cf = node.callFrame;
  const loc = `${cf.url.split("/").slice(-2).join("/")}:${cf.lineNumber + 1}`;
  const key = `${cf.functionName || "(anonymous)"}\t${loc}`;
  self.set(key, (self.get(key) ?? 0) + hits);
}
const totalHits = [...self.values()].reduce((a, b) => a + b, 0);
const sorted = [...self.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\n${which}: ${runs} runs in ${ms.toFixed(0)}ms (${(ms / runs).toFixed(2)}ms/run)`);
console.log(`${totalHits} samples\n`);
console.log("top self-time functions:");
for (const [key, hits] of sorted.slice(0, 25)) {
  const [fn, loc] = key.split("\t");
  const pct = ((hits / totalHits) * 100).toFixed(1);
  console.log(`  ${pct.padStart(5)}%  ${fn}  ${loc}`);
}
