import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bench, describe } from "vitest";
import { snapshotToAtlasGraph, type SnapshotLike } from "@sprawlens/schema";
import { createRingsState } from "./ringsController.js";
import { createTreemapState } from "./treemapController.js";
import type { AtlasGraph } from "@sprawlens/schema";

const opts = {
  width: 960,
  height: 640,
  seed: 1,
  adaptationRate: 0.8,
  lloydRate: 0.7,
};

/** The playwright monorepo snapshot (1.4k files) is the worst-case build. */
function playwrightGraph(): AtlasGraph {
  const path = fileURLToPath(
    new URL("../public-atlas/fixtures/playwright.json", import.meta.url),
  );
  const snapshot = JSON.parse(readFileSync(path, "utf8")) as SnapshotLike;
  return snapshotToAtlasGraph(snapshot);
}

const graph = playwrightGraph();

describe("cold build (playwright, ~1.4k files)", () => {
  bench("createRingsState", () => {
    createRingsState(graph, opts);
  });
  bench("createTreemapState", () => {
    createTreemapState(graph, opts);
  });
});
