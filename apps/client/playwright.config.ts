// E2E against the web build with Capacitor fakes (vite --mode e2e, see vite.config.ts).
//   npm run test:e2e                 Chromium (merge-blocking lane)
//   npm run test:e2e -- --project=webkit   WebKit (iOS runs WKWebView)
// Two servers: the e2e production build (preview, port 4319) for every flow, and the
// plain `vite` dev server (port 5199, real @capacitor web plugins) for the dev-server smoke.
import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env["CI"];
// E2E_PORT: a second engineer's targeted run on its own (already running) preview, never sharing 4319
const PREVIEW = Number(process.env["E2E_PORT"] ?? 4319);
const DEV = 5199;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./build/e2e-results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: CI,
  // retries are instrumentation, not treatment: a pass-on-retry is reported as flaky
  retries: CI ? 1 : 0,
  // canvas pages are CPU-heavy: 2 workers keep timings stable on a shared machine (E2E_WORKERS overrides)
  workers: Number(process.env["E2E_WORKERS"] ?? 2),
  reporter: [["list"], ["html", { outputFolder: "./build/e2e-report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PREVIEW}`,
    // a phone-sized portrait viewport; DPR 2 exercises the canvas zoom (1 / dpr) mapping
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    timezoneId: "Asia/Seoul",
    locale: "ko-KR",
    screenshot: "only-on-failure",
    // the canvas animates every frame: tracing costs ~6 s per test, so it is opt-in locally
    // (E2E_TRACE=1) and on the first retry in CI (a pass-on-retry = flake signal, with forensics)
    trace: process.env["E2E_TRACE"] ? "retain-on-failure" : CI ? "on-first-retry" : "off",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } },
  ],
  webServer: [
    {
      command: `npx vite build --mode e2e --logLevel warn && npx vite preview --mode e2e --port ${PREVIEW} --strictPort`,
      url: `http://localhost:${PREVIEW}/`,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
    {
      command: `npx vite --port ${DEV} --strictPort`,
      url: `http://localhost:${DEV}/`,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});

export const DEV_URL = `http://localhost:${DEV}/`;
