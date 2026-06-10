import { defineConfig, devices } from "@playwright/test";

// Perf scenarios for the atlas playground, measured with lightbringer.
//   pnpm exec playwright test -c playwright.atlas.config.ts          # dev server
//   ATLAS_BASE_URL=http://127.0.0.1:5174 ... # against a prod preview, e.g.
//   pnpm build:atlas && pnpm exec vite preview -c vite.atlas.config.ts --port 5174
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
          command: "pnpm dev:atlas",
          url: "http://127.0.0.1:5173/atlas.html",
          reuseExistingServer: true,
        },
      }),
});
