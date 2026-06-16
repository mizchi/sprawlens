// Wall-time of the rings build (no profiler overhead). Warms up, then reports
// the trimmed-mean ms/run over many iterations so small algo changes are
// distinguishable from noise.
//   NODE_OPTIONS= node --import tsx scripts/buildtime.mjs [rings|treemap] [runs]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { snapshotToAtlasGraph } from "@sprawlens/schema";
import { createRingsState } from "../packages/viz/src/ringsController.ts";
import { createTreemapState } from "../packages/viz/src/treemapController.ts";

const which = process.argv[2] ?? "rings";
const runs = Number(process.argv[3] ?? 60);
const build = which === "treemap" ? createTreemapState : createRingsState;
const opts = { width: 960, height: 640, seed: 1, adaptationRate: 0.8, lloydRate: 0.7 };
const path = fileURLToPath(
  new URL("../packages/viz/public-atlas/fixtures/playwright.json", import.meta.url),
);
const graph = snapshotToAtlasGraph(JSON.parse(readFileSync(path, "utf8")));

for (let i = 0; i < 12; i++) build(graph, opts);

const samples = [];
for (let i = 0; i < runs; i++) {
  const t = process.hrtime.bigint();
  build(graph, opts);
  samples.push(Number(process.hrtime.bigint() - t) / 1e6);
}
samples.sort((a, b) => a - b);
const trim = samples.slice(Math.floor(runs * 0.1), Math.ceil(runs * 0.9));
const mean = trim.reduce((a, b) => a + b, 0) / trim.length;
console.log(
  `${which}: median ${samples[runs >> 1].toFixed(2)}ms  trimmed-mean ${mean.toFixed(2)}ms  min ${samples[0].toFixed(2)}ms  (n=${runs})`,
);
