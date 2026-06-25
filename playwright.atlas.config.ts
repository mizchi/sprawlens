import { defineConfig, devices } from "@playwright/test";

// Per-step perf scenarios for the atlas playground, measured with lightbringer.
//   pnpm perf:atlas                       # spins up `pnpm dev` (viz + API/SSE)
//   PERF_MEM=1 pnpm perf:atlas            # retained-only memory (GC at span edges)
//   ATLAS_BASE_URL=http://127.0.0.1:5179 pnpm perf:atlas   # reuse a running server
const baseURL = process.env.ATLAS_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
  },
  ...(process.env.ATLAS_BASE_URL
    ? {}
    : {
        webServer: {
          // `pnpm dev` brings up the viz (vite, 5173) and the cli dev server
          // (API + SSE, analysing this repo) together; the analysis pass on
          // first boot needs headroom past Playwright's 60s webServer default.
          command: "pnpm dev",
          url: "http://127.0.0.1:5173/",
          reuseExistingServer: true,
          timeout: 180_000,
        },
      }),
});
