import { build } from "esbuild";
import { isAbsolute, resolve } from "node:path";
import { cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// bundle our workspace TS (@sprawlens/*) into one file; leave node_modules
// deps (typescript, web-tree-sitter, commander, ...) and node builtins external.
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.js",
  plugins: [
    {
      name: "externalize",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === "entry-point") return null;
          if (args.path.startsWith(".") || args.path.startsWith("@sprawlens/"))
            return null;
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
const vizSrc = resolve(here, "../viz/dist");
const vizOut = resolve(here, "dist/viz");
const fixturesDir = resolve(vizSrc, "fixtures");
await rm(vizOut, { recursive: true, force: true });
await cp(vizSrc, vizOut, {
  recursive: true,
  filter: (src) => src !== fixturesDir && !src.startsWith(`${fixturesDir}/`),
});
console.log("built dist/index.js + bundled viz (no demo fixtures)");
