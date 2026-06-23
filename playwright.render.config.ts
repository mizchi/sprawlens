import { defineConfig, devices } from "@playwright/test";

// Deterministic rendering snapshots of the viz. The settings live in the URL
// (nuqs), the layout is seeded, and the app exposes `window.__sprawlensConverged`
// once settled — so a capture is reproducible. Builds + previews the viz bundle
// (static; the fixture sources need no API).
//   pnpm test:render            # check against committed SVG baselines
//   pnpm test:render:update     # refresh the baselines
const baseURL = process.env.RENDER_BASE_URL ?? "http://127.0.0.1:5179";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/render-snapshot.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
  },
  ...(process.env.RENDER_BASE_URL
    ? {}
    : {
        webServer: {
          command: "pnpm --filter @sprawlens/viz build && pnpm --filter @sprawlens/viz preview",
          url: "http://127.0.0.1:5179/",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { SPRAWLENS_QUIET_PROXY: "1" },
        },
      }),
});
