// R2 fix (decisions A1 / A7): safe-area screenshots + a layout check on every shot.
// Drives the e2e web build like a first-time player (playtest/novice/run.mjs path) with the iPhone
// insets injected (--safe-top / --safe-bottom, read by index.html's #safe probe):
//   node playtest/r2-fix/shots.mjs <base=http://localhost:4319> [only=tag,…] [out=playtest/shots/v13/after/]
// Writes PNGs + layout.json: per shot the boxes (canvas px) and every rule broken:
//   next×grid      "Next house" over a board row             (P1-1)
//   word×stone     "Solved!" over a number stone             (P1-1)
//   board×home     the board frame in the home-indicator zone (P1-1, board at rest)
//   board×shift    the board's rest y moved during the solved moment (P1-1)
//   plate×early    the plate shows a number that is not the board's (P1-2)
//   band×plate     the error / hint line over the house plate (P1-3)
//   band×house     … over the house's door area (P1-3)
//   band×grid      … over the board's cells (P1-3)
//   wick×…         Wick over the plate / band / a caption (A4 rule, kept)
//   cap×cap / cap×hud / cap×edge  captions colliding / clipped
//   hud×safe       a HUD control in the status bar / home-indicator zone
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium, webkit } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:4319";
const ONLY = (process.argv[3] ?? "").split(",").filter(Boolean);
const OUT = process.argv[4] ?? "/Users/hyukahn/workspace/puzzle-lab/playtest/shots/v13/after/";
mkdirSync(OUT, { recursive: true });

const CFG = [
  { tag: "en15", w: 393, h: 852, top: 59, bottom: 34, locale: "en-US", engine: "chromium" },
  { tag: "ko15", w: 393, h: 852, top: 59, bottom: 34, locale: "ko-KR", engine: "chromium" },
  { tag: "enSE", w: 375, h: 667, top: 20, bottom: 0, locale: "en-US", engine: "chromium" },
  { tag: "koSE", w: 375, h: 667, top: 20, bottom: 0, locale: "ko-KR", engine: "webkit" },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// in-page: every box of interest (canvas px) and the broken rules
function measure(arg) {
  const s = window.__e2e.scene;
  const g = s.geo;
  const u = g.u;
  const sess = window.__e2e.session;
  const lv = sess.level;
  const safe = s.deps.safe;
  const out = { boxes: {}, hits: [] };
  const vis = (o) => o && o.visible && o.alpha > 0.05;
  const bb = (o) => { const b = o.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const hit = (a, b) => a && b && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
  const area = (a, b) => `${Math.round(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))}×${Math.round(Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))}`;
  const r = s.board.root;
  const boardOn = !s.tut && !s.tutWanted && r.alpha > 0.5;
  const gw = g.cs * lv.w * r.scaleX;
  const gh = g.cs * lv.h * r.scaleY;
  const grid = { x: r.x - gw / 2, y: r.y - gh / 2, w: gw, h: gh };
  const frame = { x: grid.x - g.pad * r.scaleX, y: grid.y - g.pad * r.scaleY, w: gw + 2 * g.pad * r.scaleX, h: gh + 2 * g.pad * r.scaleY };
  const home = { x: 0, y: g.H - safe.bottom * u, w: g.W, h: safe.bottom * u };
  const status = { x: 0, y: 0, w: g.W, h: safe.top * u };
  out.boxes.grid = grid;
  out.boxes.frame = frame;
  const stones = [];
  for (let i = 0; i < 64; i++) {
    const x = i & 7, y = i >> 3;
    if (x >= lv.w || y >= lv.h || lv.clues[i] === 255 || lv.clues[i] === undefined) continue;
    const isStone = ((i < 32 ? lv.stones.lo >>> i : lv.stones.hi >>> (i - 32)) & 1) === 1;
    if (!isStone || lv.clues[i] > 4) continue;
    stones.push({ cell: i, x: grid.x + x * g.cs * r.scaleX, y: grid.y + y * g.cs * r.scaleY, w: g.cs * r.scaleX, h: g.cs * r.scaleY });
  }
  const pl = s.plateInfo;
  if (pl) out.boxes.plate = pl;
  const plateN = s.scenery.plateN;
  out.plateN = plateN;
  out.level = sess.daily ? `daily ${sess.daily}` : `${sess.track} ${sess.levelNumber}`;
  // the house door area: the plate's column down to the house base
  const house = pl ? { x: pl.x - 6 * u, y: pl.y, w: pl.w + 12 * u, h: Math.max(0, g.houseBaseY - pl.y) } : null;
  let band = null;
  for (const ob of s.band?.objects ?? []) if (vis(ob)) { const b = bb(ob); band = band ? { x: Math.min(band.x, b.x), y: Math.min(band.y, b.y), w: Math.max(band.x + band.w, b.x + b.w) - Math.min(band.x, b.x), h: Math.max(band.y + band.h, b.y + b.h) - Math.min(band.y, b.y) } : b; }
  if (band) out.boxes.band = band;
  const word = s.bigWord && s.bigWord.objects[0];
  const wordBox = vis(word) ? bb(word) : null;
  if (wordBox) out.boxes.word = wordBox;
  const np = s.nextPoint;
  const nextBox = np ? { ...s.nextBox } : s.offer?.isOpen ? null : null;
  if (nextBox) out.boxes.next = nextBox;
  const caps = [];
  for (const c of s.caps ?? []) if (vis(c.t)) caps.push({ key: c.key, ...bb(c.t) });
  out.boxes.caps = caps;
  const hudObjs = { gear: s.gearIcon, how: s.howBtn, hint: s.hintBtn, undo: s.undoBtn, left: s.leftBtn, today: s.todayBtn, back: s.backChip };
  const hud = [];
  for (const [k, o] of Object.entries(hudObjs)) if (vis(o)) hud.push({ key: k, ...bb(o) });
  out.boxes.hud = hud;
  const w = s.wickInfo;
  if (w && w.visible) out.boxes.wick = { x: w.x, y: w.y, w: w.w, h: w.h };
  // rules
  if (nextBox && boardOn) for (let row = 0; row < lv.h; row++) {
    const rr = { x: grid.x, y: grid.y + row * g.cs * r.scaleY, w: gw, h: g.cs * r.scaleY };
    if (hit(nextBox, rr)) out.hits.push(`next×grid row ${row + 1} ${area(nextBox, rr)}`);
  }
  if (wordBox && boardOn) for (const st of stones) if (hit(wordBox, st)) out.hits.push(`word×stone ${st.cell} ${area(wordBox, st)}`);
  if (boardOn && !s.finale?.advanced && hit(frame, home) && safe.bottom > 0) out.hits.push(`board×home ${area(frame, home)}`);
  if (boardOn && s.finale && !s.finale.advanced && s.boardSlide === 0 && Math.abs(r.y - g.bcy) > 2 * u) out.hits.push(`board×shift ${Math.round((r.y - g.bcy) / u)}pt`);
  if (!sess.daily && plateN > 0 && boardOn && !s.finale?.advanced && plateN !== sess.levelNumber && r.alpha > 0.9 && !s.switching) out.hits.push(`plate×early plate ${plateN} board ${sess.levelNumber}`);
  if (band && pl && hit(band, pl)) out.hits.push(`band×plate ${area(band, pl)}`);
  if (band && house && hit(band, house)) out.hits.push(`band×house ${area(band, house)}`);
  if (band && boardOn && hit(band, grid)) out.hits.push(`band×grid ${area(band, grid)}`);
  if (out.boxes.wick) {
    const wb = out.boxes.wick;
    if (pl && hit(wb, pl)) out.hits.push(`wick×plate ${area(wb, pl)}`);
    if (band && hit(wb, band)) out.hits.push(`wick×band ${area(wb, band)}`);
    for (const c of caps) if (hit(wb, c)) out.hits.push(`wick×cap:${c.key} ${area(wb, c)}`);
  }
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i];
    if (c.x < 0 || c.x + c.w > g.W) out.hits.push(`cap×edge ${c.key}`);
    for (let j = i + 1; j < caps.length; j++) if (hit(c, caps[j])) out.hits.push(`cap×cap ${c.key}/${caps[j].key}`);
    for (const h of hud) if (hit(c, h) && !c.key.endsWith(h.key) && !(c.key === "cap.town" && h.key === "left") && !(c.key === "cap.how" && h.key === "how") && !(c.key === "cap.back" && h.key === "back")) out.hits.push(`cap×hud ${c.key}/${h.key} ${area(c, h)}`);
  }
  for (const h of hud) if (hit(h, status) || (safe.bottom > 0 && hit(h, home))) out.hits.push(`hud×safe ${h.key}`);
  // the postcard sheet's milestone / gift moment vs every visible HUD caption / disc (SE: it met "Back")
  const card = s.card;
  if (card) for (const o of [card.mileImg, card.giftImg]) if (vis(o)) {
    const m = bb(o);
    out.boxes.moment = m;
    for (const c of [...caps, ...hud]) if (hit(m, c)) out.hits.push(`moment×${c.key} ${area(m, c)}`);
  }
  if (arg?.extra) for (const [k, b] of Object.entries(arg.extra)) out.boxes[k] = b;
  return out;
}

async function run(cfg) {
  const browser = await (cfg.engine === "webkit" ? webkit : chromium).launch();
  const ctx = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, deviceScaleFactor: 2, locale: cfg.locale, timezoneId: "America/New_York", hasTouch: false });
  const page = await ctx.newPage();
  await page.addInitScript(({ top, bottom }) => {
    const apply = () => {
      const el = document.documentElement;
      if (!el) return false;
      el.style.setProperty("--safe-top", `${top}px`);
      el.style.setProperty("--safe-bottom", `${bottom}px`);
      return true;
    };
    if (!apply()) {
      const mo = new MutationObserver(() => { if (apply()) mo.disconnect(); });
      mo.observe(document, { childList: true });
    }
  }, { top: cfg.top, bottom: cfg.bottom });
  const log = [];
  const report = [];
  const t0 = Date.now();
  const note = (m) => { const l = `${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`; log.push(l); };
  page.on("pageerror", (e) => { note(`PAGEERROR ${e.message}`); console.log(cfg.tag, "PAGEERROR", e.message); });
  page.on("console", (m) => { if (m.type() === "error") note(`console.error ${m.text()}`); });
  let n = 0;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name) => {
    n++;
    const f = `${cfg.tag}-${String(n).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path: OUT + f });
    let m;
    try { m = await ev(measure, null); } catch (e) { m = { error: String(e) }; }
    report.push({ shot: f, ...m });
    console.log(cfg.tag, f, m.hits?.length ? `HITS ${m.hits.join("; ")}` : m.error ? `ERR ${m.error}` : "ok");
  };
  const waitFor = async (fn, ms = 30000, arg) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev(fn, arg)) return true; } catch {} await sleep(150); } return false; };
  const client = (p) => ev((q) => window.__e2e.toClient(q.x, q.y), p);
  const tapAt = async (p, what) => { const c = await client(p); await page.mouse.click(c.x, c.y); note(`tap ${what}`); };
  const tapCell = async (c) => { const p = await ev((c) => window.__e2e.cellPoint(c), c); await page.mouse.click(p.x, p.y); };
  const tapObj = async (k) => { const p = await ev((k) => window.__e2e.objPoint(k), k); await page.mouse.click(p.x, p.y); };
  const tapTut = async (c) => tapAt(await ev((c) => window.__e2e.scene.tut.cellPoint(c), c), `yard ${c}`);
  const tutWant = async (cell) => waitFor((c) => window.__e2e.scene.tut?.target === c, 20000, cell);
  const lvInfo = () => ev(async () => {
    const api = await window.__e2e.api();
    const s = window.__e2e.session; const lv = s.level;
    const has = (bb, i) => ((i < 32 ? bb.lo >>> i : bb.hi >>> (i - 32)) & 1) === 1;
    const floor = []; const stones = [];
    for (let r = 0; r < lv.h; r++) for (let c = 0; c < lv.w; c++) { const i = r * 8 + c; (has(lv.stones, i) ? stones : floor).push(i); }
    return { n: s.levelNumber, floor, stones, sol: await window.__e2e.solution(), pair: api.seeingPair(lv) };
  });
  const lanterns = () => ev(() => window.__e2e.lanterns());
  const solveRest = async (gap = 420, keepLast = false) => {
    const sol = await ev(() => window.__e2e.solution());
    const have = new Set(await lanterns());
    const todo = sol.filter((c) => !have.has(c));
    for (const [i, c] of todo.entries()) { if (keepLast && i === todo.length - 1) return c; await tapCell(c); await sleep(gap); }
    return -1;
  };
  const next = async () => { if (await waitFor(() => !!window.__e2e.scene.nextPoint, 15000)) await tapAt(await ev(() => window.__e2e.scene.nextPoint), "next house"); };
  const level = (k) => waitFor((k) => window.__e2e.session.levelNumber === k && window.__e2e.scene.isIdle(), 30000, k);

  // 1. first launch: the tutorial (band on the yard, T4 "too many")
  await page.goto(BASE + "/");
  await waitFor(() => !!window.__e2e?.ready());
  await waitFor(() => window.__e2e.scene.tut?.step === 1, 20000);
  await sleep(1500); await shot("tut-T1");
  await tapTut(2); await sleep(600);
  await waitFor(() => window.__e2e.scene.tut?.step === 2, 15000); await sleep(500);
  await tutWant(18); await sleep(300);
  await tapTut(0); await sleep(500); await shot("tut-T2-wrong-tap-why");
  await sleep(1200); await tapTut(18); await sleep(800);
  await tutWant(1); await tapTut(1); await sleep(450);
  await waitFor(() => window.__e2e.scene.tut?.step === 3, 15000); await sleep(1700);
  await tutWant(3); await tapTut(3); await sleep(700);
  await tutWant(9); await tapTut(9); await sleep(500); await tutWant(11); await tapTut(11); await sleep(450);
  await waitFor(() => window.__e2e.scene.tut?.step === 4, 15000); await sleep(1500); await shot("tut-T4-number-sides");
  await tutWant(8); await tapTut(16); await sleep(450); await shot("tut-T4-corner-wrong");
  await sleep(1000); await tapTut(8); await sleep(1000);
  await tutWant(18); await tapTut(17); await sleep(450); await shot("tut-T4-too-many");
  await sleep(1000); await tapTut(18); await sleep(500);
  await waitFor(() => window.__e2e.scene.tut?.step === 5, 15000); await sleep(700);
  await tapTut(2); await sleep(500);
  await waitFor(() => window.__e2e.scene.tut?.step === 6, 15000); await sleep(800); await shot("tut-end-card");
  await tapAt(await ev(() => window.__e2e.scene.tut.cardButton), "start");
  await waitFor(() => !window.__e2e.scene.tut, 10000); await sleep(900); await shot("L1-board");

  // 2. gentle 1: error lines, hint remove, solved moment, Next house
  const L = await lvInfo();
  if (L.pair) {
    await tapCell(L.pair[0]); await sleep(250); await tapCell(L.pair[1]); await sleep(1500); await shot("L1-conflict-line");
    await tapCell(L.pair[1]); await sleep(250); await tapCell(L.pair[0]); await sleep(600);
  }
  const wrong = L.floor.find((c) => !L.sol.includes(c));
  await tapCell(wrong); await sleep(1500); await shot("L1-wrong-spot-line");
  await tapObj("hintBtn"); await sleep(900); await shot("L1-hint-remove");
  await tapObj("hintBtn"); await sleep(700);
  const last = await solveRest(450, true);
  await sleep(600); await shot("L1-one-left");
  await tapCell(last);
  await sleep(350); await shot("L1-solved-0.35s");
  await sleep(900); await shot("L1-solved-1.25s");
  await waitFor(() => !!window.__e2e.scene.nextPoint, 15000); await sleep(500); await shot("L1-next-house");
  await next();
  await sleep(250); await shot("L1-board-leaving");
  await level(2); await sleep(1600); await shot("L2-review-demo");

  // 3. the rules sheet (both entries) and settings
  await tapAt(await ev(() => ({ x: window.__e2e.scene.howBtn.x, y: window.__e2e.scene.howBtn.y })), "rules");
  await waitFor(() => window.__e2e.scene.howTo?.isOpen, 10000); await sleep(1500); await shot("rules-sheet");
  await ev(() => window.__e2e.scene.howTo.revealReplay()); await sleep(1400); await shot("rules-sheet-bottom");
  await tapAt(await ev(() => window.__e2e.scene.howTo.point("close")), "close"); await sleep(600);
  await tapObj("gearIcon"); await sleep(900); await shot("settings");
  await tapAt(await ev(() => { const b = window.__e2e.scene.sheet.closeBox(); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }), "settings close"); await sleep(600);

  // 4. gentle 2, 3 → (A7) the first daily's offer after gentle 3
  for (let k = 2; k <= 3; k++) {
    await level(k);
    await solveRest(330);
    await next();
  }
  await waitFor(() => window.__e2e.session.levelNumber === 4, 30000);
  const offered = await waitFor(() => window.__e2e.scene.ask?.kind === "dailyOffer" || window.__e2e.scene.ask?.kind === "dailyIntro", 8000);
  await sleep(700); await shot(offered ? "L4-daily-offer" : "L4-board-no-offer");
  if (offered) {
    // "Later": the board, the today button present, then open it from the HUD
    // askPoint is already a client point (bridge.toClient inside)
    { const q = await ev(() => window.__e2e.askPoint("no")); await page.mouse.click(q.x, q.y); note("tap later"); }
    await sleep(900); await shot("L4-after-later");
  }
  // 5. the daily (from the today button) and its result sheet
  await level(4);
  await sleep(600);
  note(`before today: ${JSON.stringify(await ev(() => { const s = window.__e2e.scene; const p = s.hudPoints().today; return { hit: s.hitAt(p.x, p.y), travel: !!s.travel, switching: !!s.switching, ask: s.ask.kind, guide: s.guide.active?.kind ?? null, flow: s.flowLog.slice(-4) }; }))}`);
  await tapObj("todayBtn");
  await waitFor(() => !!window.__e2e.session.daily && window.__e2e.scene.isIdle(), 20000);
  if (await waitFor(() => window.__e2e.scene.ask?.kind === "dailyIntro", 4000)) { await sleep(500); await shot("daily-welcome"); { const q = await ev(() => window.__e2e.askPoint("yes")); await page.mouse.click(q.x, q.y); note("welcome ok"); } }
  await waitFor(() => !!window.__e2e.session.daily && window.__e2e.scene.isIdle(), 20000); await sleep(600);
  await shot("daily-board-hud");
  await solveRest(380);
  await sleep(1200); await shot("daily-finale-hud");
  await waitFor(() => !!window.__e2e.scene.card?.isOpen, 20000);
  await sleep(4000); await shot("daily-result");
  // 6. a 7th day (streak milestone + the gift): the postcard's moment over the sky, the top HUD row stepped aside
  {
    const lg = JSON.stringify({ v: 1, days: Object.fromEntries(["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"].map((d) => [d, { at: 0, ms: 90000, hints: 0, undos: 0 }])) });
    const ctx2 = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, deviceScaleFactor: 2, locale: cfg.locale, timezoneId: "America/New_York" });
    const p2 = await ctx2.newPage();
    await p2.addInitScript(({ top, bottom, lg }) => {
      const apply = () => { const el = document.documentElement; if (!el) return false; el.style.setProperty("--safe-top", `${top}px`); el.style.setProperty("--safe-bottom", `${bottom}px`); return true; };
      if (!apply()) { const mo = new MutationObserver(() => { if (apply()) mo.disconnect(); }); mo.observe(document, { childList: true }); }
      const ls = window.localStorage;
      if (!ls.getItem("__e2e:seeded")) {
        ls.setItem("__e2e:seeded", "1");
        const prog = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 6, cleared: 5, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
        ls.setItem("__fake:device", JSON.stringify({ files: { "LIBRARY/lanternly/pips-progress.json": { data: prog, enc: "utf8" }, "LIBRARY/lanternly/pips-daily-log.json": { data: lg, enc: "utf8" } }, prefs: { guide: "511", dailyIntro: "1", dailyOffer: "1", streak: JSON.stringify({ v: 1, last: "2026-10-14", streak: 6, best: 6, shields: {} }) }, shares: [] }));
        ls.setItem("__e2e:now", "2026-10-15T10:00:00");
      }
    }, { top: cfg.top, bottom: cfg.bottom, lg });
    await p2.goto(BASE + "/");
    const ev2 = (fn, arg) => p2.evaluate(fn, arg);
    const wait2 = async (fn, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev2(fn)) return true; } catch {} await sleep(150); } return false; };
    await wait2(() => !!window.__e2e?.ready() && window.__e2e.idle());
    await sleep(800);
    { const q = await ev2(() => window.__e2e.objPoint("todayBtn")); await p2.mouse.click(q.x, q.y); }
    await wait2(() => !!window.__e2e.session.daily && window.__e2e.scene.isIdle(), 20000);
    const sol = await ev2(() => window.__e2e.solution());
    for (const c of sol) { const q = await ev2((c) => window.__e2e.cellPoint(c), c); await p2.mouse.click(q.x, q.y); await sleep(320); }
    await wait2(() => !!window.__e2e.scene.card?.isOpen && window.__e2e.scene.card.momentOn, 20000);
    await sleep(700);
    n++;
    const f = `${cfg.tag}-${String(n).padStart(2, "0")}-day7-milestone-gift.png`;
    await p2.screenshot({ path: OUT + f });
    let m;
    try { m = await ev2(measure, null); } catch (e) { m = { error: String(e) }; }
    report.push({ shot: f, ...m });
    console.log(cfg.tag, f, m.hits?.length ? `HITS ${m.hits.join("; ")}` : m.error ? `ERR ${m.error}` : "ok");
    await ctx2.close();
  }
  writeFileSync(`${OUT}${cfg.tag}-log.txt`, log.join("\n"));
  await browser.close();
  return report;
}

const all = {};
for (const cfg of CFG) {
  if (ONLY.length && !ONLY.includes(cfg.tag)) continue;
  try { all[cfg.tag] = await run(cfg); } catch (e) { console.error(cfg.tag, "FAILED", e); all[cfg.tag] = { failed: String(e) }; }
}
const sum = {};
for (const [k, v] of Object.entries(all)) if (Array.isArray(v)) sum[k] = v.reduce((a, s) => a + (s.hits?.length ?? 0), 0);
writeFileSync(OUT + "layout.json", JSON.stringify({ summary: sum, shots: all }, null, 2));
console.log("hits per config", JSON.stringify(sum));
