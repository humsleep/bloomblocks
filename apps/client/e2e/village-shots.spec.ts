// Village screenshots (real app build, safe-area insets as the device sets them) → playtest/shots/village-v2/.
// SE (375 pt) in all 10 locales with their real lines (G3 by capture), pm in en / ko. VILLAGE_PSEUDO=1 swaps the
// non-en/ko text for the e2e-only pseudo-localization (src/village/text.ts) instead. Opt-in:
//   SHOTS_VILLAGE=1 npx playwright test --project=chromium e2e/village-shots.spec.ts
import { fileURLToPath } from "node:url";
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

// SHOTS_DIR=village-v2 (designer's polish pass) writes next to village-v1 instead of over it
const OUT = fileURLToPath(new URL(`../../../playtest/shots/${process.env["SHOTS_DIR"] ?? "village-v1"}/`, import.meta.url));
test.skip(!process.env["SHOTS_VILLAGE"], "screenshots only on request (SHOTS_VILLAGE=1)");

const progress = (gentleLevel: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const shot = (app: App, name: string): Promise<Buffer> => app.page.screenshot({ path: `${OUT}${name}.png` });
async function tapHit(app: App, id: string): Promise<void> {
  const pt = (): Promise<{ x: number; y: number } | null> => app.page.evaluate((i) => window.__e2e.villagePoint(i), id);
  await expect.poll(async () => !!(await pt()), { timeout: 10_000 }).toBe(true);
  await app.tapPoint((await pt())!);
  await app.page.waitForTimeout(250);
}

const ALL = ["ko-KR", "en-US", "ja-JP", "de-DE", "fr-FR", "es-MX", "pt-BR", "it-IT", "zh-Hans-SG", "zh-Hant-TW"];
for (const size of [{ tag: "se", w: 375, h: 667 }, { tag: "pm", w: 390, h: 844 }]) {
  for (const locale of size.tag === "se" ? ALL : ["ko-KR", "en-US"]) {
    test.describe(`${size.tag} ${locale}`, () => {
      test.use({ viewport: { width: size.w, height: size.h }, locale });
      test("village screens", async ({ app }) => {
        const pseudo = !!process.env["VILLAGE_PSEUDO"] && !locale.startsWith("en") && !locale.startsWith("ko");
        const tag = `${size.tag}-${locale.replace(/-(MX|KR|US|JP|DE|FR|IT|SG|TW)$/, "")}${pseudo ? "-pseudo" : ""}`;
        if (pseudo) await app.page.addInitScript(() => Object.assign(globalThis, { __villagePseudo: true }));
        // 2026-10-14 at dusk; a lantern lit today (the market is open); Momo has asked for a seat (request 2)
        const DAY = Math.floor(Date.UTC(2026, 9, 14) / 86_400_000);
        const village = JSON.stringify({ sv: { pd: [DAY], ch: [], lr: [], u: [], mk: [], q: [4], w: [], r: {} }, loc: {} });
        await app.seed({ now: "2026-10-14T19:00:00", files: { "pips-progress.json": progress(9) }, prefs: { guide: ALL_GUIDES, village } });
        await app.open();
        await app.waitIdle();
        await app.tapButton("leftBtn");
        await expect.poll(() => app.eval(() => window.__e2e.village?.["view"]?.screen ?? null), { timeout: 15_000 }).toBe("village");
        await app.page.waitForTimeout(500);
        await shot(app, `${tag}-1-village`);
        await tapHit(app, "stall");
        await shot(app, `${tag}-8-market`);
        await tapHit(app, "market-close");
        await tapHit(app, "res-momo");
        await shot(app, `${tag}-2-talk`);
        await tapHit(app, "mailbox");
        await shot(app, `${tag}-3-letter`);
        await tapHit(app, "letter-gift");
        await shot(app, `${tag}-4-gift`);
        await tapHit(app, "gift-put");
        await shot(app, `${tag}-5-room`);
        await tapHit(app, "slot-13");
        await shot(app, `${tag}-6-drawer`);
        // scroll the card grid to the locked cards (their "how to get it" lines)
        const win = await app.eval(() => window.__e2e.village!["gridWin"] as { y: number; h: number });
        await app.page.mouse.move(190, win.y + win.h - 20);
        await app.page.mouse.down();
        await app.page.mouse.move(190, win.y + 20, { steps: 8 });
        await app.page.mouse.up();
        await app.page.waitForTimeout(250);
        await shot(app, `${tag}-7-drawer-locked`);
      });
    });
  }
}

// The full village (round 3): all 7 residents (14 lit days), a winter night, the market, a cottage full of
// the new pieces with two visitors (fulfilled requests). SE, the four locales Reality checks first.
import { emptyRoom, encodeRoom, place } from "../src/village/model.ts";
import { pieceBit } from "../src/village/catalog.ts";

function fullRoom(): string {
  let r = emptyRoom();
  const put = (slot: number, item: string, cw: string): void => {
    r = place(r, slot, pieceBit({ item: item as never, cw: cw as never })) ?? r;
  };
  put(0, "bookshelf", "sage");
  put(1, "floorLamp", "cream");
  put(3, "dresser", "rose");
  put(4, "cactus", "sage");
  put(5, "rockingChair", "rose");
  put(7, "roundTable", "cream");
  put(9, "candles", "cream");
  put(10, "knitBasket", "rose");
  put(12, "cushion", "rose");
  put(14, "snowGlobe", "cream");
  put(15, "stringLights", "rose");
  put(16, "wreath", "sage");
  put(17, "hangingPlant", "sage");
  put(0, "stripedRug", "rose"); // the rug layer
  return encodeRoom(r);
}

for (const locale of ["ko-KR", "en-US", "ja-JP", "de-DE"]) {
  test.describe(`full se ${locale}`, () => {
    test.use({ viewport: { width: 375, height: 667 }, locale });
    test("full village screens (winter night)", async ({ app }) => {
      const tag = `full-se-${locale.slice(0, 2)}`;
      const DAY = Math.floor(Date.UTC(2026, 11, 20) / 86_400_000); // 2026-12-20, 22:00 local: night, winter (north)
      const pd = Array.from({ length: 14 }, (_, i) => DAY - 13 + i);
      // Momo (request 2: seating) and Kuri (request 10: small) were helped → they visit; Sage (4: plant) is still asking
      const q = [4, 5, 20, 21, 8];
      const u = ["floorLamp:cream", "dresser:rose", "cactus:sage", "rockingChair:rose", "roundTable:cream", "candles:cream", "stringLights:rose", "wreath:sage", "hangingPlant:sage", "bookshelf:sage", "stripedRug:rose"]
        .map((k) => pieceBit({ item: k.split(":")[0] as never, cw: k.split(":")[1] as never }));
      const village = JSON.stringify({
        sv: { pd, ch: pd, lr: [1, 2, 3, 4, 5, 6], u, mk: [], q, w: [], r: { "0": { s: fullRoom(), n: 1, at: 1, dev: "shotdev0" } } },
        loc: { visits: 9, lastVisit: DAY - 1, season: "winter" },
      });
      await app.seed({ now: "2026-12-20T22:00:00", files: { "pips-progress.json": progress(30) }, prefs: { guide: ALL_GUIDES, village } });
      await app.open();
      await app.waitIdle();
      await app.tapButton("leftBtn");
      await expect.poll(() => app.eval(() => window.__e2e.village?.["view"]?.screen ?? null), { timeout: 15_000 }).toBe("village");
      await app.page.waitForTimeout(500);
      expect(await app.eval(() => window.__e2e.village!["view"].residents as string[])).toEqual(["wick", "momo", "sage", "luna", "pip", "kuri", "yuki"]);
      await shot(app, `${tag}-1-village-night-winter`);
      await tapHit(app, "res-yuki");
      await shot(app, `${tag}-2-talk-yuki`);
      await tapHit(app, "stall");
      await shot(app, `${tag}-3-market`);
      await tapHit(app, "market-close");
      await tapHit(app, "cottage");
      await app.page.waitForTimeout(300);
      await shot(app, `${tag}-4-room-visitors`);
      await tapHit(app, "slot-8");
      await shot(app, `${tag}-5-drawer`);
    });
  });
}
