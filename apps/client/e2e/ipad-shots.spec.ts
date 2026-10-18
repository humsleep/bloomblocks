// Final G1 B3: the iPhone-only app on iPad (App Review runs it in a big portrait compat window; later
// iPadOS lets that window resize). Web build at iPad-like viewports with the compat window's insets
// (top 20 / bottom 25, README "iPad") → playtest/shots/ipad-v2/. Opt-in:
//   SHOTS_IPAD=1 npx playwright test --project=chromium e2e/ipad-shots.spec.ts
import { fileURLToPath } from "node:url";
import { pieceBit } from "../src/village/catalog.ts";
import { emptyRoom, encodeRoom, place } from "../src/village/model.ts";
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const OUT = fileURLToPath(new URL("../../../playtest/shots/ipad-v2/", import.meta.url));
test.skip(!process.env["SHOTS_IPAD"], "screenshots only on request (SHOTS_IPAD=1)");

const progress = (gentleLevel: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const shot = (app: App, name: string): Promise<Buffer> => app.page.screenshot({ path: `${OUT}${name}.png` });
async function tapHit(app: App, id: string): Promise<void> {
  const pt = (): Promise<{ x: number; y: number } | null> => app.page.evaluate((i) => window.__e2e.villagePoint(i), id);
  await expect.poll(async () => !!(await pt()), { timeout: 10_000 }).toBe(true);
  await app.tapPoint((await pt())!);
  await app.page.waitForTimeout(300);
}
/** every village control inside the viewport (a hit box fully off-screen / cut by an edge is a layout break) */
const offscreen = (app: App): Promise<string[]> =>
  app.page.evaluate(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    return (window.__e2e.village!["hits"] as Array<{ id: string }>)
      .map((h) => ({ id: h.id, p: window.__e2e.villagePoint(h.id) }))
      .filter((h) => !h.p || h.p.x < 0 || h.p.y < 0 || h.p.x > W || h.p.y > H)
      .map((h) => h.id);
  });

function fullRoom(): string {
  let r = emptyRoom();
  const put = (slot: number, item: string, cw: string): void => {
    r = place(r, slot, pieceBit({ item: item as never, cw: cw as never }))! ?? r;
  };
  put(0, "stripedRug", "rose");
  put(1, "floorLamp", "cream");
  put(3, "dresser", "rose");
  put(4, "cactus", "sage");
  put(5, "rockingChair", "rose");
  put(7, "roundTable", "cream");
  put(9, "candles", "cream");
  put(12, "cushion", "rose");
  put(15, "stringLights", "rose");
  return encodeRoom(r);
}

const SIZES = [
  { tag: "compat-660x1180", w: 660, h: 1180 },
  { tag: "ipad-768x1024", w: 768, h: 1024 },
  { tag: "ipad-834x1112", w: 834, h: 1112 },
];
for (const size of SIZES) {
  test.describe(size.tag, () => {
    test.use({ viewport: { width: size.w, height: size.h }, locale: "en-US" });
    test("puzzle, rules, settings, village, market, cottage, rotation", async ({ app }) => {
      await app.page.addInitScript(() => {
        const set = (): boolean => {
          const r = document.documentElement;
          if (!r) return false;
          r.style.setProperty("--safe-top", "20px");
          r.style.setProperty("--safe-bottom", "25px");
          return true;
        };
        if (!set()) new MutationObserver((_, o) => set() && o.disconnect()).observe(document, { childList: true });
      });
      const DAY = Math.floor(Date.UTC(2026, 11, 20) / 86_400_000);
      const pd = Array.from({ length: 14 }, (_, i) => DAY - 13 + i);
      const u = ["floorLamp:cream", "dresser:rose", "cactus:sage", "rockingChair:rose", "roundTable:cream", "candles:cream", "stringLights:rose", "stripedRug:rose", "cushion:rose"].map((k) => pieceBit({ item: k.split(":")[0] as never, cw: k.split(":")[1] as never }));
      const village = JSON.stringify({
        sv: { pd, ch: pd, lr: [1, 2, 3, 4, 5, 6], u, mk: [], q: [4, 5, 20, 21, 8], w: [], r: { "0": { s: fullRoom(), n: 1, at: 1, dev: "ipaddev0" } } },
        loc: { visits: 9, lastVisit: DAY - 1, season: "winter" },
      });
      await app.seed({ now: "2026-12-20T22:00:00", files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES, village } });
      await app.open();
      await app.waitIdle();
      await app.page.waitForTimeout(600);
      await shot(app, `${size.tag}-1-puzzle`);
      await app.eval(() => void window.__e2e.scene!["openHowTo"]());
      await app.page.waitForTimeout(900);
      await shot(app, `${size.tag}-2-rules`);
      await app.page.keyboard.press("Escape");
      await app.eval(() => window.__e2e.scene!["closeHowTo"]());
      await app.page.waitForTimeout(500);
      await app.tapButton("gearIcon");
      await app.page.waitForTimeout(700);
      await shot(app, `${size.tag}-3-settings`);
      await app.tapButton("gearIcon");
      await app.eval(() => window.__e2e.scene!["sheet"].hide(window.__e2e.scene!["time"].now));
      await app.page.waitForTimeout(500);
      await app.waitIdle();
      await app.tapButton("leftBtn");
      await expect.poll(() => app.eval(() => window.__e2e.village?.["view"]?.screen ?? null), { timeout: 15_000 }).toBe("village");
      await app.page.waitForTimeout(800);
      await shot(app, `${size.tag}-4-village`);
      console.log(`[ipad] ${size.tag} village off-screen controls: ${JSON.stringify(await offscreen(app))}`);
      await tapHit(app, "stall");
      await app.page.waitForTimeout(400);
      await shot(app, `${size.tag}-5-market`);
      console.log(`[ipad] ${size.tag} market off-screen controls: ${JSON.stringify(await offscreen(app))}`);
      await tapHit(app, "market-close");
      await tapHit(app, "cottage");
      await app.page.waitForTimeout(500);
      await shot(app, `${size.tag}-6-cottage`);
      console.log(`[ipad] ${size.tag} cottage off-screen controls: ${JSON.stringify(await offscreen(app))}`);
      await tapHit(app, "slot-8");
      await shot(app, `${size.tag}-7-drawer`);
      await tapHit(app, "drawer-close");
      // rotation: the window turns landscape (a resize the app has to re-fit to)
      await app.page.setViewportSize({ width: size.h, height: size.w });
      await app.page.waitForTimeout(1200);
      await shot(app, `${size.tag}-8-rotated-cottage`);
      console.log(`[ipad] ${size.tag} rotated cottage off-screen controls: ${JSON.stringify(await offscreen(app))}`);
      await tapHit(app, "room-back");
      await app.page.waitForTimeout(700);
      await shot(app, `${size.tag}-9-rotated-village`);
      console.log(`[ipad] ${size.tag} rotated village off-screen controls: ${JSON.stringify(await offscreen(app))}`);
      await tapHit(app, "back");
      await app.page.waitForTimeout(900);
      await shot(app, `${size.tag}-10-rotated-puzzle`);
    });
  });
}
