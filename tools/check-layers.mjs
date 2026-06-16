#!/usr/bin/env node
// Enforce the responsibility layers (see README "Architecture"). Each package's
// real @sprawlens/* dependencies must be a subset of its allow-list below. This
// catches layer violations at the package boundary — including deps that would
// otherwise resolve "by accident" through shamefully-hoist — e.g. the neutral
// server/viz reaching a concrete analyzer, which only the cli root may do.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "packages");

const ALLOWED = {
  // L0 contract
  "@sprawlens/contracts": [],
  // L1 domain
  "@sprawlens/schema": ["@sprawlens/contracts"],
  "@sprawlens/layout": ["@sprawlens/contracts"],
  // L2 capability (language providers + their registry)
  "@sprawlens/analyzer-ts": ["@sprawlens/contracts", "@sprawlens/schema"],
  "@sprawlens/analyzer-go": ["@sprawlens/contracts", "@sprawlens/schema"],
  "@sprawlens/analyzer-rust": ["@sprawlens/contracts", "@sprawlens/schema"],
  "@sprawlens/analyzer-moonbit": ["@sprawlens/contracts", "@sprawlens/schema"],
  "@sprawlens/providers": [
    "@sprawlens/contracts",
    "@sprawlens/analyzer-ts",
    "@sprawlens/analyzer-go",
    "@sprawlens/analyzer-rust",
    "@sprawlens/analyzer-moonbit",
  ],
  // L3 application — neutral: must NOT depend on any analyzer or the registry
  "@sprawlens/server": ["@sprawlens/contracts", "@sprawlens/schema"],
  "@sprawlens/viz": ["@sprawlens/contracts", "@sprawlens/schema", "@sprawlens/layout"],
  // L4 composition root — the only place allowed to know concrete analyzers
  "@sprawlens/cli": [
    "@sprawlens/contracts",
    "@sprawlens/schema",
    "@sprawlens/layout",
    "@sprawlens/providers",
    "@sprawlens/analyzer-ts",
    "@sprawlens/server",
  ],
};

let failed = false;
const seen = new Set();
for (const dir of readdirSync(pkgDir)) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(pkgDir, dir, "package.json"), "utf8"));
  } catch {
    continue;
  }
  const name = pkg.name;
  seen.add(name);
  const allowed = ALLOWED[name];
  if (!allowed) {
    console.error(
      `✗ ${name}: not in the layer manifest (tools/check-layers.mjs). Add it with its allowed deps.`,
    );
    failed = true;
    continue;
  }
  const deps = Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }).filter((d) => d.startsWith("@sprawlens/"));
  for (const d of deps) {
    if (!allowed.includes(d)) {
      console.error(
        `✗ ${name} -> ${d} violates the layers. Allowed: ${allowed.join(", ") || "(none)"}`,
      );
      failed = true;
    }
  }
}
for (const name of Object.keys(ALLOWED)) {
  if (!seen.has(name)) {
    console.error(`! ${name} is in the manifest but has no package (stale entry).`);
    failed = true;
  }
}

if (failed) {
  console.error("\nLayer check failed.");
  process.exit(1);
}
console.log("Layer check passed: every package respects the responsibility layers.");
