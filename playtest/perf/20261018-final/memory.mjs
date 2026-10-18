// G4 memory estimate in Chromium (channel "chromium": it has a GPU process), worst case = winter night, 7 residents,
// full cottage with visitors, market, drawer. Measures per state: Phaser texture bytes (RGBA, exact sum of every texture source),
// V8 heap after GC (CDP), and per-process memory from a CDP memory-infra dump (renderer / GPU) + ps RSS.
//   node memory.mjs <e2e-build-url> [trips=20] [out.json]
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/Users/hyukahn/workspace/puzzle-lab/apps/client/package.json");
const { chromium } = require("playwright");
const URL_ = process.argv[2] ?? "http://localhost:4512";
const TRIPS = Number(process.argv[3] ?? 20);
const OUT = process.argv[4] ?? "";
const village = readFileSync(new URL("./worst-village.json", import.meta.url), "utf8");
const progress = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 30, cleared: 29, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MB = (b) => +(b / 1048576).toFixed(1);

const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, timezoneId: "Asia/Seoul", locale: "ko-KR" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.addInitScript(([progress, village]) => {
  const ls = window.localStorage;
  if (!ls.getItem("__e2e:seeded")) {
    ls.setItem("__e2e:seeded", "1");
    ls.setItem("__fake:device", JSON.stringify({ files: { "LIBRARY/lanternly/pips-progress.json": { data: progress, enc: "utf8" } }, prefs: { guide: "255", dailyIntro: "1", dailyOffer: "1", village }, shares: [] }));
    ls.setItem("__e2e:now", "2026-12-20T22:00:00");
  }
  const target = ls.getItem("__e2e:now");
  const Real = Date; const offset = new Real(target).getTime() - Real.now();
  globalThis.Date = class extends Real { constructor(...a) { if (a.length === 0) super(Real.now() + offset); else super(...a); } static now() { return Real.now() + offset; } };
}, [progress, village]);
const cdp = await ctx.newCDPSession(page);
const bcdp = await browser.newBrowserCDPSession();
await cdp.send("Performance.enable");
await page.goto(URL_ + "/");
const poll = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(100); } throw new Error("poll timeout"); };
await poll(() => page.evaluate(() => !!window.__e2e?.ready() && window.__e2e.idle()));

const hit = (id) => page.evaluate((i) => window.__e2e.villagePoint(i), id);
const tapHit = async (id) => { await poll(async () => !!(await hit(id))); const p = await hit(id); await page.mouse.click(p.x, p.y); };
const screen = () => page.evaluate(() => window.__e2e.village?.view?.screen ?? null);

async function textures() {
  return page.evaluate(() => {
    const list = window.__e2e.game.textures.list; let total = 0, n = 0; const top = [];
    for (const [k, t] of Object.entries(list)) {
      if (k === "__DEFAULT" || k === "__MISSING" || k === "__WHITE") continue;
      let b = 0; for (const s of t.source ?? []) b += (s.width || 0) * (s.height || 0) * 4;
      total += b; n++; top.push([k, b]);
    }
    top.sort((a, b) => b[1] - a[1]);
    return { total, n, top: top.slice(0, 6).map(([k, b]) => `${k}:${(b / 1048576).toFixed(1)}`) };
  });
}
async function procMem() {
  // memory-infra dump through the browser-level tracing domain
  const ev = []; const onData = (e) => ev.push(...e.value); bcdp.on("Tracing.dataCollected", onData);
  const done = new Promise((r) => bcdp.once("Tracing.tracingComplete", r));
  await bcdp.send("Tracing.start", { traceConfig: { recordMode: "recordUntilFull", includedCategories: ["-*", "disabled-by-default-memory-infra"], memoryDumpConfig: { triggers: [] } }, transferMode: "ReportEvents" });
  await bcdp.send("Tracing.requestMemoryDump", { levelOfDetail: "detailed" });
  await bcdp.send("Tracing.end"); await done; bcdp.off("Tracing.dataCollected", onData);
  const { processInfo } = await bcdp.send("SystemInfo.getProcessInfo");
  const typeOf = Object.fromEntries(processInfo.map((p) => [p.id, p.type]));
  const per = {};
  const hex = (x) => (x === undefined ? 0 : parseInt(x, 16));
  for (const e of ev) {
    if (e.ph !== "v" || !e.args?.dumps) continue;
    const d = e.args.dumps; const o = (per[e.pid] ??= { pid: e.pid, type: (typeOf[e.pid] ?? "?").toLowerCase(), alloc: {} });
    if (d.process_totals) { o.footprintMB = MB(hex(d.process_totals.private_footprint_bytes)); o.rssMB = MB(hex(d.process_totals.resident_set_bytes)); }
    for (const [k, v] of Object.entries(d.allocators ?? {})) { if (k.split("/").length <= 2) { const mb = MB(hex(v.attrs?.size?.value)); if (mb >= 1) o.alloc[k] = mb; } }
  }
  // the page's renderer = the largest-footprint renderer (one page open); gpu = the GPU process
  const rend = Object.values(per).filter((p) => p.type === "renderer").sort((a, b) => (b.footprintMB ?? 0) - (a.footprintMB ?? 0))[0];
  const gpu = Object.values(per).find((p) => p.type === "gpu");
  const out = { renderer: rend, gpu };
  for (const o of [out.renderer, out.gpu]) if (o) { try { o.psRssMB = MB(+execFileSync("ps", ["-o", "rss=", "-p", String(o.pid)]).toString().trim() * 1024); } catch { /* gone */ } }
  return out;
}
async function snap(label) {
  await sleep(1500);
  await cdp.send("HeapProfiler.collectGarbage");
  const heap = await cdp.send("Runtime.getHeapUsage");
  const tx = await textures();
  const pm = await procMem();
  const r = { label, texturesMB: MB(tx.total), textureCount: tx.n, topTextures: tx.top, v8UsedMB: MB(heap.usedSize), v8TotalMB: MB(heap.totalSize),
    rendererMB: pm.renderer?.footprintMB, rendererRssMB: pm.renderer?.rssMB, rendererPsMB: pm.renderer?.psRssMB, gpuMB: pm.gpu?.footprintMB, gpuRssMB: pm.gpu?.rssMB, gpuPsMB: pm.gpu?.psRssMB, procAlloc: { renderer: pm.renderer?.alloc, gpu: pm.gpu?.alloc } };
  console.log(JSON.stringify({ ...r, procAlloc: undefined }));
  return r;
}

const states = [];
await sleep(1500); states.push(await snap("0a board, before prewarm (~4 s after launch)"));
await sleep(12000); states.push(await snap("0b board, after prewarm"));
{ const p = await page.evaluate(() => window.__e2e.objPoint("leftBtn")); await page.mouse.click(p.x, p.y); }
await poll(async () => (await screen()) === "village"); await sleep(600);
console.log("residents", JSON.stringify(await page.evaluate(() => window.__e2e.village.view.residents)));
states.push(await snap("1 village (winter night, 7 residents)"));
await tapHit("stall"); await sleep(600); states.push(await snap("2 market open"));
await tapHit("market-close"); await sleep(400);
await tapHit("cottage"); await poll(async () => (await screen()) === "room"); await sleep(600); states.push(await snap("3 room (full cottage, visitors)"));
await tapHit("slot-8"); await poll(() => page.evaluate(() => !!window.__e2e.village.view.drawer)); await sleep(600); states.push(await snap("4 room + drawer open"));
await tapHit("drawer-close"); await sleep(500); await tapHit("room-back"); await poll(async () => (await screen()) === "village"); await sleep(500); states.push(await snap("5 back in the village"));
await tapHit("back"); await poll(() => page.evaluate(() => !window.__e2e.village)); await sleep(3000); states.push(await snap("6 left the village (board), +3 s"));
await sleep(10000); states.push(await snap("7 board, +13 s after leaving"));

// round trips: village -> room -> drawer -> out
for (let k = 1; k <= TRIPS; k++) {
  { const p = await page.evaluate(() => window.__e2e.objPoint("leftBtn")); await page.mouse.click(p.x, p.y); }
  await poll(async () => (await screen()) === "village"); await sleep(500);
  await tapHit("cottage"); await poll(async () => (await screen()) === "room"); await sleep(400);
  await tapHit("slot-8"); await poll(() => page.evaluate(() => !!window.__e2e.village.view.drawer)); await sleep(300);
  await tapHit("drawer-close"); await sleep(300); await tapHit("room-back"); await poll(async () => (await screen()) === "village"); await sleep(300);
  await tapHit("back"); await poll(() => page.evaluate(() => !window.__e2e.village)); await sleep(800);
  if (k === 1 || k === 5 || k === 10 || k === 20) states.push(await snap(`trip ${k} done (board)`));
}
if (process.env.SOAK) {
  // 10-minute soak sitting in the cottage room (ambient 20 fps), snapshots at 0 / 2 / 5 / 10 min
  { const p = await page.evaluate(() => window.__e2e.objPoint("leftBtn")); await page.mouse.click(p.x, p.y); }
  await poll(async () => (await screen()) === "village"); await sleep(500);
  await tapHit("cottage"); await poll(async () => (await screen()) === "room"); await sleep(500);
  let last = 0;
  for (const min of [0, 2, 5, 10]) { await sleep((min - last) * 60000); last = min; states.push(await snap(`soak in room, ${min} min`)); }
  await tapHit("room-back"); await poll(async () => (await screen()) === "village"); await tapHit("back"); await poll(() => page.evaluate(() => !window.__e2e.village)); await sleep(3000);
  states.push(await snap("soak done, back on the board"));
}
await ctx.close(); await browser.close();
if (OUT) writeFileSync(OUT, JSON.stringify(states, null, 1));
