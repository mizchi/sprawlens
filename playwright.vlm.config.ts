import { defineConfig, devices } from "@playwright/test";

// Layer 2 — VLM visual evaluation. Same seeded, converged viz as the Layer 1
// SVG snapshots, but captured to PNG and judged against natural-language
// expectations by a vision model on OpenRouter (see e2e/vlmReview.ts). The spec
// skips itself unless OPENROUTER_API_KEY is set, so run it through dotenvx:
//   pnpm test:render:vlm        # dotenvx run -- playwright test -c this
// Override the judge with VLM_MODEL (the default ui-tars only smoke-tests the
// round-trip; a real judge such as qwen/qwen2.5-vl-72b-instruct discriminates).
const baseURL = process.env.RENDER_BASE_URL ?? "http://127.0.0.1:5179";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/render-vlm.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
  },
  ...(process.env.RENDER_BASE_URL
    ? {}
    : {
        webServer: {
          command:
            "pnpm --filter @sprawlens/viz build && pnpm --filter @sprawlens/viz preview",
          url: "http://127.0.0.1:5179/",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
