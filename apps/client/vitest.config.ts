// Client unit tests (node): pure / near-pure modules of src/ with the Capacitor plugins
// replaced by the in-memory fakes in tests/fakes (same fakes as the e2e build).
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const fakes = ["app", "filesystem", "haptics", "preferences", "share"];

export default defineConfig({
  resolve: {
    alias: [
      { find: "@core", replacement: here("../../core") },
      { find: "@games", replacement: here("../../games") },
      ...fakes.map((n) => ({ find: new RegExp(`^@capacitor/${n}$`), replacement: here(`./tests/fakes/${n}.ts`) })),
    ],
  },
  define: { __VARIANT__: JSON.stringify("test") },
  test: {
    include: ["tests/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    environment: "node",
    // level generation is CPU-bound; parallel files on efficiency cores are ~2.5x slower
    testTimeout: 30_000,
    restoreMocks: true,
  },
});
