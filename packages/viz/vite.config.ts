import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  // relative base so the build works under a subpath (GitHub Pages)
  base: "./",
  // preact/debug's and prefresh's vnode hooks dominated dev-mode CPU
  // profiles on monorepo-scale maps (GC storms during zoom). devtools are
  // off; HMR can be dropped too for heavy-map sessions: ATLAS_HMR=0
  plugins: [
    preact({
      devToolsEnabled: false,
      prefreshEnabled: process.env.ATLAS_HMR !== "0",
    }),
  ],
  publicDir: "public-atlas",
  server: {
    proxy: {
      // atlas symbol-dependency server (pnpm dev:atlas-server)
      "/api": "http://127.0.0.1:4710",
    },
  },
  build: {
    outDir: "dist",
    // clean stale hashed bundles each build (publicDir fixtures are re-copied)
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
    },
  },
});
