// Village open time in Chromium at 4× CPU (gate G5's "village open p75 ≤ 400 ms" is for the device;
// this is the desktop proxy): tap on the Village disc → the village's first presented frame
// ("[village] open N ms", measured from the tap by the scene). First open of a launch (chunk +
// kit + bake) and a re-open (chunk cached, textures re-baked), fresh context per launch.
//   node playtest/perf/village-open.mjs <e2e-build-url> [launches=8]
import { createRequire } from "node:module";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");

const URL_ = process.argv[2] ?? "http://localhost:4402";
const N = Number(process.argv[3] ?? 8);
const progress = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 9, cleared: 8, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p75 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.ceil(s.length * 0.75) - 1]; };
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };

const browser = await chromium.launch();
const first = [];
const again = [];
for (let i = 0; i < N; i++) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.RATE ?? 4) });
  await page.addInitScript((progress) => {
    const ls = window.localStorage;
    if (!ls.getItem("__e2e:seeded")) {
      ls.setItem("__e2e:seeded", "1");
      ls.setItem("__fake:device", JSON.stringify({ files: { "LIBRARY/lanternly/pips-progress.json": { data: progress, enc: "utf8" } }, prefs: { guide: "511", dailyIntro: "1", dailyOffer: "1" }, shares: [] }));
    }
  }, progress);
  if (process.env.PROBE) await page.addInitScript(() => { globalThis.__villageRasterProbe = true; });
  const opens = [];
  page.on("console", (m) => {
    if (m.text().includes("[village]") && process.env.VERBOSE) console.log(m.text());
    const r = /\[village\] open (\d+) ms/.exec(m.text());
    if (r) opens.push(Number(r[1]));
  });
  await page.goto(URL_ + "/");
  const t0 = Date.now();
  while (Date.now() - t0 < 30000 && !(await page.evaluate(() => !!window.__e2e?.ready() && window.__e2e.idle()).catch(() => false))) await sleep(100);
  // WARM=1: wait past the prewarm (6 s after launch); default: tap 2.5 s after launch (cold chunks)
  await sleep(Number(process.env.DELAY_MS ?? 2500));
  for (let k = 0; k < 2; k++) {
    const p = await page.evaluate(() => window.__e2e.objPoint("leftBtn"));
    const n = opens.length;
    await page.mouse.click(p.x, p.y);
    const t1 = Date.now();
    while (opens.length === n && Date.now() - t1 < 15000) await sleep(50);
    await sleep(600);
    const b = await page.evaluate(() => window.__e2e.villagePoint("back"));
    if (!b) { console.log("no village", opens, await page.evaluate(() => [window.__e2e.scene?.townOpen, window.__e2e.village?.view?.screen, window.__e2e.objPoint("leftBtn")])); break; }
    await page.mouse.click(b.x, b.y);
    while (Date.now() - t1 < 15000 && (await page.evaluate(() => !!window.__e2e.village))) await sleep(50);
    await sleep(800);
  }
  first.push(opens[0]);
  again.push(opens[1]);
  await ctx.close();
}
await browser.close();
console.log(`village open, Chromium CPU ×4, 393×852 @3x, n=${N}`);
console.log(`  first open  median ${med(first)} / p75 ${p75(first)} ms  ${JSON.stringify(first)}`);
console.log(`  re-open     median ${med(again)} / p75 ${p75(again)} ms  ${JSON.stringify(again)}`);
