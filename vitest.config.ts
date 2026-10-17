import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // CPU-bound generator/solver tests run ~2.5× slower when scheduled on
    // efficiency cores under a full parallel run; 5 s (the default) was flaky.
    testTimeout: 30_000,
  },
});
