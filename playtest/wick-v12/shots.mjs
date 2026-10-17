// Wick v12 screenshots + overlap check (decision A4). Drives the e2e web build like a player, with
// iPhone safe-area insets injected (--safe-top / --safe-bottom, as index.html's #safe probe reads them).
//   node playtest/wick-v12/shots.mjs [base=http://localhost:4402] [only=tag,…] [out=playtest/shots/v12-wick/]
// Writes PNGs + overlap.json (Wick's box vs the house plate, the LineBand panel and every HUD caption).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium, webkit } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:4402";
const ONLY = (process.argv[3] ?? "").split(",").filter(Boolean);
const OUT = process.argv[4] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/v12-wick/";
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

  // 1. tutorial (fresh device): Wick is the guide
  {
    const { ctx, page } = await open(browser, cfg, null);
    await waitFor(page, () => window.__e2e?.scene?.tut?.step === 1, 30000);
    await sleep(2100);
    await shot(page, "tut-T1-wick-guide");
    await tapCanvas(page, await ev(page, () => window.__e2e.scene.tut.cellPoint(window.__e2e.scene.tut.target)));
    await waitFor(page, () => window.__e2e.scene.tut?.step === 2, 15000);
    // T2 shows the guide only after 6 s without a tap
    await waitFor(page, () => !!window.__e2e.scene.tut?.actor?.active, 12000);
    await sleep(1150);
    await shot(page, "tut-T2-wick-on-cell");
    await ctx.close();
  }

  // 2. a gentle board: hero, faces, conflict, hint, solved
  {
    const { ctx, page } = await open(browser, cfg, { files: { "pips-progress.json": progress(4) }, prefs: { guide: "511" } });
    await waitFor(page, () => window.__e2e?.ready() && window.__e2e.idle());
    await waitFor(page, () => !!window.__e2e.scene.wickInfo?.visible, 8000);
    await sleep(800);
    await shot(page, "board-hero-idle");
    const info = await ev(page, async () => {
      const api = await window.__e2e.api();
      return { pair: api.seeingPair(window.__e2e.session.level), sol: await window.__e2e.solution() };
    });
    if (info.pair) {
      await tapCell(page, info.pair[0]);
      await sleep(300);
      await tapCell(page, info.pair[1]);
      await sleep(1300);
      await shot(page, "conflict-worried-faces");
      await tapCell(page, info.pair[1]);
      await sleep(300);
      await tapCell(page, info.pair[0]);
      await sleep(500);
    }
    // two right lanterns, then a hint
    for (const c of info.sol.slice(0, 2)) {
      await tapCell(page, c);
      await sleep(350);
    }
    await sleep(700);
    await shot(page, "faces-idle-placed");
    await tapCanvas(page, await ev(page, () => window.__e2e.scene.hudPoints().hint));
    await sleep(900);
    await shot(page, "hint-wick-curious");
    // solve the rest
    const have = new Set(await ev(page, () => window.__e2e.lanterns()));
    for (const c of info.sol) if (!have.has(c)) {
      await tapCell(page, c);
      await sleep(320);
    }
    await sleep(520);
    await shot(page, "solved-hop");
    await sleep(900);
    await shot(page, "solved-happy-faces");
    await waitFor(page, () => window.__e2e.idle(), 20000);
    // doze (as if 60 s passed without a touch)
    await sleep(600);
    await ev(page, () => { window.__e2e.scene.lastInput -= 60000; });
    await sleep(700);
    await shot(page, "doze-sleepy");
    // settings: the lantern faces row, then off
    await tapCanvas(page, await ev(page, () => window.__e2e.scene.hudPoints().gear));
    await sleep(700);
    await shot(page, "settings-faces-row");
    const k = 15;
    const p = await ev(page, (k) => window.__e2e.sheetPoint(k), k);
    await page.mouse.click(p.x, p.y);
    await sleep(400);
    await shot(page, "settings-faces-off");
    const close = await ev(page, () => { const b = window.__e2e.scene.sheet.closeBox(); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
    await tapCanvas(page, close);
    await sleep(500);
    const sol2 = await ev(page, () => window.__e2e.solution());
    for (const c of sol2.slice(0, 2)) {
      await tapCell(page, c);
      await sleep(350);
    }
    await sleep(800);
    await shot(page, "faces-off-board");
    const pref = await ev(page, () => window.__e2e.pref("lanternFaces"));
    console.log(cfg.tag, "pref lanternFaces =", pref);
    report.push({ pref });
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
