import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    benchmark: { include: ["packages/**/*.bench.ts"] },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      // measure the source of every package, not test/bench/generated files
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.ts", "**/*.bench.ts", "**/vendor/**", "**/dist/**", "**/*.d.ts"],
    },
  },
});
