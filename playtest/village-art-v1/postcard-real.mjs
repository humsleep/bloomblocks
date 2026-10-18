// The REAL app-baked room postcard (VillageScene.bakeRoomPostcard → the PNG the share sheet gets), 1080 × 1350,
// en + ko (+ ja when asked): the same flow as e2e village.spec "requests" (a seat fulfils Momo's request → a visitor),
// then the PNG is read back from the scene. Uses its own preview port.
//   node playtest/village-art-v1/postcard-real.mjs [base=http://localhost:4426] [out=playtest/shots/village-v5/] [locales=en-US,ko-KR]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");
const BASE = process.argv[2] ?? "http://localhost:4426";
const OUT = process.argv[3] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/village-v5/";
const LOCALES = (process.argv[4] ?? "en-US,ko-KR").split(",");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = Math.floor(Date.UTC(2026, 9, 14) / 86_400_000);
const village = JSON.stringify({ sv: { pd: [DAY], ch: [], lr: [1], u: [], mk: [], q: [4], w: [], r: {} }, loc: { visits: 3, lastVisit: DAY - 1, season: "autumn" } });
const progress = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 9, cleared: 8, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

const browser = await chromium.launch();
for (const locale of LOCALES) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, locale });
  const page = await ctx.newPage();
  await page.addInitScript(({ village, progress }) => {
    const ls = window.localStorage;
    if (!ls.getItem("__e2e:seeded")) {
      ls.setItem("__e2e:seeded", "1");
      ls.setItem("__fake:device", JSON.stringify({ files: { "LIBRARY/lanternly/pips-progress.json": { data: progress, enc: "utf8" } }, prefs: { dailyIntro: "1", dailyOffer: "1", guide: "511", village }, shares: [] }));
      ls.setItem("__e2e:now", "2026-10-14T19:00:00");
    }
    const target = ls.getItem("__e2e:now");
    if (target) {
      const Real = Date;
      const offset = new Real(target).getTime() - Real.now();
      globalThis.Date = class extends Real {
        constructor(...a) { if (a.length === 0) super(Real.now() + offset); else super(...a); }
        static now() { return Real.now() + offset; }
      };
    }
  }, { village, progress });
  await page.goto(BASE + "/");
  const until = async (fn, arg, ms = 25000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { if (await page.evaluate(fn, arg)) return true; } catch {} await sleep(150); }
    return false;
  };
  await until(() => !!window.__e2e?.ready?.() && window.__e2e.idle());
  const lp = await page.evaluate(() => window.__e2e.objPoint("leftBtn"));
  await page.mouse.click(lp.x, lp.y);
  await until(() => window.__e2e.village?.["view"]?.screen === "village");
  await sleep(500);
  const tap = async (id) => {
    await until((i) => !!window.__e2e.villagePoint(i), id, 10000);
    const p = await page.evaluate((i) => window.__e2e.villagePoint(i), id);
    await page.mouse.click(p.x, p.y);
    await sleep(450);
  };
  await tap("cottage");
  await tap("slot-12");
  await tap("card-cushion");
  await sleep(600);
  const b64 = await page.evaluate(() => window.__e2e.village?.["bakeRoomPostcard"]?.() ?? null);
  if (!b64) console.log(locale, "NO PNG");
  else {
    const f = `${OUT}postcard-real-${locale.slice(0, 2)}.png`;
    writeFileSync(f, Buffer.from(b64, "base64"));
    console.log(locale, "wrote", f, Math.round((b64.length * 3) / 4 / 1024), "KB");
  }
  await ctx.close();
}
await browser.close();
