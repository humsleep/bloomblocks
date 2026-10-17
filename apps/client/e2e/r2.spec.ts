// R2 fix (docs/team/DECISIONS.md A1 / A2 / A7, playtest/r2-fix.md): the message slot (the solved moment's
// "Solved!" / "Next house →" and the error line sit between the HUD row and the board — never over a board
// row, the house plate or the house), the plate keeps its number until the next house, the HUD's one resting
// opacity; the rating ask's moments counted on the web fake (__reviewFake); the first daily's offer after
// gentle 3. ko-KR (the e2e locale).
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const progress = (n: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box): boolean => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;

/** The board's cell grid (canvas px) as drawn now. */
const grid = (app: App): Promise<Box> =>
  app.eval(() => {
    const s = window.__e2e.scene!;
    const g = s["geo"];
    const lv = window.__e2e.session!["level"];
    const r = s["board"].root;
    const w = g.cs * lv.w * r.scaleX;
    const h = g.cs * lv.h * r.scaleY;
    return { x: r.x - w / 2, y: r.y - h / 2, w, h };
  });

const reviews = (app: App): Promise<{ moment: string }[]> => app.page.evaluate(() => ((globalThis as unknown as { __reviewFake?: { requests: { moment: string }[] } }).__reviewFake?.requests ?? []).map((r) => ({ moment: r.moment })));

test.describe("A1 the message slot", () => {
  test("gentle 1: 'Solved!' and 'Next house →' sit between the HUD row and the board; no camera push; the plate keeps 1; the HUD rests at one opacity", async ({ app }) => {
    await app.seed({ prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    const before = await grid(app);
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["bigWord"].word as string)).toBe("완성!");
    const word = await app.eval(() => {
      const b = window.__e2e.scene!["bigWord"].objects[0].getBounds();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    expect(hit(word, await grid(app))).toBe(false);
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["nextPoint"]), { timeout: 20_000 }).toBe(true);
    const next = await app.eval(() => ({ ...window.__e2e.scene!["nextBox"] }) as Box);
    const g = await grid(app);
    expect(hit(next, g)).toBe(false);
    // the board did not move (it only breathes 6 % smaller around its centre); the camera stayed put
    expect(Math.abs(g.y + g.h / 2 - (before.y + before.h / 2))).toBeLessThan(2);
    expect(await app.eval(() => window.__e2e.scene!.cameras.main.zoom)).toBe(1);
    // above the board, under the HUD row
    const row = await app.eval(() => window.__e2e.scene!["geo"].ctrlY + window.__e2e.scene!["geo"].ctrlS / 2);
    expect(next.y).toBeGreaterThanOrEqual(row - 1);
    expect(next.y + next.h).toBeLessThanOrEqual(g.y);
    // the plate still says 1 while board 1 is there
    expect(await app.eval(() => window.__e2e.scene!["scenery"].plateN)).toBe(1);
    // one resting opacity for the whole HUD (no mix of "disabled" buttons)
    await app.page.waitForTimeout(400);
    const alphas = await app.eval(() => {
      const s = window.__e2e.scene!;
      return ["hintBtn", "undoBtn", "leftBtn", "gearIcon", "howBtn"].map((k) => Math.round(s[k].alpha * 100) / 100);
    });
    expect(Math.max(...alphas) - Math.min(...alphas)).toBeLessThan(0.03);
    await app.tapNext();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(2);
    await app.waitIdle();
    expect(await app.eval(() => window.__e2e.scene!["scenery"].plateN)).toBe(2);
  });

  test("an error line sits in the slot: not on the house plate, not on the board", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(4) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    const pair = await app.eval(async () => (await window.__e2e.api()).seeingPair(window.__e2e.session!["level"]));
    test.skip(!pair, "no seeing pair on this board");
    await app.play([pair![0], pair![1]]);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["bandText"] as string), { timeout: 8000 }).toBe("등불끼리 서로 비추면 안 돼요.");
    await app.page.waitForTimeout(300);
    const band = await app.eval(() => window.__e2e.scene!["band"].rect() as Box);
    const plate = await app.eval(() => window.__e2e.scene!["plateInfo"] as Box);
    expect(hit(band, plate)).toBe(false);
    expect(hit(band, await grid(app))).toBe(false);
    expect(band.y).toBeGreaterThan(plate.y + plate.h);
  });
});

test.describe("A2 the rating ask (web fake: __reviewFake)", () => {
  test("never in the first session: the 5th house's finale asks nothing", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(5) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 30_000 }).toBe(6);
    await app.waitIdle();
    await app.page.waitForTimeout(1500);
    expect(await reviews(app)).toEqual([]);
  });

  test("a later session: the 5th house's finale (after its street visit) asks once; the 6th does not", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(5) }, prefs: { guide: ALL_GUIDES, sessions: "3" } });
    await app.open();
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 30_000 }).toBe(6);
    await expect.poll(() => reviews(app), { timeout: 8000 }).toEqual([{ moment: "house5" }]);
    expect(JSON.parse((await app.pref("rating")) ?? "{}").asks).toHaveLength(1);
    await app.waitIdle();
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 30_000 }).toBe(7);
    await app.page.waitForTimeout(1500);
    expect(await reviews(app)).toHaveLength(1);
  });

  test("a hint earlier in the session keeps it away", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(5) }, prefs: { guide: ALL_GUIDES, sessions: "3" } });
    await app.open();
    await app.waitIdle();
    await app.tapButton("hintBtn");
    await app.page.waitForTimeout(300);
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 30_000 }).toBe(6);
    await app.waitIdle();
    await app.page.waitForTimeout(1500);
    expect(await reviews(app)).toEqual([]);
  });

  test("a counted ✨ daily asks once the evening is over (sheet closed → the track), not while the sheet is up", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES, sessions: "3" } });
    await app.open();
    await app.waitIdle();
    await app.tapButton("todayBtn");
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe("2026-10-14");
    await app.waitIdle();
    await app.solve();
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
    // nothing while the sheet is up
    await app.page.waitForTimeout(800);
    expect(await reviews(app)).toEqual([]);
    await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 15_000 }).toBeNull();
    await expect.poll(() => reviews(app), { timeout: 8000 }).toEqual([{ moment: "dailySparkle" }]);
  });
});

test.describe("A7 the first daily's offer", () => {
  test("not before gentle 3 is solved; after it, once: [Not now] closes it, the Today disc stays, never again", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(3) }, prefs: { guide: ALL_GUIDES, dailyIntro: "0", dailyOffer: "0" } });
    await app.open();
    await app.waitIdle();
    await app.page.waitForTimeout(2500);
    expect(await app.eval(() => window.__e2e.scene!["ask"].kind)).toBeNull();
    await app.solve();
    await app.tapNext();
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(4);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind), { timeout: 10_000 }).toBe("dailyOffer");
    expect(await app.eval(() => window.__e2e.scene!["ask"]["spec"].title as string)).toBe("오늘의 퍼즐");
    expect(await app.pref("dailyOffer")).toBe("1");
    await app.tapPoint(await app.eval(() => window.__e2e.askPoint("no")));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind)).toBeNull();
    expect(await app.eval(() => window.__e2e.session!["daily"])).toBeNull();
    expect(await app.eval(() => window.__e2e.scene!["todayBtn"].visible)).toBe(true);
    await app.reload();
    await app.waitIdle();
    await app.page.waitForTimeout(2500);
    expect(await app.eval(() => window.__e2e.scene!["ask"].kind)).toBeNull();
  });

  test("[Play] opens today's daily straight away (no second welcome card)", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(4) }, prefs: { guide: ALL_GUIDES, dailyIntro: "0", dailyOffer: "0" } });
    await app.open();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind), { timeout: 10_000 }).toBe("dailyOffer");
    await app.tapPoint(await app.eval(() => window.__e2e.askPoint("yes")));
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 15_000 }).toBe("2026-10-14");
    await app.waitIdle();
    await app.page.waitForTimeout(800);
    expect(await app.eval(() => window.__e2e.scene!["ask"].kind)).toBeNull();
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["clock"]?.running)).toBe(true);
  });
});

test.describe("A1 the postcard's milestone / gift moment vs the top HUD row (iPhone SE)", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  const log = (dates: string[]): string => JSON.stringify({ v: 1, days: Object.fromEntries(dates.map((d) => [d, { at: 0, ms: 90_000, hints: 0, undos: 0 }])) });
  const streak = (last: string, n: number): string => JSON.stringify({ v: 1, last, streak: n, best: n, shields: {} });

  test("day 7 (milestone + gift): while the moment is up no HUD caption or disc is on screen under it", async ({ app }) => {
    const days = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"];
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-daily-log.json": log(days), "pips-progress.json": progress(6) }, prefs: { guide: ALL_GUIDES, streak: streak("2026-10-13", 6) } });
    await app.open();
    await app.waitIdle();
    await app.tapButton("todayBtn");
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe("2026-10-14");
    await app.waitIdle();
    await app.solve();
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["card"]["momentOn"])).toBe(true);
    await app.page.waitForTimeout(700);
    const r = await app.eval(() => {
      const s = window.__e2e.scene!;
      const c = s["card"];
      const bb = (o: { getBounds: () => { x: number; y: number; width: number; height: number } }): { x: number; y: number; w: number; h: number } => {
        const b = o.getBounds();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      const moment = [c["mileImg"], c["giftImg"]].filter((o: { visible: boolean }) => o.visible).map(bb);
      const hud = [
        ...(s["caps"] as { t: { visible: boolean; alpha: number } & Parameters<typeof bb>[0]; key: string }[]).filter((x) => x.t.visible && x.t.alpha > 0.05).map((x) => ({ key: x.key, ...bb(x.t) })),
        ...["gearIcon", "howBtn", "backChip"].filter((k) => s[k].visible && s[k].alpha > 0.05).map((k) => ({ key: k, ...bb(s[k]) })),
      ];
      return { moment, hud };
    });
    expect(r.moment.length).toBeGreaterThan(0);
    const hits = r.hud.filter((h) => r.moment.some((m) => hit(m, h))).map((h) => h.key);
    expect(hits).toEqual([]);
  });
});
