// 3-arm cold-start A/B in Chromium at 4x CPU throttle, 393x852 @3x, interleaved (rotating order per round).
//   node coldstart3.mjs <rounds> <nameA=url> <nameB=url> [<nameC=url>]
// Same per-launch measurement as playtest/wick-v12/coldstart.mjs ("interactive" = app probe mark, "tap" = first cell tap -> next render).
import { createRequire } from "node:module";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");

const ROUNDS = Number(process.argv[2] ?? 15);
const ARMS = process.argv.slice(3).map((a) => { const [n, ...u] = a.split("="); return [n, u.join("=")]; });
const progress = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 4, cleared: 3, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(browser, url, firstRun) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  if (!firstRun) {
    await page.addInitScript((progress) => {
      const ls = window.localStorage;
      if (!ls.getItem("__e2e:seeded")) {
        ls.setItem("__e2e:seeded", "1");
        ls.setItem("__fake:device", JSON.stringify({ files: { "LIBRARY/lanternly/pips-progress.json": { data: progress, enc: "utf8" } }, prefs: { guide: "511" }, shares: [] }));
      }
    }, progress);
  }
  let interactive = NaN;
  page.on("console", (m) => {
    const r = /\[probe\] web mark \S+ at (\d+(?:\.\d+)?) ms/.exec(m.text());
    if (r) interactive = Number(r[1]);
  });
  await page.goto(url + "/");
  const t0 = Date.now();
  while (Number.isNaN(interactive) && Date.now() - t0 < 30000) await sleep(50);
  let tap = NaN;
  if (!firstRun) {
    // wait for decorate + the faces / Wick chunk (they come after the first frame), then one tap
    while (Date.now() - t0 < 30000 && !(await page.evaluate(() => !!window.__e2e?.ready() && window.__e2e.idle()).catch(() => false))) await sleep(100);
    await sleep(2500);
    const cell = await page.evaluate(async () => (await window.__e2e.solution())[0]);
    const p = await page.evaluate((c) => window.__e2e.cellPoint(c), cell);
    await page.evaluate(() => {
      const g = window.__e2e.game;
      window.__tapT = -1;
      window.__renderAfter = -1;
      g.events.on("postrender", () => {
        if (window.__tapT > 0 && window.__renderAfter < 0) window.__renderAfter = performance.now();
      });
      window.addEventListener("pointerdown", () => { window.__tapT = performance.now(); }, { capture: true, once: true });
    });
    await page.mouse.click(p.x, p.y);
    await sleep(800);
    tap = await page.evaluate(() => window.__renderAfter - window.__tapT);
  }
  await ctx.close();
  return { interactive, tap };
}

const med = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const p75 = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.ceil(s.length * 0.75) - 1] : NaN; };
const mad = (a) => { const m = med(a); return med(a.filter(Number.isFinite).map((x) => Math.abs(x - m))); };
const browser = await chromium.launch();
const out = {};
for (const firstRun of [false, true]) {
  const res = Object.fromEntries(ARMS.map(([n]) => [n, { i: [], t: [] }]));
  for (let r = 0; r < ROUNDS; r++) {
    const order = ARMS.map((_, k) => ARMS[(k + r) % ARMS.length]);
    for (const [k, url] of order) {
      const m = await launch(browser, url, firstRun);
      res[k].i.push(m.interactive);
      res[k].t.push(m.tap);
    }
  }
  out[firstRun ? "firstRun" : "returning"] = res;
  console.log(firstRun ? "first run (tutorial)" : "returning player (gentle 4)", `n=${ROUNDS} each, CPU x4`);
  for (const [k] of ARMS) console.log(`  ${k}: interactive median ${med(res[k].i).toFixed(0)} / p75 ${p75(res[k].i).toFixed(0)} / MAD ${mad(res[k].i).toFixed(0)} ms` + (firstRun ? "" : ` | first tap->render median ${med(res[k].t).toFixed(1)} / p75 ${p75(res[k].t).toFixed(1)} ms`));
  console.log(`  raw ${JSON.stringify(res)}`);
}
await browser.close();
import("node:fs").then((fs) => fs.writeFileSync(new URL(`./coldstart3-${Date.now()}.json`, import.meta.url), JSON.stringify(out)));
