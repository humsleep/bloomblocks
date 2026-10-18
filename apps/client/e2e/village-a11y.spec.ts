// Final G1 (2026-10-18) VoiceOver evidence: the DOM label layer (.a11y-root buttons, what VoiceOver reads)
// of the FULL village in all 10 locales — village, talk card, market (open → pick → reveal → closed for today),
// mailbox letter, cottage with visitors (+ postcard share), drawer. Per screen: no empty / placeholder /
// raw-key labels, every scene control is in the DOM, and (non-English) no control still reads like English.
// Counts are printed as "[a11y-locales] <locale> <screen>=<n> …".
import { pieceBit } from "../src/village/catalog.ts";
import { emptyRoom, encodeRoom, place } from "../src/village/model.ts";
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const progress = (gentleLevel: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });
const LOCALES = ["en-US", "ko-KR", "ja-JP", "de-DE", "fr-FR", "es-MX", "pt-BR", "it-IT", "zh-Hans-SG", "zh-Hant-TW"];

type Ctl = { id: string; label: string };
const domLabels = (app: App): Promise<string[]> => app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button")].map((b) => b.getAttribute("aria-label") ?? ""));
const hits = (app: App): Promise<Ctl[]> => app.page.evaluate(() => (window.__e2e.village!["hits"] as Ctl[]).map((h) => ({ id: h.id, label: h.label })));
async function tapHit(app: App, id: string): Promise<void> {
  const pt = (): Promise<{ x: number; y: number } | null> => app.page.evaluate((i) => window.__e2e.villagePoint(i), id);
  await expect.poll(async () => !!(await pt()), { timeout: 10_000 }).toBe(true);
  await app.tapPoint((await pt())!);
  await app.page.waitForTimeout(250);
}

function fullRoom(): string {
  let r = emptyRoom();
  const put = (slot: number, item: string, cw: string): void => {
    r = place(r, slot, pieceBit({ item: item as never, cw: cw as never })) ?? r;
  };
  put(0, "stripedRug", "rose");
  put(1, "floorLamp", "cream");
  put(3, "dresser", "rose");
  put(4, "cactus", "sage");
  put(5, "rockingChair", "rose");
  return encodeRoom(r);
}

const BAD = /[{}]|undefined|NaN|\[object|^[a-z]+(\.[a-zA-Z0-9]+)+$/;
const english: Record<string, Record<string, string>> = {}; // screen → id → label (en-US, filled first)

for (const locale of LOCALES) {
  test.describe(`a11y ${locale}`, () => {
    test.use({ viewport: { width: 375, height: 667 }, locale });
    test(`${locale}: every full-village control has a label`, async ({ app }) => {
      const DAY = Math.floor(Date.UTC(2026, 11, 20) / 86_400_000);
      const pd = Array.from({ length: 14 }, (_, i) => DAY - 13 + i);
      // Momo + Kuri helped (visit, thank-you letters unread), Sage still asks → a bubble; the market is open today
      const u = ["floorLamp:cream", "dresser:rose", "cactus:sage", "rockingChair:rose", "stripedRug:rose"].map((k) => pieceBit({ item: k.split(":")[0] as never, cw: k.split(":")[1] as never }));
      const village = JSON.stringify({
        sv: { pd, ch: pd, lr: [1, 2, 3, 4, 5, 6], u, mk: [], q: [4, 5, 20, 21, 8], w: [], r: { "0": { s: fullRoom(), n: 1, at: 1, dev: "a11ydev0" } } },
        loc: { visits: 9, lastVisit: DAY - 1, season: "winter" },
      });
      await app.seed({ now: "2026-12-20T22:00:00", files: { "pips-progress.json": progress(30) }, prefs: { guide: ALL_GUIDES, village } });
      await app.open();
      await app.waitIdle();
      await app.tapButton("leftBtn");
      await expect.poll(() => app.eval(() => window.__e2e.village?.["view"]?.screen ?? null), { timeout: 15_000 }).toBe("village");
      await app.page.waitForTimeout(600);

      const counts: Record<string, number> = {};
      const seen = new Set<string>();
      const check = async (screen: string, mustHave: RegExp[]): Promise<void> => {
        await app.page.waitForTimeout(350); // the layer is rebuilt a frame after a switch
        const dom = await domLabels(app);
        const hs = await hits(app);
        counts[screen] = dom.length;
        expect(dom.length, `${locale} ${screen}: no labels`).toBeGreaterThan(0);
        expect(dom.filter((l) => l.trim().length === 0), `${locale} ${screen}: empty labels`).toEqual([]);
        expect(dom.filter((l) => BAD.test(l)), `${locale} ${screen}: placeholder / raw-key labels`).toEqual([]);
        expect(new Set(dom).size, `${locale} ${screen}: duplicate labels`).toBe(dom.length);
        for (const h of hs) expect(dom, `${locale} ${screen}: control ${h.id} missing in the DOM`).toContain(h.label);
        for (const re of mustHave) expect(hs.map((h) => h.id).some((id) => re.test(id)), `${locale} ${screen}: no control ${re}`).toBe(true);
        if (locale === "en-US") english[screen] = Object.fromEntries(hs.map((h) => [h.id, h.label]));
        else {
          // a control whose whole label is still the English one (the English run came first)
          const en = english[screen] ?? {};
          const same = hs.filter((h) => en[h.id] === h.label && /[A-Za-z]{4,}/.test(h.label) && !(locale === "fr-FR" && h.id === "cw-cactus-rose")) // "Cactus, rose" is French too.map((h) => `${h.id}="${h.label}"`);
          expect(same, `${locale} ${screen}: labels identical to English`).toEqual([]);
        }
        for (const l of dom) seen.add(l);
      };

      await check("village", [/^res-/, /^req-/, /^cottage$/, /^mailbox$/, /^stall$/, /^back$/]);
      await tapHit(app, "res-yuki");
      await check("talk", [/^card$/]);
      await tapHit(app, "card");
      await tapHit(app, "stall");
      await check("market", [/^offer-0$/, /^offer-2$/, /^market-close$/]);
      await tapHit(app, "offer-0");
      await check("gift", [/^gift-put$/, /^gift-later$/]);
      await tapHit(app, "gift-later");
      await check("village-after-pick", [/^stall$/]); // "tomorrow again" state
      expect(await app.eval(() => window.__e2e.village!["view"].screen)).toBe("village");
      await tapHit(app, "mailbox");
      await check("letter", [/^letter/]);
      await tapHit(app, "letter-away");
      await tapHit(app, "cottage");
      await check("room", [/^slot-0$/, /^slot-14$/, /^slot-rug$/, /^postcard$/, /^room-back$/, /^guest-/]);
      await tapHit(app, "postcard");
      expect(await app.eval(() => window.__e2e.fakes.shares.length)).toBe(1); // postcard share control works
      await tapHit(app, "slot-8");
      await check("drawer", [/^drawer-close$/, /^card-/, /^tab-/]);
      console.log(`[a11y-locales] ${locale} ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ")} unique=${seen.size}`);
    });
  });
}
