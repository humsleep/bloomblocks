// Phase 5 flow (BENCHMARK-UX): the alley strip, the milestone street visit and the finale's
// "board away" gates (visit → ads slot → next board), result sheet v2 (tomorrow, month strip,
// milestones, gift), the night beat, the reminder soft ask, settings v2 (captions, reminder,
// start over), one role per HUD button, the ad-break confirm card.
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const progress = (gentleLevel: number, track = "gentle"): string =>
  JSON.stringify({ v: 3, game: "pips", track, gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 3, cleared: 2, hints: 0 } });
const log = (dates: string[]): string => JSON.stringify({ v: 1, days: Object.fromEntries(dates.map((d) => [d, { at: 0, ms: 90_000, hints: 0, undos: 0 }])) });
const streak = (last: string, n: number): string => JSON.stringify({ v: 1, last, streak: n, best: n, shields: {} });

async function openDaily(app: App, date: string): Promise<void> {
  await app.waitIdle();
  await app.tapPoint(await app.eval(() => window.__e2e.moonPoint()));
  await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe(date);
  await app.waitIdle();
}
async function solveDaily(app: App): Promise<void> {
  await app.solve();
  await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
}

test.describe("alley strip", () => {
  test("gentle 14: ten houses of 11–20, the 4th current; a tap opens the street; the daily hides it", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(14) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    const v = await app.eval(() => window.__e2e.scene!["alleyView"] as { on: boolean; cur: number; states: string[] });
    expect(v.on).toBe(true);
    expect(v.cur).toBe(3);
    expect(v.states.join(",")).toBe("done,done,done,current,ahead,ahead,ahead,ahead,ahead,ahead");
    await app.tapButton("alley");
    await expect.poll(() => app.eval(() => !!window.__e2e.town)).toBe(true);
    await expect.poll(() => app.eval(() => !!window.__e2e.townHomePoint()), { timeout: 15_000 }).toBe(true);
    await app.page.waitForTimeout(400); // the town's open slide; then close with home
    await app.tapPoint((await app.eval(() => window.__e2e.townHomePoint()))!);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["townOpen"]), { timeout: 15_000 }).toBe(false);
    await openDaily(app, "2026-10-14");
    expect(await app.eval(() => (window.__e2e.scene!["alleyView"] as { on: boolean }).on)).toBe(false);
  });

  test("tower: a column of floors, the current one = the tower's one number", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(9, "deduce") }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    expect(await app.eval(() => window.__e2e.session!["track"])).toBe("deduce");
    const v = await app.eval(() => window.__e2e.scene!["alleyView"] as { on: boolean; cur: number });
    expect(v).toMatchObject({ on: true, cur: 2 });
    expect(await app.eval(() => String(window.__e2e.scene!["scenery"]["plateN"]))).toBe("3");
  });
});

test.describe("finale gates (config B: the ad slot between boards)", () => {
  test("gentle 5 → out, street visit (the lamp lights), ads slot, then the next board", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(5) }, prefs: { guide: ALL_GUIDES, sessions: "1" } });
    await app.open();
    await app.solve();
    await expect.poll(() => app.eval(() => !!window.__e2e.town?.["visit"]), { timeout: 20_000 }).toBe(true);
    expect(await app.eval(() => window.__e2e.town!["visit"])).toMatchObject({ n: 5, kind: "lamp" });
    await expect.poll(() => app.eval(() => window.__e2e.town?.["visit"]?.lit ?? null)).toBe(true);
    // the next board waits while the street is up
    expect(await app.eval(() => window.__e2e.session!["levelNumber"])).toBe(5);
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(6);
    await app.waitIdle();
    const log = await app.eval(() => window.__e2e.scene!["flowLog"] as string[]);
    expect(log.join(" ")).toContain("out visit ads in");
    expect(await app.eval(() => window.__e2e.scene!["townOpen"])).toBe(false);
  });

  test("an ordinary level: out → ads slot → in, no visit; a tap during the finale still skips", async ({ app }) => {
    // (gentle 4: 1–3 wait for "Next house →" since v11, novice.spec)
    await app.seed({ files: { "pips-progress.json": progress(4) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.session!["nextReady"]), { timeout: 20_000 }).toBe(true);
    await app.tapCell(0);
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"])).toBe(5);
    await app.waitIdle();
    expect((await app.eval(() => window.__e2e.scene!["flowLog"] as string[])).join(" ")).toBe("out ads in");
    expect(await app.eval(() => window.__e2e.session!["moves"].length)).toBe(0);
  });

  test("gentle 10 (the alley's finale): the landmark visit", async ({ app }) => {
    await app.seed({ files: { "pips-progress.json": progress(10) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.solve();
    await expect.poll(() => app.eval(() => window.__e2e.town?.["visit"]?.kind ?? null), { timeout: 20_000 }).toBe("fountain");
    // a tap ends the visit early
    await app.page.mouse.click(200, 400);
    await expect.poll(() => app.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(11);
    await app.waitIdle();
    expect((await app.eval(() => window.__e2e.scene!["alleyView"] as { states: string[] })).states[0]).toBe("current");
  });
});

test.describe("result sheet v2", () => {
  test("3rd day: tomorrow tile, month strip (lit / shield / missed), milestone 3; the reminder soft ask → yes → one prompt, reminders planned", async ({ app }) => {
    await app.seed({
      now: "2026-10-14T10:00:00",
      files: { "pips-daily-log.json": log(["2026-10-07", "2026-10-11", "2026-10-13"]) },
      prefs: { guide: ALL_GUIDES, streak: streak("2026-10-13", 2) },
    });
    await app.open();
    await openDaily(app, "2026-10-14");
    await solveDaily(app);
    expect(await app.eval(() => window.__e2e.scene!["card"]["streakText"])).toBe("3");
    const ex = await app.eval(() => window.__e2e.scene!["sheetExtras"] as { month: { mark: string; today: boolean }[]; milestone: number; gift: boolean });
    expect(ex.milestone).toBe(3);
    expect(ex.gift).toBe(false);
    expect(ex.month).toHaveLength(31);
    // 6 missed (before the first); 7 lit; 8–10 missed (3 days: two shields cannot cover); 11 lit;
    // 12 covered by a shield; 13, 14 lit; 15+ ahead
    expect(ex.month.slice(5, 16).map((d) => d.mark[0]).join("")).toBe("mdmmmdsddff");
    expect(ex.month[13]!.today).toBe(true);
    // the milestone is a short moment above the sheet, not a row
    await expect.poll(() => app.eval(() => window.__e2e.scene!["card"]["momentOn"])).toBe(true);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["card"]["momentOn"]), { timeout: 6_000 }).toBe(false);
    // the soft ask never stacks on the sheet: it comes after the sheet + night beat, on the track
    expect(await app.eval(() => window.__e2e.scene!["ask"].isOpen)).toBe(false);
    await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 8_000 }).toBeNull();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind), { timeout: 10_000 }).toBe("notify");
    expect((await app.eval(() => window.__e2e.notifyFake()))?.prompts ?? 0).toBe(0);
    await app.tapPoint(await app.eval(() => window.__e2e.askPoint("yes")));
    await expect.poll(() => app.eval(() => window.__e2e.notifyFake()?.prompts)).toBe(1);
    await expect.poll(() => app.eval(() => window.__e2e.notifyFake()?.pending.length)).toBe(6); // today is done: tomorrow on
    const n = (await app.eval(() => window.__e2e.notifyFake()))!;
    expect(new Set(n.pending.map((p) => new Date(p.at).toDateString())).size).toBe(6);
    expect(JSON.parse((await app.pref("notify"))!)).toMatchObject({ on: true, asked: "yes" });
  });

  test("7th day: milestone 7 + the gift chip; home → a quiet night beat → the track", async ({ app }) => {
    const days = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"];
    await app.seed({ now: "2026-10-14T21:00:00", files: { "pips-daily-log.json": log(days) }, prefs: { guide: ALL_GUIDES, streak: streak("2026-10-13", 6), notify: JSON.stringify({ v: 1, on: false, asked: "later", ignored: 0, planned: [], tapped: [] }) } });
    await app.open();
    await openDaily(app, "2026-10-14");
    await solveDaily(app);
    expect(await app.eval(() => window.__e2e.scene!["sheetExtras"])).toMatchObject({ milestone: 7, gift: true });
    await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["night"])).toBe(true);
    expect(await app.eval(() => window.__e2e.session!["daily"])).toBe("2026-10-14");
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 8_000 }).toBeNull();
    await app.waitIdle();
    expect(await app.eval(() => window.__e2e.scene!["night"])).toBeNull();
    await app.page.waitForTimeout(1200);
    expect(await app.eval(() => window.__e2e.scene!["ask"].isOpen)).toBe(false); // asked before: never again
  });

  test("first counted day: no ask; the night beat can be skipped with a tap", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openDaily(app, "2026-10-14");
    await solveDaily(app);
    expect(await app.eval(() => window.__e2e.scene!["sheetExtras"])).toMatchObject({ milestone: 0, gift: false });
    await app.page.waitForTimeout(1600);
    expect(await app.eval(() => window.__e2e.scene!["ask"].isOpen)).toBe(false);
    await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["night"])).toBe(true);
    await app.page.mouse.click(200, 300);
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 3_000 }).toBeNull();
  });
});

test.describe("settings v2", () => {
  test("captions in the device language, the reminder row, start over (asks once), no privacy choices outside the EEA, the policy link always", async ({ app }) => {
    await app.seed({ prefs: { guide: ALL_GUIDES } });
    await app.open();
    const sol = await app.solution();
    await app.play(sol.slice(0, 2));
    await app.tapButton("gearIcon");
    await expect.poll(() => app.eval(() => window.__e2e.scene!["sheet"].isOpen)).toBe(true);
    // (the captions show from the sheet's next frame)
    await expect
      .poll(() => app.eval(() => (window.__e2e.scene!["sheet"]["caps"] as { visible: boolean; text: string }[]).filter((c) => c.visible).map((c) => c.text)))
      .toEqual(["소리", "숫자", "공유에 시간 표시", "진동", "등불 얼굴", "매일 알림", "규칙", "처음부터", "개인정보 처리방침"]);
    // UMP privacy choices only in the EEA; the privacy policy link always (App Review 5.1.1(i))
    expect(await app.eval(() => [10, 11, 12, 13].map((k) => window.__e2e.scene!["sheet"].shown(k)))).toEqual([true, true, false, true]);
    // reminder on from settings: the system prompt (fake) → on
    await app.tapPoint(await app.page.evaluate(() => window.__e2e.sheetPoint(10)));
    await expect.poll(() => app.eval(() => window.__e2e.notifyFake()?.prompts)).toBe(1);
    await expect.poll(() => app.pref("notify").then((v) => JSON.parse(v ?? "{}").on)).toBe(true);
    // start over
    await app.tapPoint(await app.page.evaluate(() => window.__e2e.sheetPoint(9)));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind)).toBe("restart");
    expect(await app.eval(() => window.__e2e.session!["moves"].length)).toBe(2);
    await app.tapPoint(await app.eval(() => window.__e2e.askPoint("yes")));
    await expect.poll(() => app.eval(() => window.__e2e.session!["moves"].length)).toBe(0);
    expect(await app.lanterns()).toEqual([]);
    expect(await app.journalMoves("gentle")).toEqual([]);
  });
});

test.describe("HUD roles", () => {
  test("the daily: the street button stays (inactive), the back chip leaves; the far home is easy to hit", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", files: { "pips-progress.json": progress(9, "deduce") }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    // the far home on the tower screen: 26 pt off its centre still counts
    const home = await app.eval(() => window.__e2e.farPoint());
    await app.tapPoint({ x: home.x - 24, y: home.y + 24 });
    await expect.poll(() => app.eval(() => window.__e2e.session!["track"]), { timeout: 15_000 }).toBe("gentle");
    await openDaily(app, "2026-10-14");
    expect(await app.eval(() => window.__e2e.scene!["backChip"].visible)).toBe(true);
    await app.tapButton("leftBtn");
    await app.page.waitForTimeout(400);
    expect(await app.eval(() => [window.__e2e.session!["daily"], window.__e2e.scene!["townOpen"]])).toEqual(["2026-10-14", false]);
    await app.tapButton("backChip");
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBeNull();
    await app.waitIdle();
    expect(await app.eval(() => window.__e2e.scene!["backChip"].visible)).toBe(false);
  });

  test("the ad-break chip opens a confirm card first (N's text); 'not now' closes it", async ({ app }) => {
    await app.seed({ prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.eval(() => window.__e2e.scene!["confirmBreak"]({ text: "Watch one short video for 30 minutes without ads?", yes: "Watch", no: "Not now", unavailable: "" }));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].kind)).toBe("break");
    expect(await app.eval(() => window.__e2e.scene!["ask"]["text"].text)).toContain("30");
    await app.tapPoint(await app.eval(() => window.__e2e.askPoint("no")));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["ask"].isOpen)).toBe(false);
  });
});
