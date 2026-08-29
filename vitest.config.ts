import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.spec.ts"],
    // Specs mock the db layer heavily; leaking a mock into the next file would
    // make failures depend on file order.
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Type-only module: it compiles to an empty file with nothing to cover.
      exclude: ["src/types.ts"],
      reporter: ["text-summary", "html", "lcovonly", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
