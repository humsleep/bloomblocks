// v14 village art — G1 screenshots of the REAL app render: the puzzle screen with the lantern-house
// (one world) + the overlap check (Wick vs plate / band / HUD captions). Safe-area insets injected.
//   node playtest/village-art-v1/shots.mjs [base=http://localhost:4412] [only=tag,…] [out=playtest/shots/v14-village/]
// Writes PNGs + overlap.json (Wick's box vs the house plate, the LineBand panel and every HUD caption).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium, webkit } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:4412";
const ONLY = (process.argv[3] ?? "").split(",").filter(Boolean);
const OUT = process.argv[4] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/v14-village/";
mkdirSync(OUT, { recursive: true });

const CFG = [
  { tag: "en15", w: 393, h: 852, top: 59, bottom: 34, locale: "en-US", engine: "chromium" },
  { tag: "ko15", w: 393, h: 852, top: 59, bottom: 34, locale: "ko-KR", engine: "chromium" },
  { tag: "enSE", w: 375, h: 667, top: 20, bottom: 0, locale: "en-US", engine: "chromium" },
  { tag: "koSE", w: 375, h: 667, top: 20, bottom: 0, locale: "ko-KR", engine: "webkit" },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const progress = (lv) => JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: lv, cleared: lv - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

async function open(browser, cfg, seed) {
  const ctx = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, deviceScaleFactor: 2, locale: cfg.locale, timezoneId: "America/New_York" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(cfg.tag, "PAGEERROR", e.message));
  await page.addInitScript(({ seed, top, bottom }) => {
    const apply = () => {
      const el = document.documentElement;
      if (!el) return false;
      el.style.setProperty("--safe-top", `${top}px`);
      el.style.setProperty("--safe-bottom", `${bottom}px`);
      return true;
    };
    if (!apply()) {
      const mo = new MutationObserver(() => {
        if (apply()) mo.disconnect();
      });
      mo.observe(document, { childList: true });
    }
    const ls = window.localStorage;
    if (seed && !ls.getItem("__e2e:seeded")) {
      ls.setItem("__e2e:seeded", "1");
      const files = {};
      for (const [k, v] of Object.entries(seed.files ?? {})) files[`LIBRARY/lanternly/${k}`] = { data: v, enc: "utf8" };
      ls.setItem("__fake:device", JSON.stringify({ files, prefs: seed.prefs ?? {}, shares: [] }));
    }
  }, { seed, top: cfg.top, bottom: cfg.bottom });
  await page.goto(BASE + "/");
  return { ctx, page };
}

async function run(cfg) {
  const browser = await (cfg.engine === "webkit" ? webkit : chromium).launch();
  const report = [];
  let n = 0;
  const ev = (page, fn, arg) => page.evaluate(fn, arg);
  const waitFor = async (page, fn, ms = 30000, arg) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        if (await ev(page, fn, arg)) return true;
      } catch {}
      await sleep(120);
    }
    return false;
  };
  const shot = async (page, name) => {
    n++;
    const f = `${cfg.tag}-${String(n).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path: OUT + f });
    // overlap: Wick (when on screen) vs plate, band panel, HUD captions — canvas px
    const o = await ev(page, () => {
      const s = window.__e2e.scene;
      const w = s.wickInfo;
      const boxes = [];
      const pl = s.plateInfo;
      if (pl) boxes.push({ what: "plate", ...pl });
      for (const ob of s.band?.objects ?? []) if (ob.visible && ob.alpha > 0.05) { const b = ob.getBounds(); boxes.push({ what: "band", x: b.x, y: b.y, w: b.width, h: b.height }); }
      for (const c of s.caps ?? []) if (c.t.visible && c.t.alpha > 0.05) { const b = c.t.getBounds(); boxes.push({ what: `cap:${c.key}`, x: b.x, y: b.y, w: b.width, h: b.height }); }
      const hits = [];
      if (w && w.visible) for (const b of boxes) {
        const ix = Math.min(w.x + w.w, b.x + b.w) - Math.max(w.x, b.x);
        const iy = Math.min(w.y + w.h, b.y + b.h) - Math.max(w.y, b.y);
        if (ix > 0 && iy > 0) hits.push(`${b.what} ${Math.round(ix)}×${Math.round(iy)}px`);
      }
      return { wick: w ? { x: Math.round(w.x), y: Math.round(w.y), w: Math.round(w.w), h: Math.round(w.h), expr: w.expr, visible: w.visible } : null, hits };
    });
    report.push({ shot: f, ...o });
    console.log(cfg.tag, f, o.wick ? `${o.wick.expr}${o.wick.visible ? "" : " (hidden)"}` : "-", o.hits.length ? `OVERLAP ${o.hits.join("; ")}` : "ok");
  };
  const tapCanvas = async (page, p) => {
    const c = await ev(page, (q) => window.__e2e.toClient(q.x, q.y), p);
    await page.mouse.click(c.x, c.y);
  };
  const tapCell = async (page, c) => {
    const p = await ev(page, (c) => window.__e2e.cellPoint(c), c);
    await page.mouse.click(p.x, p.y);
  };

  // the puzzle screen: house of the level (lantern-house), progress windows, solved heart skylight
  for (const lv of [4, 9]) {
    const { ctx, page } = await open(browser, cfg, { files: { "pips-progress.json": progress(lv) }, prefs: { guide: "511" } });
    await waitFor(page, () => window.__e2e?.ready() && window.__e2e.idle());
    await waitFor(page, () => !!window.__e2e.scene.wickInfo?.visible, 8000);
    await sleep(900);
    await shot(page, `L${lv}-board-idle`);
    const sol = await ev(page, () => window.__e2e.solution());
    for (const c of sol.slice(0, Math.ceil(sol.length / 2))) {
      await tapCell(page, c);
      await sleep(300);
    }
    await sleep(900);
    await shot(page, `L${lv}-progress-windows`);
    const have = new Set(await ev(page, () => window.__e2e.lanterns()));
    for (const c of sol) if (!have.has(c)) {
      await tapCell(page, c);
      await sleep(300);
    }
    await sleep(1500);
    await shot(page, `L${lv}-solved-heart`);
    await ctx.close();
  }
  await browser.close();
  return report;
}

const all = {};
for (const cfg of CFG) {
  if (ONLY.length && !ONLY.includes(cfg.tag)) continue;
  all[cfg.tag] = await run(cfg);
}
writeFileSync(OUT + "overlap.json", JSON.stringify(all, null, 2));
