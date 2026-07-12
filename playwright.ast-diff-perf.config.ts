import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.AST_DIFF_PERF_BASE_URL ?? "http://127.0.0.1:5179";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/ast-diff-render-perf.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  timeout: 300_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
  },
  ...(process.env.AST_DIFF_PERF_BASE_URL
    ? {}
    : {
        webServer: {
          command: "pnpm --filter @sprawlens/viz build && pnpm --filter @sprawlens/viz preview",
          url: "http://127.0.0.1:5179/",
          reuseExistingServer: false,
          timeout: 120_000,
          env: { SPRAWLENS_QUIET_PROXY: "1" },
        },
      }),
});
