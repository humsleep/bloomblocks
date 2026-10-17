// Render the cute-direction mockups to PNG: node playtest/cute-mock/render.mjs
// Uses the client's Playwright (apps/client/node_modules). Output: playtest/shots/cute-mock/
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/client/package.json"));
const { chromium } = require("playwright");
const out = path.join(here, "../shots/cute-mock");
const jobs = [
  ["sheet", "01-mascot-sheet.png", 2],
  ["play", "02-play-cute.png", 3],
  ["result", "03-result-postcard.png", 3],
  ["store", "04-store-shot-1.png", 3],
];
const browser = await chromium.launch();
for (const [view, file, dpr] of jobs) {
  const page = await browser.newPage({ deviceScaleFactor: dpr, viewport: { width: 1600, height: 1000 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(pathToFileURL(path.join(here, "mock.html")).href + "?view=" + view);
  await page.waitForSelector("body[data-ready='1']", { timeout: 10000 });
  await page.locator("#root > svg").screenshot({ path: path.join(out, file) });
  console.log(file, errs.length ? errs : "ok");
  await page.close();
}
await browser.close();
