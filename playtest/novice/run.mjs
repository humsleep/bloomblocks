// Novice first-10-minutes walkthrough (read-only on src). Drives the e2e web build like a
// first-time player: fresh device (empty storage), real taps at real cell/HUD points.
// The bridge (window.__e2e) is used ONLY to locate points and to know which cells are
// right/wrong; the screenshots are what the player sees.
//   node playtest/novice/run.mjs [base=http://localhost:4339] [only=tag[,tag…]] [out=playtest/shots/v11/]
// v11 (playtest/ux-v11.md): the first run is the "first yard" tutorial (T1–T5 + end card), then
// gentle 1 with the error line, the hint line, the solved moment + "Next house →", the "?" sheet,
// settings (✕), gentle 2–5, the daily's welcome card and its labelled result sheet.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium, webkit } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:4339";
const ONLY = process.argv[3] ?? "";
const OUT = process.argv[4] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/v11/";
mkdirSync(OUT, { recursive: true });

const CFG = [
  { tag: "en15", w: 393, h: 852, locale: "en-US", engine: "chromium" },
  { tag: "ko15", w: 393, h: 852, locale: "ko-KR", engine: "chromium" },
  { tag: "enSE", w: 375, h: 667, locale: "en-US", engine: "chromium" },
  { tag: "koSE", w: 375, h: 667, locale: "ko-KR", engine: "webkit" },
  // v12 (playtest/i18n-v12.md): Italian, Simplified (Singapore), Traditional (Taiwan) — out: playtest/shots/v11-i18n/
  { tag: "it15", w: 393, h: 852, locale: "it-IT", engine: "chromium" },
  { tag: "itSE", w: 375, h: 667, locale: "it-IT", engine: "webkit" },
  { tag: "zhHans15", w: 393, h: 852, locale: "zh-SG", engine: "chromium" },
  { tag: "zhHansSE", w: 375, h: 667, locale: "zh-SG", engine: "webkit" },
  { tag: "zhHant15", w: 393, h: 852, locale: "zh-TW", engine: "chromium" },
  { tag: "zhHantSE", w: 375, h: 667, locale: "zh-TW", engine: "webkit" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(cfg) {
  const browser = await (cfg.engine === "webkit" ? webkit : chromium).launch();
  const ctx = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, deviceScaleFactor: 2, locale: cfg.locale, timezoneId: "America/New_York", hasTouch: false });
  const page = await ctx.newPage();
  const log = [];
  const t0 = Date.now();
  const note = (m) => { const l = `${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`; log.push(l); console.log(cfg.tag, l); };
  page.on("pageerror", (e) => note(`PAGEERROR ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") note(`console.error ${m.text()}`); });
  let n = 0;
  const shot = async (name) => { n++; const f = `${cfg.tag}-${String(n).padStart(2, "0")}-${name}.png`; await page.screenshot({ path: OUT + f }); note(`shot ${f}`); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const waitFor = async (fn, ms = 30000, arg) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev(fn, arg)) return true; } catch {} await sleep(150); } return false; };
  const client = (p) => ev((q) => window.__e2e.toClient(q.x, q.y), p);
  const tapAt = async (p, what) => { const c = await client(p); await page.mouse.click(c.x, c.y); note(`tap ${what} @${Math.round(c.x)},${Math.round(c.y)}`); };
  const tapCell = async (c) => { const p = await ev((c) => window.__e2e.cellPoint(c), c); await page.mouse.click(p.x, p.y); note(`tap cell ${c} r${c >> 3}c${c & 7}`); };
  const tapObj = async (k) => { const p = await ev((k) => window.__e2e.objPoint(k), k); await page.mouse.click(p.x, p.y); note(`tap ${k} @${Math.round(p.x)},${Math.round(p.y)}`); };
  const tut = () => ev(() => { const t = window.__e2e.scene.tut; return t ? { step: t.step, target: t.target, band: t.bandText } : null; });
  const tapTut = async (c) => tapAt(await ev((c) => window.__e2e.scene.tut.cellPoint(c), c), `yard ${c}`);
  const tutWant = async (cell) => waitFor((c) => window.__e2e.scene.tut?.target === c, 20000, cell);
  const lvInfo = () => ev(async () => {
    const api = await window.__e2e.api();
    const s = window.__e2e.session; const lv = s.level;
    const has = (bb, i) => ((i < 32 ? bb.lo >>> i : bb.hi >>> (i - 32)) & 1) === 1;
    const floor = []; const stones = [];
    for (let r = 0; r < lv.h; r++) for (let c = 0; c < lv.w; c++) { const i = r * 8 + c; (has(lv.stones, i) ? stones : floor).push(i); }
    const sol = await window.__e2e.solution();
    const pair = api.seeingPair(lv);
    return { n: s.levelNumber, track: s.track, w: lv.w, h: lv.h, floor, stones, clues: stones.map((i) => [i, lv.clues[i]]), sol, pair };
  });
  const lanterns = () => ev(() => window.__e2e.lanterns());
  const band = () => ev(() => window.__e2e.scene.bandText);
  const solveRest = async (gap = 450) => { const sol = await ev(() => window.__e2e.solution()); const have = new Set(await lanterns()); for (const c of sol) if (!have.has(c)) { await tapCell(c); await sleep(gap); } };
  const next = async () => { if (await waitFor(() => !!window.__e2e.scene.nextPoint, 15000)) await tapAt(await ev(() => window.__e2e.scene.nextPoint), "next house"); };
  const level = (k) => waitFor((k) => window.__e2e.session.levelNumber === k && window.__e2e.scene.isIdle(), 30000, k);

  // ---------------------------------------------------------------- 1. first launch → the first-yard tutorial
  const nav = page.goto(BASE + "/");
  await sleep(250); await shot("t0.25-first-frame");
  await nav.catch(() => {});
  await waitFor(() => !!window.__e2e?.ready());
  note("ready");
  await waitFor(() => window.__e2e.scene.tut?.step === 1, 20000);
  await sleep(1500); await shot("tut-T1-tap-a-tile");
  await tapTut(2); await sleep(600); await shot("tut-T1-light-fills-row");
  await waitFor(() => window.__e2e.scene.tut?.step === 2, 15000); await sleep(500); await shot("tut-T2-stones-block");
  await tutWant(18); await sleep(500); await shot("tut-T2-light-every-tile");
  await tapTut(0); await sleep(500); await shot("tut-T2-wrong-tap-why");
  await sleep(1200); await tapTut(18); await sleep(800);
  await tutWant(1); await shot("tut-T2-last-dark-tile");
  await tapTut(1); await sleep(450); await shot("tut-T2-solved");
  await waitFor(() => window.__e2e.scene.tut?.step === 3, 15000); await sleep(1700); await shot("tut-T3-guide-places-extra");
  await tutWant(3); await sleep(300); await shot("tut-T3-tap-to-remove");
  await tapTut(3); await sleep(700);
  await tutWant(9); await tapTut(9); await sleep(500); await tutWant(11); await tapTut(11); await sleep(450); await shot("tut-T3-stone-between-fine");
  await waitFor(() => window.__e2e.scene.tut?.step === 4, 15000); await sleep(1500); await shot("tut-T4-number-sides");
  await tutWant(8); await tapTut(16); await sleep(450); await shot("tut-T4-corner-wrong");
  await sleep(1000); await tapTut(8); await sleep(1000); await shot("tut-T4-two-is-done");
  await tutWant(18); await tapTut(17); await sleep(450); await shot("tut-T4-too-many");
  await sleep(1000); await tapTut(18); await sleep(500);
  await waitFor(() => window.__e2e.scene.tut?.step === 5, 15000); await sleep(700); await shot("tut-T5-zero");
  await tapTut(2); await sleep(500);
  await waitFor(() => window.__e2e.scene.tut?.step === 6, 15000); await sleep(800); await shot("tut-end-card");
  note(`tutorial ${JSON.stringify(await ev(() => window.__e2e.scene.tut.log))}`);
  await tapAt(await ev(() => window.__e2e.scene.tut.cardButton), "start");
  await waitFor(() => !window.__e2e.scene.tut, 10000); await sleep(900); await shot("L1-board-after-tutorial");

  // ---------------------------------------------------------------- 2. gentle 1: the error line, hints, the solved moment
  let L = await lvInfo(); note(`level ${JSON.stringify(L)}`);
  await tapCell(L.stones[0]); await sleep(600); await shot("L1-stone-tap-line"); note(`band: ${await band()}`);
  await sleep(2600);
  if (L.pair) {
    await tapCell(L.pair[0]); await sleep(250); await tapCell(L.pair[1]); await sleep(1400); await shot("L1-conflict-line"); note(`band: ${await band()}`);
    await tapCell(L.pair[1]); await sleep(250); await tapCell(L.pair[0]); await sleep(600);
  }
  // a wrong lantern → (gentle 1–3) no stuck marks, one line
  const wrong = L.floor.find((c) => !L.sol.includes(c));
  await tapCell(wrong); await sleep(1500); await shot("L1-wrong-spot-line"); note(`band: ${await band()}`);
  await tapObj("hintBtn"); await sleep(900); await shot("L1-hint-remove-line"); note(`band: ${await band()}`);
  await tapObj("hintBtn"); await sleep(700);
  await solveRest(500);
  await sleep(700); await shot("L1-solved-moment");
  await waitFor(() => !!window.__e2e.scene.nextPoint, 15000); await sleep(400); await shot("L1-next-house-button");
  await next();
  await level(2); await sleep(1600); await shot("L2-number-review-demo");

  // ---------------------------------------------------------------- 3. the "?" sheet and settings
  await tapAt(await ev(() => ({ x: window.__e2e.scene.howBtn.x, y: window.__e2e.scene.howBtn.y })), "?");
  await waitFor(() => window.__e2e.scene.howTo?.isOpen, 10000); await sleep(1500); await shot("how-to-play-sheet");
  await ev(() => window.__e2e.scene.howTo.revealReplay()); await sleep(1400); await shot("how-to-play-sheet-bottom");
  await tapAt(await ev(() => window.__e2e.scene.howTo.point("close")), "close"); await sleep(600);
  await tapObj("gearIcon"); await sleep(900); await shot("settings-with-close");
  await tapAt(await ev(() => { const b = window.__e2e.scene.sheet.closeBox(); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }), "settings ✕"); await sleep(600);

  // ---------------------------------------------------------------- 4. gentle 2–5, then the daily
  for (let k = 2; k <= 5; k++) {
    await level(k);
    await solveRest(350);
    if (k <= 3) await next();
  }
  await level(6); await sleep(1800); await shot("L6-today-button");
  await tapObj("todayBtn");
  await waitFor(() => window.__e2e.scene.ask?.kind === "dailyIntro", 15000); await sleep(600); await shot("daily-welcome-card");
  await tapAt(await ev(() => window.__e2e.askPoint("yes")), "welcome ok");
  await waitFor(() => !!window.__e2e.session.daily && window.__e2e.scene.isIdle(), 20000); await sleep(500);
  await solveRest(400);
  await waitFor(() => !!window.__e2e.scene.card?.isOpen, 20000);
  await sleep(4000); await shot("daily-result-sheet");
  note(`log ${await ev(() => window.__e2e.scene.flowLog.join(" "))}`);
  writeFileSync(`${OUT}${cfg.tag}-log.txt`, log.join("\n"));
  await browser.close();
}

for (const c of CFG) if (!ONLY || ONLY.split(",").includes(c.tag)) { try { await run(c); } catch (e) { console.error(c.tag, "FAILED", e); } }
