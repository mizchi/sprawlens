import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsdown";

// Bundle our workspace TS (@sprawlens/*, all devDeps) plus preact +
// preact-render-to-string (not listed in dependencies) into one self-contained
// file. tsdown externalizes everything in package.json `dependencies`
// (commander, web-tree-sitter, typescript, ...) and node builtins by default,
// which matches what the CLI needs at runtime. JSX is preact, read from
// tsconfig (jsxImportSource: preact).
await build({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  dts: false,
  clean: true,
  outExtensions: () => ({ js: ".js" }),
});

const here = fileURLToPath(new URL(".", import.meta.url));
// the MoonBit analyzer loads its vendored parser at runtime by URL, which the
// bundler can't follow — copy it under dist/ so the bundled CLI finds it.
await cp(
  resolve(here, "../analyzer-moonbit/vendor/moonbit-parser.js"),
  resolve(here, "dist/vendor/moonbit-parser.js"),
);
// bundle the built viz so the published CLI is self-contained, minus the demo
// fixtures (public-atlas/*, ~6MB) the CLI never serves.
const vizSrc = resolve(here, "../viz/dist");
const vizOut = resolve(here, "dist/viz");
const fixturesDir = resolve(vizSrc, "fixtures");
await rm(vizOut, { recursive: true, force: true });
await cp(vizSrc, vizOut, {
  recursive: true,
  filter: (src) => src !== fixturesDir && !src.startsWith(`${fixturesDir}/`),
});
console.log("built dist/index.js + bundled viz (no demo fixtures)");
