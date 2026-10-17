// Render Wick v2 sheets: node playtest/cute-mock/render2.mjs [view ...]
// Uses the client's Playwright. Output: playtest/shots/wick-v2/
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/client/package.json"));
const { chromium } = require("playwright");
const out = path.join(here, "../shots/wick-v2");
fs.mkdirSync(out, { recursive: true });
const jobs = [
  ["variants", "01-variants-app-scale.png", 2],
  ["anim", "02-motion-frames.png", 2],
  ["friends", "03-wick-friends.png", 2],
  ["misread", "04-misread-test.png", 2],
  ["board", "05-in-app-board-faces.png", 2],
  ["tutorial", "06-tutorial-guide.png", 2],
  ["result", "07-result-postcard.png", 2],
  ["town", "08-town.png", 2],
  ["icon", "09-icon-ab.png", 2],
  ["store", "10-store-hero-1290x2796.png", 3],
  ["construction", "11-construction-spec.png", 2],
];
const only = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
for (const [view, file, dpr] of jobs) {
  if (only.length && !only.includes(view)) continue;
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1800, height: 1200 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.goto(pathToFileURL(path.join(here, "v2.html")).href + `?view=${view}&dpr=${dpr}${process.env.EXPLORE ? "&explore=1" : ""}`);
  await page.waitForSelector("body[data-ready='1']", { timeout: 15000 });
  // canvas backing store is already dpr-scaled → export it directly at native resolution
  const dataUrl = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    try { return c.toDataURL("image/png"); } catch { return null; }
  });
  if (dataUrl) fs.writeFileSync(path.join(out, file), Buffer.from(dataUrl.split(",")[1], "base64"));
  else {
    await page.setViewportSize({ width: 1800, height: 1200 });
    const p2 = await browser.newPage({ deviceScaleFactor: dpr, viewport: { width: 1800, height: 1200 } });
    await p2.goto(pathToFileURL(path.join(here, "v2.html")).href + `?view=${view}&dpr=1`);
    await p2.waitForSelector("body[data-ready='1']", { timeout: 15000 });
    await p2.locator("canvas").first().screenshot({ path: path.join(out, file) });
    await p2.close();
  }
  const res = await page.evaluate(() => window.__results || null);
  if (res) fs.writeFileSync(path.join(out, "04-misread-iou.json"), JSON.stringify(res, null, 2));
  console.log(file, errs.length ? errs : "ok", res ? JSON.stringify(res) : "");
  await page.close();
}
await browser.close();
