import { config as dotenvxConfig } from "@dotenvx/dotenvx";
import { defineConfig, devices } from "@playwright/test";

// Decrypt the local .env in-process so OPENROUTER_API_KEY reaches the reviewer
// without a `dotenvx run --` wrapper around the command. That wrapper's `--`
// stacked with pnpm's own forwarded `--` and reached playwright (which rejects
// a bare `--`), so `-g <name>` never filtered. No-op (skipped spec) when
// there's no .env / key.
dotenvxConfig({ quiet: true, ignore: ["MISSING_ENV_FILE"] });

// Layer 2 — VLM visual evaluation. Same seeded, converged viz as the Layer 1
// SVG snapshots, but captured to PNG and judged against natural-language
// expectations by a vision model on OpenRouter (see e2e/vlmReview.ts). The spec
// skips itself unless OPENROUTER_API_KEY is set.
//   pnpm test:render:vlm              # judge the renders
//   pnpm test:render:vlm -g treemap   # one case (no `--`: pnpm forwards a bare
//                                      # `--` literally and playwright rejects it)
// The default judge is google/gemini-2.5-flash (robust on shape, colour and
// counts); override with VLM_MODEL for a cheaper shape-only run (ui-tars) or a
// non-Google option (qwen/qwen3-vl-30b-a3b-instruct).
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
          command: "pnpm --filter @sprawlens/viz build && pnpm --filter @sprawlens/viz preview",
          url: "http://127.0.0.1:5179/",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { SPRAWLENS_QUIET_PROXY: "1" },
        },
      }),
});
