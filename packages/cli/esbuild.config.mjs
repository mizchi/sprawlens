import { build } from "esbuild";
import { isAbsolute, resolve } from "node:path";
import { cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// bundle our workspace TS (@sprawlens/*) into one file; leave node_modules
// deps (typescript, web-tree-sitter, commander, ...) and node builtins external.
// preact + preact-render-to-string are bundled too (not externalized): the
// headless SVG renderer pulls the viz components, so the CLI must carry preact
// to stay self-contained without adding it as a runtime dependency.
const BUNDLED = ["preact", "preact-render-to-string"];
const isBundled = (path) =>
  BUNDLED.some((p) => path === p || path.startsWith(`${p}/`));
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.js",
  // the viz components are preact JSX (jsxImportSource: preact)
  jsx: "automatic",
  jsxImportSource: "preact",
  jsxDev: false,
  plugins: [
    {
      name: "externalize",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === "entry-point") return null;
          if (args.path.startsWith(".") || args.path.startsWith("@sprawlens/"))
            return null;
          if (isBundled(args.path)) return null;
          if (isAbsolute(args.path)) return null;
          return { path: args.path, external: true };
        });
      },
    },
  ],
});
// bundle the built viz so the published CLI is self-contained. Skip the demo
// fixtures (public-atlas/*, ~6MB): the CLI serves a real repo over /api/snapshot
// and defaults to the "served" source, so the baked demo data is never used.
const here = fileURLToPath(new URL(".", import.meta.url));
// the MoonBit analyzer loads its vendored parser at runtime by URL, which the
// bundler can't follow — copy it under dist/ so the bundled CLI finds it
// (astExtract tries ./vendor too). Absent it, the analyzer falls back to regex.
await cp(
  resolve(here, "../analyzer-moonbit/vendor/moonbit-parser.js"),
  resolve(here, "dist/vendor/moonbit-parser.js"),
);
const vizSrc = resolve(here, "../viz/dist");
const vizOut = resolve(here, "dist/viz");
const fixturesDir = resolve(vizSrc, "fixtures");
await rm(vizOut, { recursive: true, force: true });
await cp(vizSrc, vizOut, {
  recursive: true,
  filter: (src) => src !== fixturesDir && !src.startsWith(`${fixturesDir}/`),
});
console.log("built dist/index.js + bundled viz (no demo fixtures)");
