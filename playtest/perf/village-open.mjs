// Village open time in Chromium at 4× CPU (gate G5's "village open p75 ≤ 400 ms" is for the device;
// this is the desktop proxy): tap on the Village disc → the village's first presented frame
// ("[village] open N ms", measured from the tap by the scene). First open of a launch (chunk +
// kit + bake) and a re-open (chunk cached, textures re-baked), fresh context per launch.
//   node playtest/perf/village-open.mjs <e2e-build-url> [launches=8]
//   TAP_AT=1000|3000|10000 (ms after navigation; the first tap waits for the app's ready() at least) · RATE=4 (CPU) · VERBOSE=1
// Reports three numbers for the first open: "feedback" (the opening veil's first frame), "open" (the first village frame:
// sky and ground), "ready" (the village complete and live: houses, neighbors, hit boxes).
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
const fb = [];
const ready = [];
const wallOpen = [];
const wallReady = [];
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
  const feedbacks = [];
  const readys = [];
  let tClick = 0;
  const walls = { open: null, ready: null };
  page.on("console", (m) => {
    // wall clock from the click to the log line (independent of where the app starts its own timer)
    if (tClick && /\[village\] open \d+ ms/.test(m.text()) && walls.open === null) walls.open = Date.now() - tClick;
    if (tClick && /\[village\] (ready|open) \d+ ms/.test(m.text())) walls.ready = Date.now() - tClick;
    if (m.text().includes("[village]") && process.env.VERBOSE) console.log(m.text());
    let r = /\[village\] open (\d+) ms/.exec(m.text());
    if (r) opens.push(Number(r[1]));
    r = /\[village\] feedback (\d+) ms/.exec(m.text());
    if (r) feedbacks.push(Number(r[1]));
    r = /\[village\] ready (\d+) ms/.exec(m.text());
    if (r) readys.push(Number(r[1]));
  });
  await page.goto(URL_ + "/");
  const t0 = Date.now();
  const tapAt = Number(process.env.TAP_AT ?? (process.env.WARM ? 12000 : 3800));
  // the first tap: at TAP_AT ms after navigation (never before the app's ready())
  while (Date.now() - t0 < 30000 && !(await page.evaluate(() => !!window.__e2e?.ready()).catch(() => false))) await sleep(30);
  await sleep(Math.max(0, tapAt - (Date.now() - t0)));
  for (let k = 0; k < 2; k++) {
    if (k === 1) tClick = 0; // only the first open's wall clock
    const p = await page.evaluate(() => window.__e2e.objPoint("leftBtn"));
    const n = opens.length;
    if (k === 0) tClick = Date.now();
    await page.mouse.click(p.x, p.y);
    const t1 = Date.now();
    while (opens.length === n && Date.now() - t1 < 15000) await sleep(50);
    await sleep(k === 0 ? 1500 : 600); // the houses still coming in on a first open
    const b = await page.evaluate(() => window.__e2e.villagePoint("back"));
    if (!b) { console.log("no village", opens, await page.evaluate(() => [window.__e2e.scene?.townOpen, window.__e2e.village?.view?.screen, window.__e2e.objPoint("leftBtn")])); break; }
    await page.mouse.click(b.x, b.y);
    while (Date.now() - t1 < 15000 && (await page.evaluate(() => !!window.__e2e.village))) await sleep(50);
    await sleep(800);
  }
  first.push(opens[0]);
  again.push(opens[1]);
  wallOpen.push(walls.open);
  wallReady.push(walls.ready);
  fb.push(feedbacks[0] ?? null);
  ready.push(readys[0] ?? opens[0]);
  await ctx.close();
}
await browser.close();
const nn = (a) => a.filter((x) => x !== null);
console.log(`village open, Chromium CPU ×${process.env.RATE ?? 4}, 393×852 @3x, n=${N}, first tap ${process.env.TAP_AT ?? (process.env.WARM ? 12000 : 3800)} ms after navigation`);
console.log(`  first feedback  median ${nn(fb).length ? med(nn(fb)) : "-"} / p75 ${nn(fb).length ? p75(nn(fb)) : "-"} ms (veil; none = the open was warm)  ${JSON.stringify(fb)}`);
console.log(`  first open (first village frame)  median ${med(first)} / p75 ${p75(first)} ms  ${JSON.stringify(first)}`);
console.log(`  wall clock from the click: first village frame median ${med(nn(wallOpen))} / p75 ${p75(nn(wallOpen))} ms, village complete median ${med(nn(wallReady))} / p75 ${p75(nn(wallReady))} ms`);
console.log(`  village interactive               median ${med(ready)} / p75 ${p75(ready)} ms  ${JSON.stringify(ready)}`);
console.log(`  re-open     median ${med(again)} / p75 ${p75(again)} ms  ${JSON.stringify(again)}`);
