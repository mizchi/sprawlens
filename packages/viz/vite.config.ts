import preact from "@preact/preset-vite";
import { defineConfig, type ProxyOptions } from "vite";

// The data backend (pnpm dev:atlas-server) isn't running during static render
// tests, so every /api call floods the log with ECONNREFUSED proxy errors that
// bury real failures. SPRAWLENS_QUIET_PROXY=1 (set by the render webServers)
// swallows them; dev keeps the default logging so a crashed backend is visible.
const quietProxy = process.env.SPRAWLENS_QUIET_PROXY === "1";
const apiProxy: Record<string, ProxyOptions> = {
  // atlas symbol-dependency server (pnpm dev:atlas-server)
  "/api": {
    target: "http://127.0.0.1:4710",
    configure: quietProxy ? (proxy) => proxy.on("error", () => {}) : undefined,
  },
};

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
  // preview.proxy inherits server.proxy in Vite, so both share the quiet rule
  server: { proxy: apiProxy },
  build: {
    outDir: "dist",
    // clean stale hashed bundles each build (publicDir fixtures are re-copied)
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
    },
  },
});
