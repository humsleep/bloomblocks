// R2 share (decision A5): the postcard result sheet + the share image, iPhone 15 and SE, en + ko,
// with the safe-area insets injected (--safe-top / --safe-bottom, index.html's #safe probe).
//   node playtest/r2-share/shots.mjs <base=http://localhost:4351> [only=tag,…] [out=playtest/shots/v13-share/]
// Build + serve first (a private out dir, so a parallel e2e run is not disturbed):
//   cd apps/client && npx vite build --mode e2e --outDir build/e2e-r2 && npx vite preview --mode e2e --outDir build/e2e-r2 --port 4351
// Per config: today's daily #14 (2026-11-14) with a 13-day streak, a story (one wrong lantern taken
// back, one hint, the rest in order), the postcard sheet, then Share → the baked PNG + the text.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium, webkit } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:4351";
const ONLY = (process.argv[3] ?? "").split(",").filter(Boolean);
const OUT = process.argv[4] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/v13-share/";
mkdirSync(OUT, { recursive: true });
const CFG = [
  { tag: "en15", w: 393, h: 852, top: 59, bottom: 34, locale: "en-US", engine: "chromium" },
  { tag: "ko15", w: 393, h: 852, top: 59, bottom: 34, locale: "ko-KR", engine: "chromium" },
  { tag: "enSE", w: 375, h: 667, top: 20, bottom: 0, locale: "en-US", engine: "chromium" },
  { tag: "koSE", w: 375, h: 667, top: 20, bottom: 0, locale: "ko-KR", engine: "webkit" },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOW = "2026-11-14T10:00:00";
const days = {};
for (let d = 1; d <= 13; d++) days[`2026-11-${String(d).padStart(2, "0")}`] = { at: Date.UTC(2026, 10, d, 12), ms: 120000 + d * 1000, hints: d % 3 === 0 ? 1 : 0, undos: 0 };

async function run(cfg) {
  const browser = await (cfg.engine === "webkit" ? webkit : chromium).launch();
  const ctx = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, deviceScaleFactor: 2, locale: cfg.locale, timezoneId: "America/New_York" });
  const page = await ctx.newPage();
  await page.addInitScript(({ top, bottom, now, days }) => {
    const ls = window.localStorage;
    if (!ls.getItem("__r2:seeded")) {
      ls.setItem("__r2:seeded", "1");
      const progress = { v: 3, game: "pips", track: "gentle", gentle: { level: 9, cleared: 8, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } };
      const files = {
        "LIBRARY/lanternly/pips-progress.json": { data: JSON.stringify(progress), enc: "utf8" },
        "LIBRARY/lanternly/pips-daily-log.json": { data: JSON.stringify({ v: 1, days }), enc: "utf8" },
      };
      const prefs = { guide: "255", dailyIntro: "1", shieldIntro: "1", streak: JSON.stringify({ v: 1, last: "2026-11-13", streak: 13, best: 13, shields: {} }) };
      ls.setItem("__fake:device", JSON.stringify({ files, prefs, shares: [] }));
    }
    const Real = Date;
    const offset = new Real(now).getTime() - Real.now();
    class Shifted extends Real {
      constructor(...a) { if (a.length === 0) super(Real.now() + offset); else super(...a); }
      static now() { return Real.now() + offset; }
    }
    globalThis.Date = Shifted;
    const apply = () => { const el = document.documentElement; if (!el) return false; el.style.setProperty("--safe-top", `${top}px`); el.style.setProperty("--safe-bottom", `${bottom}px`); return true; };
    if (!apply()) { const mo = new MutationObserver(() => { if (apply()) mo.disconnect(); }); mo.observe(document, { childList: true }); }
  }, { top: cfg.top, bottom: cfg.bottom, now: NOW, days });
  page.on("pageerror", (e) => console.log(cfg.tag, "PAGEERROR", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log(cfg.tag, "console.error", m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const waitFor = async (fn, ms = 30000, arg) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev(fn, arg)) return true; } catch {} await sleep(150); } return false; };
  const tapCell = async (c) => { const p = await ev((c) => window.__e2e.cellPoint(c), c); await page.mouse.click(p.x, p.y); };
  const tapObj = async (k) => { const p = await ev((k) => window.__e2e.objPoint(k), k); await page.mouse.click(p.x, p.y); };
  const moves = () => ev(() => window.__e2e.session.moves.length);
  const shot = async (name) => { const f = `${cfg.tag}-${name}.png`; await page.screenshot({ path: OUT + f }); console.log(cfg.tag, f); };

  await page.goto(BASE + "/");
  await waitFor(() => !!window.__e2e?.ready());
  await waitFor(() => window.__e2e.idle());
  await sleep(800);
  await tapObj("todayBtn");
  await waitFor(() => window.__e2e.session.daily === "2026-11-14");
  await waitFor(() => window.__e2e.idle());
  await sleep(600);
  // the story: a wrong lantern (taken back), one hint, then the solution in order
  const sol = await ev(() => window.__e2e.solution());
  const floor = await ev(() => { const lv = window.__e2e.session.level; const out = []; for (let r = 0; r < lv.h; r++) for (let c = 0; c < lv.w; c++) { const i = r * 8 + c; const has = ((i < 32 ? lv.stones.lo >>> i : lv.stones.hi >>> (i - 32)) & 1) === 1; if (!has) out.push(i); } return out; });
  const wrong = floor.find((c) => !sol.includes(c));
  for (const c of sol.slice(0, 2)) { const m = await moves(); await tapCell(c); await waitFor((m) => window.__e2e.session.moves.length === m + 1, 5000, m); await sleep(250); }
  { const m = await moves(); await tapCell(wrong); await waitFor((m) => window.__e2e.session.moves.length === m + 1, 5000, m); await sleep(400); }
  { const m = await moves(); await tapCell(wrong); await waitFor((m) => window.__e2e.session.moves.length === m + 1, 5000, m); await sleep(400); }
  await tapObj("hintBtn"); await sleep(900);
  const have = new Set(await ev(() => window.__e2e.lanterns()));
  for (const c of sol.filter((c) => !have.has(c))) { const m = await moves(); await tapCell(c); await waitFor((m) => window.__e2e.session.moves.length === m + 1 || window.__e2e.session.complete, 5000, m); await sleep(250); }
  await waitFor(() => !!window.__e2e.scene.card?.isOpen, 30000);
  // after the milestone / gift moment (2.9 s) has faded: the sheet at rest
  await sleep(3800);
  await shot("01-postcard-sheet");
  const spec = await ev(() => window.__e2e.scene.card.spec);
  // share: the text + the baked postcard PNG
  const before = await ev(() => window.__e2e.fakes.shares.length);
  const sp = await ev(() => window.__e2e.cardPoint("share"));
  await page.mouse.click(sp.x, sp.y);
  await waitFor((n) => window.__e2e.fakes.shares.length > n, 15000, before);
  const share = await ev(() => window.__e2e.fakes.shares.at(-1));
  const uri = share.files?.[0] ?? "";
  const b64 = await ev((k) => window.__e2e.fakes.files.get(k)?.data ?? "", uri.replace(/^fake:\/\//, ""));
  if (b64) writeFileSync(`${OUT}${cfg.tag}-02-share-image.png`, Buffer.from(b64, "base64"));
  writeFileSync(`${OUT}${cfg.tag}-share.json`, JSON.stringify({ text: share.text, files: share.files, spec }, null, 1));
  console.log(cfg.tag, "share text:", JSON.stringify(share.text), "image:", b64 ? `${Math.round(b64.length * 0.75 / 1024)} KB` : "NONE");
  await browser.close();
}

for (const cfg of CFG) if (!ONLY.length || ONLY.includes(cfg.tag)) await run(cfg);
