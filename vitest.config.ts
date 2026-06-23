import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    benchmark: { include: ["packages/**/*.bench.ts"] },
    // v8 coverage instrumentation slows the heavy convergence tests (e.g.
    // capacityLayout n=200) past the 5s default on CI runners; give headroom.
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      // measure the source of every package, not test/bench/generated files
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.ts", "**/*.bench.ts", "**/vendor/**", "**/dist/**", "**/*.d.ts"],
      // ratchet floors a hair below the current baseline — they fail CI on a
      // regression, not on normal work. Raise them as coverage climbs. (The viz
      // browser UI is covered by playwright, not vitest, so the global numbers
      // run lower than the logic packages.)
      thresholds: {
        statements: 57,
        branches: 44,
        functions: 50,
        lines: 58,
      },
    },
  },
});
