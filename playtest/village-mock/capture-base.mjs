// Captures the real app (e2e build with Wick) at 430×932 @3x (= 1290×2796) as the base of mockup (d)
// and the dimmed backdrop of (c). Safe-area insets 59/34 as on an iPhone 15 Pro Max.
import { createRequire } from "node:module";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");
const BASE = process.argv[2] ?? "http://localhost:4402";
const OUT = new URL("./base/", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const progress = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 9, cleared: 8, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, locale: "en-US" });
const page = await ctx.newPage();
await page.addInitScript((progress) => {
  const set = () => { const el = document.documentElement; if (!el) return false; el.style.setProperty("--safe-top", "59px"); el.style.setProperty("--safe-bottom", "34px"); return true; };
  if (!set()) { const mo = new MutationObserver(() => { if (set()) mo.disconnect(); }); mo.observe(document, { childList: true }); }
  const ls = localStorage;
  if (!ls.getItem("__e2e:seeded")) { ls.setItem("__e2e:seeded", "1"); ls.setItem("__fake:device", JSON.stringify({ files: { "LIBRARY/lanternly/pips-progress.json": { data: progress, enc: "utf8" } }, prefs: { guide: "511", dailyIntro: "1" }, shares: [] })); }
}, progress);
await page.goto(BASE + "/");
for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.__e2e?.ready() && window.__e2e.idle()).catch(() => false)); i++) await sleep(100);
await sleep(2500);
const sol = await page.evaluate(() => window.__e2e.solution());
for (const c of sol.slice(0, 3)) { const p = await page.evaluate((c) => window.__e2e.cellPoint(c), c); await page.mouse.click(p.x, p.y); await sleep(400); }
await sleep(1500);
await page.screenshot({ path: OUT + "board.png" });
for (const c of sol.slice(3)) { const p = await page.evaluate((c) => window.__e2e.cellPoint(c), c); await page.mouse.click(p.x, p.y); await sleep(350); }
await sleep(1600);
await page.screenshot({ path: OUT + "solved.png" });
console.log(JSON.stringify(await page.evaluate(() => { const s = window.__e2e.scene; return { hud: s.hudPoints(), geo: s.geo, u: s.u }; })));
await b.close();
