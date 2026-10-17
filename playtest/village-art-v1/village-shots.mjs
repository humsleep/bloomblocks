// Village screens of the REAL app (e2e build) — the same flow as apps/client/e2e/village-shots.spec.ts,
// run on its own preview port so it never shares the Playwright web server with another engineer's run.
//   (cd apps/client && npx vite build --mode e2e --outDir <dir> && npx vite preview --mode e2e --outDir <dir> --port 4414)
//   node playtest/village-art-v1/village-shots.mjs [base=http://localhost:4414] [out=playtest/shots/village-v2/]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:4414";
const OUT = process.argv[3] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/village-v2/";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const progress = (lv) => JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: lv, cleared: lv - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const ALL_GUIDES = "511";

const browser = await chromium.launch();
for (const size of [{ tag: "se", w: 375, h: 667 }, { tag: "pm", w: 390, h: 844 }]) {
  for (const locale of (process.argv[4] ?? "ko-KR,en-US").split(",")) {
    const tag = `${size.tag}-${locale.slice(0, 2)}`;
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, locale });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.addInitScript(({ p, guide }) => {
      const ls = window.localStorage;
      if (!ls.getItem("__e2e:seeded")) {
        ls.setItem("__e2e:seeded", "1");
        ls.setItem("__fake:device", JSON.stringify({ files: { "LIBRARY/lanternly/pips-progress.json": { data: p, enc: "utf8" } }, prefs: { guide }, shares: [] }));
      }
    }, { p: progress(9), guide: ALL_GUIDES });
    await page.goto(BASE + "/");
    const until = async (fn, ms = 20000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try {
          if (await page.evaluate(fn)) return true;
        } catch {}
        await sleep(120);
      }
      return false;
    };
    await until(() => !!window.__e2e?.ready?.() && window.__e2e.idle());
    const shot = (name) => page.screenshot({ path: `${OUT}${tag}-${name}.png` });
    const tapHit = async (id) => {
      await until((i) => !!window.__e2e.villagePoint(i), 10000);
      const p = await page.evaluate((i) => window.__e2e.villagePoint(i), id);
      if (!p) throw new Error(`no hit ${id}`);
      await page.mouse.click(p.x, p.y);
      await sleep(350);
    };
    const lp = await page.evaluate(() => window.__e2e.objPoint("leftBtn"));
    await page.mouse.click(lp.x, lp.y);
    await until(() => window.__e2e.village?.["view"]?.screen === "village", 15000);
    await sleep(600);
    await shot("1-village");
    await tapHit("res-momo");
    await shot("2-talk");
    await tapHit("mailbox");
    await shot("3-letter");
    await tapHit("letter-gift");
    await sleep(300);
    await shot("4-gift");
    await tapHit("gift-put");
    await sleep(300);
    await shot("5-room");
    await tapHit("slot-13");
    await shot("6-drawer");
    console.log(tag, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
    await ctx.close();
  }
}
await browser.close();
