// Render SVG files to 1024 PNGs with the Playwright Chromium already installed for apps/client.
// usage: node render.mjs <outDir> <a.svg> [b.svg ...]   (or: node render.mjs --html <page.html> <out.png> <w> <h>)
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const browser = await chromium.launch();
if (args[0] === "--html") {
  const [, html, out, w, h] = args;
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  await page.goto("file://" + html);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, fullPage: true });
} else {
  const [outDir, ...svgs] = args;
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  for (const f of svgs) {
    const svg = readFileSync(f, "utf8");
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
    const out = join(outDir, basename(f).replace(/\.svg$/, "-1024.png"));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1024, height: 1024 }, omitBackground: true });
    console.log(out);
  }
}
await browser.close();
