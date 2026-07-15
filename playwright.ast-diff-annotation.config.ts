import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/ast-diff-annotation-ui.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
  },
});
