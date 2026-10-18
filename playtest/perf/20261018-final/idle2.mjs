#!/usr/bin/env node
// Idle-cost probe (playtest/perf/idle-governor.md): how much the app draws and burns while the
// player only looks. Chromium (Playwright) against the e2e web build (Capacitor fakes + the e2e
// bridge), phone viewport 393×852 @3x like the iPhone 14 Pro.
//
//   npx vite build --mode e2e && npx vite preview --mode e2e --port 4321 &
//   node scripts/measure-idle.mjs [--url http://localhost:4321/] [--secs 20] [--screens board,town,result] [--out file.json]
//
// Per screen, after it settled (3–4 s), over --secs of no input:
//   renders/s     Phaser render passes (game "postrender" events) = canvas repaints
//   frames/s      compositor frames presented (CDP trace, DrawFrame events of the page's renderer)
//   task ms/s     main-thread task time (CDP Performance.getMetrics TaskDuration delta)
//   script ms/s   JS time (ScriptDuration delta)
//   renderer/gpu cpu ms/s   whole-process CPU (SystemInfo.getProcessInfo cpuTime delta)
// then one tap (an empty spot on the HUD-free sky) and the tap→next-render latency.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { chromium } = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json")("playwright");
const WORST = readFileSync(new globalThis.URL("./worst-village.json", import.meta.url), "utf8");

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const URL = arg("url", "http://localhost:4321/");
const SECS = Number(arg("secs", "20"));
const SCREENS = arg("screens", "board,town,result").split(",");
const OUT = arg("out", "");
const HEADED = process.argv.includes("--headed");
/** JS evaluated in the page once the screen settled (experiments, e.g. "__test.governor.sleep('x')"). */
const PRE = arg("eval", "");

const ALL_GUIDES = "255";
const progress = (gentleLevel) =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 3, cleared: 2, hints: 0 } });
const log = (dates) => JSON.stringify({ v: 1, days: Object.fromEntries(dates.map((d) => [d, { at: 0, ms: 90_000, hints: 0, undos: 0 }])) });
const streak = (last, n) => JSON.stringify({ v: 1, last, streak: n, best: n, shields: {} });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, ms = 30_000) {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - t0 > ms) throw new Error("poll timeout");
    await sleep(100);
  }
}

async function seed(page, s) {
  await page.addInitScript((seed) => {
    const ls = window.localStorage;
    if (!ls.getItem("__e2e:seeded")) {
      ls.setItem("__e2e:seeded", "1");
      const files = {};
      for (const [k, v] of Object.entries(seed.files ?? {})) files[`LIBRARY/lanternly/${k}`] = { data: v, enc: "utf8" };
      ls.setItem("__fake:device", JSON.stringify({ files, prefs: seed.prefs ?? {}, shares: [] }));
      if (seed.now) ls.setItem("__e2e:now", seed.now);
    }
    const target = ls.getItem("__e2e:now");
    if (target) {
      const Real = Date;
      const offset = new Real(target).getTime() - Real.now();
      class ShiftedDate extends Real {
        constructor(...a) {
          if (a.length === 0) super(Real.now() + offset);
          else super(...a);
        }
        static now() {
          return Real.now() + offset;
        }
      }
      globalThis.Date = ShiftedDate;
    }
    // count Phaser render passes + remember when the last one ran
    window.__idle = { renders: 0, lastRender: 0 };
  }, s);
}

const ready = (page) => page.evaluate(() => !!window.__e2e?.ready());
const idle = (page) => page.evaluate(() => window.__e2e.idle());
const tapClient = async (page, p) => page.mouse.click(p.x, p.y);
async function hookRenders(page) {
  await page.evaluate(() => {
    const g = window.__e2e.game;
    if (g.__idleHooked) return;
    g.__idleHooked = true;
    g.events.on("postrender", () => {
      window.__idle.renders++;
      window.__idle.lastRender = performance.now();
    });
  });
}

async function toScreen(page, screen) {
  if (["village", "room", "market", "drawer"].includes(screen)) {
    await seed(page, { now: "2026-12-20T22:00:00", files: { "pips-progress.json": progress(30) }, prefs: { guide: ALL_GUIDES, village: WORST } });
    await page.goto(URL);
    await poll(() => ready(page));
    await poll(() => idle(page));
    await tapClient(page, await page.evaluate(() => window.__e2e.objPoint("leftBtn")));
    await poll(() => page.evaluate(() => window.__e2e.village?.view?.screen === "village"), 20_000);
    const hit = async (id) => { await poll(() => page.evaluate((i) => !!window.__e2e.villagePoint(i), id), 10_000); await tapClient(page, await page.evaluate((i) => window.__e2e.villagePoint(i), id)); };
    if (screen === "market") await hit("stall");
    if (screen === "room" || screen === "drawer") { await hit("cottage"); await poll(() => page.evaluate(() => window.__e2e.village?.view?.screen === "room"), 10_000); }
    if (screen === "drawer") { await hit("slot-8"); await poll(() => page.evaluate(() => !!window.__e2e.village?.view?.drawer), 10_000); }
  } else if (screen === "board" || screen === "town") {
    await seed(page, { now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(14) }, prefs: { guide: ALL_GUIDES } });
    await page.goto(URL);
    await poll(() => ready(page));
    await poll(() => idle(page));
    if (screen === "town") {
      await tapClient(page, await page.evaluate(() => window.__e2e.objPoint("alley")));
      await poll(() => page.evaluate(() => !!window.__e2e.townHomePoint()), 20_000);
    }
  } else if (screen === "result") {
    await seed(page, {
      now: "2026-10-14T10:00:00",
      files: { "pips-daily-log.json": log(["2026-10-07", "2026-10-11", "2026-10-13"]) },
      // v11: the first daily's welcome card (seen already, as in e2e/fixtures.ts)
      prefs: { guide: ALL_GUIDES, streak: streak("2026-10-13", 2), dailyIntro: "1" },
    });
    await page.goto(URL);
    await poll(() => ready(page));
    await poll(() => idle(page));
    await tapClient(page, await page.evaluate(() => window.__e2e.moonPoint()));
    await poll(() => page.evaluate(() => window.__e2e.session.daily === "2026-10-14"));
    await poll(() => idle(page));
    const sol = await page.evaluate(() => window.__e2e.solution());
    const have = new Set(await page.evaluate(() => window.__e2e.lanterns()));
    for (const c of sol.filter((c) => !have.has(c))) {
      const before = await page.evaluate(() => window.__e2e.session.moves.length);
      await tapClient(page, await page.evaluate((c) => window.__e2e.cellPoint(c), c));
      await poll(() => page.evaluate((b) => window.__e2e.session.moves.length === b + 1, before));
    }
    await poll(() => page.evaluate(() => !!window.__e2e.scene.card?.isOpen), 20_000);
  }
  await hookRenders(page);
}

async function processCpu(browserCdp) {
  const { processInfo } = await browserCdp.send("SystemInfo.getProcessInfo");
  const out = { renderer: 0, gpu: 0, browser: 0, other: 0 };
  for (const p of processInfo) {
    const t = p.type.toLowerCase();
    out[t in out ? t : "other"] += p.cpuTime;
  }
  return out;
}

async function measure(browser, screen) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, timezoneId: "Asia/Seoul", locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[${screen}] pageerror`, e.message));
  await toScreen(page, screen);
  await sleep(screen === "result" ? 4000 : 3000); // intro / settle; the governor's 1.5 s grace falls in here
  if (PRE) await page.evaluate(PRE);
  const cdp = await ctx.newCDPSession(page);
  const bcdp = await browser.newBrowserCDPSession();
  await cdp.send("Performance.enable");
  const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  // trace: DrawFrame of this page's renderer = presented compositor frames
  const events = [];
  cdp.on("Tracing.dataCollected", (e) => events.push(...e.value));
  const traceDone = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { categories: "disabled-by-default-devtools.timeline.frame,devtools.timeline", transferMode: "ReportEvents" });
  const m0 = await metric();
  const p0 = await processCpu(bcdp);
  const r0 = await page.evaluate(() => window.__idle.renders);
  const t0 = Date.now();
  await sleep(SECS * 1000);
  const r1 = await page.evaluate(() => window.__idle.renders);
  const m1 = await metric();
  const p1 = await processCpu(bcdp);
  const dt = (Date.now() - t0) / 1000;
  await cdp.send("Tracing.end");
  await traceDone;
  const pid = events.find((e) => e.name === "TracingStartedInBrowser" || e.name === "SetLayerTreeId")?.pid;
  void pid;
  const draws = events.filter((e) => e.name === "DrawFrame").length;
  // where the time goes: complete events by name, per thread name (main = CrRendererMain)
  const threads = new Map();
  for (const e of events) if (e.name === "thread_name") threads.set(`${e.pid}:${e.tid}`, e.args?.name);
  const by = {};
  for (const e of events) {
    if (e.ph !== "X" || !e.dur) continue;
    const th = threads.get(`${e.pid}:${e.tid}`) ?? "?";
    if (!/CrRendererMain|Compositor|Raster|VizCompositor|CrGpuMain/.test(th)) continue;
    if (!["FireAnimationFrame", "Paint", "RasterTask", "UpdateLayerTree", "Layout", "Commit", "CompositeLayers", "PrePaint", "Layerize"].includes(e.name)) continue;
    const k = `${th.replace(/Thread.*/, "")}/${e.name}`;
    by[k] = (by[k] ?? 0) + e.dur / 1000;
  }
  const breakdown = Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / SECS).toFixed(1)]));
  await sleep(500);
  // the next tap after idle: pointerdown → next Phaser render (median of 5, 700 ms of quiet before each)
  const taps = [];
  for (let k = 0; k < 5; k++) {
    await sleep(2200);
    taps.push(await tapOnce(page));
  }
  taps.sort((a, b) => a - b);
  const tapLatency = taps[2];
  const gov = await page.evaluate(() => window.__test?.governor?.state?.() ?? null);
  await ctx.close();
  const res = {
    screen,
    secs: +dt.toFixed(1),
    rendersPerSec: +((r1 - r0) / dt).toFixed(1),
    framesPerSec: +(draws / dt).toFixed(1),
    taskMsPerSec: +(((m1.TaskDuration - m0.TaskDuration) * 1000) / dt).toFixed(1),
    scriptMsPerSec: +(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / dt).toFixed(1),
    rendererCpuMsPerSec: +(((p1.renderer - p0.renderer) * 1000) / dt).toFixed(1),
    gpuCpuMsPerSec: +(((p1.gpu - p0.gpu) * 1000) / dt).toFixed(1),
    tapToRenderMs: +tapLatency.toFixed(1),
    taps: taps.map((t) => +t.toFixed(1)),
    traceMsPerSec: breakdown,
    governor: gov,
  };
  console.log(JSON.stringify(res));
  return res;
}

async function tapOnce(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector("#app canvas");
    const r = canvas.getBoundingClientRect();
    const x = r.left + r.width * 0.5;
    const y = r.top + r.height * 0.06; // the sky band (no HUD target there)
    const before = window.__idle.renders;
    const t = performance.now();
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true };
    canvas.dispatchEvent(new PointerEvent("pointerdown", opts));
    await new Promise((res) => {
      const f = () => (window.__idle.renders > before || performance.now() - t > 2000 ? res() : requestAnimationFrame(f));
      f();
    });
    const lat = window.__idle.renders > before ? window.__idle.lastRender - t : -1;
    canvas.dispatchEvent(new PointerEvent("pointerup", opts));
    return lat;
  });
}

// channel "chromium" = the full browser in new-headless mode (it has a GPU process; the default
// headless shell composites in-process, so its GPU column would read 0)
const browser = await chromium.launch({ headless: !HEADED, channel: arg("channel", "chromium") || undefined });
const results = [];
for (const s of SCREENS) results.push(await measure(browser, s));
await browser.close();
if (OUT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(OUT, JSON.stringify(results, null, 2));
}
