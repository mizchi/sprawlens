import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { tsDetail, tsProvider } from "@sprawlens/analyzer-ts";
import { applyLayers, layerManifest } from "@sprawlens/schema";
import type { LayerManifestEntry, Snapshot } from "@sprawlens/schema";
import { createAtlasServer } from "@sprawlens/server";
import { readSprawlensConfig } from "./config.ts";

// Dev composition for the viz dev server: analyze each named repo with the
// TypeScript provider and serve it the same way the CLI does — an initial
// snapshot plus a live analyzer for the fs-watch SSE stream — so `pnpm dev`
// shows live data (not the baked fixture) and reflects working-tree edits. The
// TS detail provider (CFG / call hierarchy) is wired here too; this lives in
// the cli (the composition root that may know concrete analyzers) so
// @sprawlens/server stays a neutral shell.
// usage: tsx src/devServer.ts [--port N] name=path [name=path...]
const args = process.argv.slice(2);
let port = 4710;
const repos = new Map<string, string>();
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port") {
    port = Number(args[++i]);
    continue;
  }
  const eq = args[i]!.indexOf("=");
  if (eq > 0) {
    const name = args[i]!.slice(0, eq);
    const path = resolve(args[i]!.slice(eq + 1));
    if (!existsSync(path)) {
      console.error(`repo path not found: ${name}=${path}`);
      process.exit(1);
    }
    repos.set(name, path);
  }
}
if (repos.size === 0) {
  console.error("usage: devServer [--port N] name=path [name=path...]");
  process.exit(1);
}

const snapshots = new Map<string, Snapshot>();
const analyzers = new Map<string, () => Promise<Snapshot>>();
let layers: LayerManifestEntry[] = [];
for (const [name, path] of repos) {
  const config = (await readSprawlensConfig(path)) ?? {};
  // incremental keeps a parse cache so each fs-watch re-analysis only re-parses
  // changed files; applyLayers stamps the test/deps planes from sprawlens.toml.
  const incremental = tsProvider.createIncrementalAnalyzer?.(path);
  const rawAnalyze = incremental ? () => incremental.analyze() : () => tsProvider.analyze(path);
  const analyze = async (): Promise<Snapshot> => applyLayers(await rawAnalyze(), config);
  snapshots.set(name, await analyze());
  analyzers.set(name, analyze);
  layers = layerManifest(config);
}

createAtlasServer({ repos, snapshots, analyzers, detail: tsDetail, layers }).listen(
  port,
  "127.0.0.1",
  () => {
    console.log(`atlas server: http://127.0.0.1:${port} (${[...repos.keys()].join(", ")})`);
  },
);
