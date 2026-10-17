// Idle "movers" (playtest/perf/idle-governor.md): per screen, the display objects NOT marked ambient()
// that still change while nobody touches the game — each keeps the frame governor at full rate.
//   npx vite build --mode e2e && npx vite preview --mode e2e --port 4322 &
//   node scripts/idle-movers.mjs http://localhost:4322/ board,mid,conflict,hint,reduced,tower,guide,town,village,room,settings,daily,result
import { chromium } from "@playwright/test";
const URL = process.argv[2] ?? "http://localhost:4322/";
const progress = (n, track = "gentle", d = 3) => JSON.stringify({ v: 3, game: "pips", track, gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: d, cleared: d - 1, hints: 0 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ channel: "chromium" });
async function run(name, seed, go) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, timezoneId: "Asia/Seoul", locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.addInitScript((seed) => {
    const ls = localStorage;
    if (!ls.getItem("__e2e:seeded")) { ls.setItem("__e2e:seeded", "1"); const files = {}; for (const [k, v] of Object.entries(seed.files ?? {})) files[`LIBRARY/lanternly/${k}`] = { data: v, enc: "utf8" }; ls.setItem("__fake:device", JSON.stringify({ files, prefs: seed.prefs ?? {}, shares: [] })); }
  }, seed);
  await page.goto(URL);
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.__e2e?.ready())); i++) await sleep(100);
  for (let i = 0; i < 300 && !(await page.evaluate(() => window.__e2e.idle())); i++) await sleep(100);
  if (go) await go(page);
  await sleep(3500);
  const seen = new Map();
  await page.evaluate(() => window.__test.governor.movers());
  for (let k = 0; k < 30; k++) {
    await sleep(120);
    for (const m of await page.evaluate(() => window.__test.governor.movers())) {
      const key = `${m.path} ${m.type} ${m.key}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  const st = await page.evaluate(() => window.__test.governor.state());
  console.log(`== ${name}: ${JSON.stringify(st)}`);
  for (const [k, n] of [...seen].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`  ${n}x ${k}`);
  await ctx.close();
}
const which = (process.argv[3] ?? "board,town,result,settings,tower,daily,guide").split(",");
const G = "255";
if (which.includes("board")) await run("board g14", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } });
if (which.includes("board1")) await run("board g3", { files: { "pips-progress.json": progress(3) }, prefs: { guide: G } });
if (which.includes("tower")) await run("tower d5", { files: { "pips-progress.json": progress(12, "deduce", 5) }, prefs: { guide: G } });
if (which.includes("guide")) await run("first run", {}, null);
if (which.includes("town")) await run("town", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
  const pt = await p.evaluate(() => window.__e2e.objPoint("alley")); await p.mouse.click(pt.x, pt.y);
  for (let i = 0; i < 200 && !(await p.evaluate(() => !!window.__e2e.townHomePoint())); i++) await sleep(100);
});
// R2 village: the overview (residents breathe: ambient) and the cottage room (static)
const openVillage = async (p) => {
  const pt = await p.evaluate(() => window.__e2e.objPoint("leftBtn")); await p.mouse.click(pt.x, pt.y);
  for (let i = 0; i < 200 && !(await p.evaluate(() => !!window.__e2e.villagePoint("back"))); i++) await sleep(100);
};
if (which.includes("village")) await run("village", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G, dailyIntro: "1", dailyOffer: "1" } }, openVillage);
if (which.includes("room")) await run("room", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G, dailyIntro: "1", dailyOffer: "1" } }, async (p) => {
  await openVillage(p);
  const c = await p.evaluate(() => window.__e2e.villagePoint("cottage")); await p.mouse.click(c.x, c.y);
  for (let i = 0; i < 100 && !(await p.evaluate(() => !!window.__e2e.villagePoint("room-back"))); i++) await sleep(100);
});
if (which.includes("settings")) await run("settings", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
  const pt = await p.evaluate(() => window.__e2e.objPoint("gearIcon")); await p.mouse.click(pt.x, pt.y);
});
if (which.includes("daily")) await run("daily board", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
  const pt = await p.evaluate(() => window.__e2e.moonPoint()); await p.mouse.click(pt.x, pt.y);
  for (let i = 0; i < 200 && !(await p.evaluate(() => !!window.__e2e.session.daily)); i++) await sleep(100);
});
if (which.includes("result")) await run("result", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
  const pt = await p.evaluate(() => window.__e2e.moonPoint()); await p.mouse.click(pt.x, pt.y);
  for (let i = 0; i < 200 && !(await p.evaluate(() => !!window.__e2e.session.daily)); i++) await sleep(100);
  for (let i = 0; i < 300 && !(await p.evaluate(() => window.__e2e.idle())); i++) await sleep(100);
  const sol = await p.evaluate(() => window.__e2e.solution()); const have = new Set(await p.evaluate(() => window.__e2e.lanterns()));
  for (const c of sol.filter((c) => !have.has(c))) { const q = await p.evaluate((c) => window.__e2e.cellPoint(c), c); await p.mouse.click(q.x, q.y); await sleep(150); }
  for (let i = 0; i < 300 && !(await p.evaluate(() => !!window.__e2e.scene.card?.isOpen)); i++) await sleep(100);
  await sleep(2000);
});
const tapCells = async (p, cells) => { for (const c of cells) { const q = await p.evaluate((c) => window.__e2e.cellPoint(c), c); await p.mouse.click(q.x, q.y); await sleep(250); } };
if (which.includes("mid")) await run("mid-game g14", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
  const sol = await p.evaluate(() => window.__e2e.solution()); await tapCells(p, sol.slice(0, Math.max(1, sol.length - 2)));
});
if (which.includes("conflict")) await run("conflict g14", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
  const sol = await p.evaluate(() => window.__e2e.solution());
  // a lantern next to a solution lantern in its row = a conflict (most of the time)
  await tapCells(p, [sol[0], sol[0] + 1]);
});
if (which.includes("hint")) await run("hint g14", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
  const q = await p.evaluate(() => window.__e2e.objPoint("hintBtn")); await p.mouse.click(q.x, q.y);
});
if (which.includes("reduced")) {
  await run("reduced mid", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
    await p.emulateMedia({ reducedMotion: "reduce" });
    const sol = await p.evaluate(() => window.__e2e.solution()); await tapCells(p, sol.slice(0, 3));
  });
}
// v11 (playtest/ux-v11.md): the solved board waiting for "Next house →" (gentle 1–3), the How-to-play sheet
if (which.includes("next")) await run("next house g1", { prefs: { guide: G } }, async (p) => {
  const sol = await p.evaluate(() => window.__e2e.solution()); await tapCells(p, sol);
  for (let i = 0; i < 200 && !(await p.evaluate(() => !!window.__e2e.scene.nextPoint)); i++) await sleep(100);
});
if (which.includes("howto")) await run("how to play", { files: { "pips-progress.json": progress(14) }, prefs: { guide: G } }, async (p) => {
  const q = await p.evaluate(() => window.__e2e.toClient(window.__e2e.scene.howBtn.x, window.__e2e.scene.howBtn.y)); await p.mouse.click(q.x, q.y);
});
if (which.includes("tutorial")) await run("first-yard tutorial (after a touch)", {}, async (p) => {
  for (let i = 0; i < 200 && !(await p.evaluate(() => window.__e2e.scene.tut?.step === 1)); i++) await sleep(100);
  await p.mouse.click(10, 400);
});
await b.close();
