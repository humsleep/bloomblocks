// Property / fuzz lane for the rules core (npm run test:fuzz). Files are *.fuzz.ts so the
// root `npm test` (tests/**/*.test.ts) never picks them up. Sizes scale with FUZZ_LEVELS
// (levels per track, default 500) and FUZZ_DAYS (consecutive dailies, default 400).
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root,
  test: {
    include: ["tests/fuzz/**/*.fuzz.ts"],
    testTimeout: 240_000,
    hookTimeout: 240_000,
  },
});
