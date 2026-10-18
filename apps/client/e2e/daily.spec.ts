// Daily: moon → today's daily → solve → result card → share text; the streak across
// simulated days (Date shifted per launch, context time zone Asia/Seoul), the month's
// two shields, finishing after local midnight, replay as practice, relaunch into the daily.
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

/** The share text starts with the user-facing name (Duskwick; the rules' APP_NAME). */
const appName = (app: App): Promise<string> => app.eval(() => window.__e2e.appName());
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

type Result = { dateISO: string; seconds: number; hints: number; undos: number; streak: number };
const dailyPref = async (app: App): Promise<{ date: string; result: Result | null; hints: number; undos: number }> =>
  JSON.parse((await app.pref("daily")) ?? "null");
const streakPref = async (app: App): Promise<{ last: string; streak: number; best: number; shields: Record<string, number> } | null> =>
  JSON.parse((await app.pref("streak")) ?? "null");

async function share(app: App): Promise<string> {
  const n = await app.eval(() => window.__e2e.fakes.shares.length);
  await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("share")));
  await expect.poll(() => app.eval(() => window.__e2e.fakes.shares.length)).toBe(n + 1);
  return app.eval(() => window.__e2e.fakes.shares.at(-1)!.text!);
}

async function home(app: App): Promise<void> {
  await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
  await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBeNull();
  await app.waitIdle();
}

test.describe("daily", () => {
  test("moon → daily → result card → share text (spoiler-free, time on) → home", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES } });
    await app.open();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["scenery"].moonBreath)).toBe(true);
    await openDaily(app, "2026-10-14");
    expect(await app.eval(() => window.__e2e.session!["seedKey"])).toMatch(/^lanterns-pips:daily:g\d+:2026-10-14$/);
    expect(await app.eval(() => window.__e2e.scene!["calImg"].visible)).toBe(true);
    await expect.poll(() => app.progress()).toMatchObject({ daily: "2026-10-14" });
    await solveDaily(app);
    const d = await dailyPref(app);
    expect(d.result).toMatchObject({ dateISO: "2026-10-14", hints: 0, undos: 0, streak: 1 });
    expect(d.result!.seconds).toBeGreaterThanOrEqual(1);
    expect(await streakPref(app)).toMatchObject({ last: "2026-10-14", streak: 1, best: 1 });
    expect(await app.eval(() => window.__e2e.scene!["dailyShields"])).toBe(2);
    const text = await share(app);
    const name = await appName(app);
    expect(name).toBe("Duskwick");
    // before DAILY_EPOCH (2026-11-01) the "#n" is dropped
    // R2 (A5): the third line is the link (no number before the epoch)
    expect(text).toMatch(new RegExp(`^${esc(name)} \\S+\\n✨ ⏱ \\d+:\\d\\d 🔥1\\nhttps://humsleep\\.github\\.io/apps/duskwick/\\?ct=share$`, "u"));
    expect(text.split("\n").slice(0, -1).join("\n").replace(name, "")).not.toMatch(/[A-Za-z]/);
    await home(app);
    expect(await app.eval(() => [window.__e2e.session!["track"], window.__e2e.session!["levelNumber"]])).toEqual(["gentle", 1]);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["scenery"].moonBreath)).toBe(false);
    await expect.poll(() => app.progress().then((p) => p.daily ?? null)).toBeNull();
  });

  test("share text after the epoch carries #n; 'time in share' off drops ⏱; hints show 💡", async ({ app }) => {
    await app.seed({ now: "2026-11-14T09:00:00", prefs: { guide: ALL_GUIDES, shareTime: "0" } });
    await app.open();
    await openDaily(app, "2026-11-14");
    await app.tapButton("hintBtn"); // a counted hint (place ghost)
    await expect.poll(() => app.eval(() => window.__e2e.scene!["hintState"].kind)).toBe("ghost");
    await solveDaily(app);
    expect((await dailyPref(app)).result).toMatchObject({ hints: 1, streak: 1 });
    expect(await share(app)).toMatch(new RegExp(`^${esc(await appName(app))} #14 \\S+\\n💡1 🔥1\\nhttps://humsleep\\.github\\.io/apps/duskwick/14\\?ct=share$`, "u"));
  });

  test("replaying a completed daily is practice: no new result, streak unchanged", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openDaily(app, "2026-10-14");
    await solveDaily(app);
    const first = await dailyPref(app);
    await home(app);
    await openDaily(app, "2026-10-14");
    expect(await app.eval(() => window.__e2e.session!["complete"])).toBe(false);
    expect(await app.lanterns()).toEqual([]);
    await solveDaily(app);
    expect(await dailyPref(app)).toEqual(first);
    expect(await streakPref(app)).toMatchObject({ streak: 1, best: 1 });
  });

  test("streak across days: +1 next day, two shields cover two missed days, a third miss restarts it", async ({ app }) => {
    test.setTimeout(180_000);
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES } });
    await app.open();
    const day = async (now: string, date: string, streak: number, shields: number): Promise<void> => {
      await app.setNow(now);
      await app.reload();
      await expect.poll(() => app.eval(() => window.__e2e.scene!["scenery"].moonBreath)).toBe(true);
      await openDaily(app, date);
      await solveDaily(app);
      expect((await dailyPref(app)).result).toMatchObject({ dateISO: date, streak });
      expect(await app.eval(() => window.__e2e.scene!["dailyShields"])).toBe(shields);
      expect(await app.eval(() => window.__e2e.scene!["card"]["streakText"])).toBe(String(streak));
      await home(app);
    };
    await day("2026-10-14T10:00:00", "2026-10-14", 1, 2);
    await day("2026-10-15T21:30:00", "2026-10-15", 2, 2);
    await day("2026-10-18T08:00:00", "2026-10-18", 3, 0); // 16 + 17 missed → both October shields
    expect(await streakPref(app)).toMatchObject({ last: "2026-10-18", streak: 3, best: 3, shields: { "2026-10": 2 } });
    await day("2026-10-20T08:00:00", "2026-10-20", 1, 0); // 19 missed, no shield left → restart
    await day("2026-11-02T08:00:00", "2026-11-02", 1, 2); // long gap: restart; November has fresh shields
    expect(await streakPref(app)).toMatchObject({ streak: 1, best: 3 });
  });

  test("finishing after local midnight is practice: the result is kept, the streak is not counted", async ({ app }) => {
    test.setTimeout(120_000);
    await app.seed({ now: "2026-10-14T23:59:45", prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openDaily(app, "2026-10-14");
    const sol = await app.solution();
    await app.play(sol.slice(0, -1));
    await expect.poll(() => app.eval(() => new Date().getDate()), { timeout: 30_000, intervals: [500] }).toBe(15);
    await app.play(sol.slice(-1));
    await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
    expect((await dailyPref(app)).result).toMatchObject({ dateISO: "2026-10-14", streak: 0 });
    expect(await streakPref(app)).toBeNull();
    // home → the moon now opens the 15th
    await home(app);
    await openDaily(app, "2026-10-15");
  });

  test("time on the daily counts only while it is open (pause stops the clock)", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openDaily(app, "2026-10-14");
    await app.eval(() => window.__e2e.fakes.fire("pause"));
    const paused = await app.eval(() => window.__e2e.scene!["clock"].peek() as number);
    await app.page.waitForTimeout(1500); // measuring that time does NOT pass: a wall-clock gap is the point
    expect(await app.eval(() => window.__e2e.scene!["clock"].peek() as number)).toBe(paused);
    // saved on pause (onPause saves just before it stops the clock: within a frame)
    expect(Math.abs(JSON.parse((await app.pref("daily"))!).ms - paused)).toBeLessThan(50);
    await app.eval(() => window.__e2e.fakes.fire("resume"));
    await expect.poll(() => app.eval(() => window.__e2e.scene!["clock"].running)).toBe(true);
  });

  // BUG-1 (fixed): the daily used to be filed under runs["gentle"], so after a relaunch into the
  // daily the home button switched "back" to the daily itself.
  test("[BUG-1] relaunch on the daily → home returns to the track", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openDaily(app, "2026-10-14");
    await app.play([(await app.solution())[0]!]);
    await app.reload();
    expect(await app.eval(() => window.__e2e.session!["daily"])).toBe("2026-10-14");
    await app.waitIdle();
    // phase 5: the left button stays the street (inactive here); the way out is the back chip
    await app.tapButton("leftBtn");
    await app.page.waitForTimeout(400); // asserting that nothing happens
    expect(await app.eval(() => [window.__e2e.session!["daily"], window.__e2e.scene!["townOpen"]])).toEqual(["2026-10-14", false]);
    await app.tapButton("backChip");
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 8_000 }).toBeNull();
    await app.waitIdle();
    expect(await app.eval(() => [window.__e2e.session!["track"], window.__e2e.session!["levelNumber"], window.__e2e.session!["moves"].length])).toEqual(["gentle", 1, 0]);
    await expect.poll(() => app.progress().then((p) => p.daily ?? null)).toBeNull();
    // the daily's move is still in its own journal; a relaunch now stays on the track
    expect(await app.journalMoves("daily")).toHaveLength(1);
    await app.reload();
    expect(await app.eval(() => window.__e2e.session!["daily"])).toBeNull();
  });

  test("[BUG-2] the daily run.bin passes the core verifySubmission (mode daily)", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openDaily(app, "2026-10-14");
    await solveDaily(app);
    await expect.poll(() => app.file("runs/p5-daily-2026-10-14.bin")).not.toBeNull();
    const v = await app.eval(async () => {
      const rl = await window.__e2e.runlog();
      const api = await window.__e2e.api();
      const rng = await window.__e2e.rng();
      const raw = window.__e2e.fakes.files.get("LIBRARY/lanternly/runs/p5-daily-2026-10-14.bin")!;
      const bytes = Uint8Array.from(atob(raw.data), (c) => c.charCodeAt(0));
      const p = api.dailyParams("2026-10-14");
      const r = rl.verifySubmission(api.lanternsPips, bytes, api.levelForDaily("2026-10-14"), { gameId: api.lanternsPips.id, mode: rl.MODE.daily, levelId: p.levelId >>> 0, seed: rng.deriveSeed(p.seedKey) });
      return r.ok ? { ok: true, complete: r.complete } : { ok: false, code: r.code };
    });
    expect(v).toEqual({ ok: true, complete: true });
  });
});

test.describe("shield explanation (review: shields had no explanation once the intro row was gone)", () => {
  test("first result sheet: the bubble plays once and leaves nothing behind; a tap on the shields replays it; VoiceOver label", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES } });
    await app.open();
    await openDaily(app, "2026-10-14");
    await solveDaily(app);
    const demoOn = (): Promise<boolean> => app.eval(() => !!window.__e2e.scene!["card"].shieldDemoOn);
    await expect.poll(demoOn, { timeout: 3_000, intervals: [50] }).toBe(true);
    // the covered lantern lands on the unlit day (the town's covered lantern) …
    await expect.poll(() => app.eval(() => window.__e2e.scene!["card"]["demoDays"][1].texture.key as string), { intervals: [50] }).toMatch(/^shieldKeep1@/);
    // … then the whole bubble is gone: no leftover dots
    await expect.poll(demoOn, { timeout: 6_000 }).toBe(false);
    expect(await app.pref("shieldIntro")).toBe("1");
    // tap on the shield icons → replay
    const p = await app.eval(() => {
      const c = window.__e2e.scene!["card"];
      const sh = c["shields"][0];
      return window.__e2e.toClient(c["cx"] + sh.x, c["cy"] + sh.y);
    });
    await app.tapPoint(p);
    await expect.poll(demoOn, { timeout: 2_000, intervals: [50] }).toBe(true);
    expect(await app.eval(() => !!window.__e2e.scene!["card"].isOpen)).toBe(true); // the tap did not close the sheet
    // VoiceOver: the shields have a spoken explanation (ko: 보호막 …)
    await expect
      .poll(() => app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button")].map((b) => b.getAttribute("aria-label") ?? "").some((l) => l.startsWith("보호막: 이번 달 2개"))))
      .toBe(true);
  });

  test("seen before: the bubble does not play on its own", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: ALL_GUIDES, shieldIntro: "1" } });
    await app.open();
    await openDaily(app, "2026-10-14");
    await solveDaily(app);
    await app.page.waitForTimeout(1500); // asserting that nothing starts
    expect(await app.eval(() => !!window.__e2e.scene!["card"].shieldDemoOn)).toBe(false);
  });
});

test.describe("visible daily entry (r6: 6/8 never found the moon)", () => {
  const progress = (n: number): string =>
    JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: n, cleared: n - 1, hints: 0 }, deduce: { level: 1, cleared: 0, hints: 0 } });

  test("today's disc in the HUD: emphasis (amber rim) while unplayed → opens the daily → done state after; VoiceOver label; result sheet shows the share's #n", async ({ app }) => {
    await app.seed({ now: "2026-11-12T10:00:00", files: { "pips-progress.json": progress(4) }, prefs: { guide: ALL_GUIDES } });
    await app.open();
    await app.waitIdle();
    await expect.poll(() => app.eval(() => window.__e2e.scene!["todayBtn"].visible)).toBe(true);
    // R2 HUD grammar: the disc's emphasis state ("open" = 1, not done = 0), no breathing halo any more
    await expect.poll(() => app.eval(() => window.__e2e.scene!["todayBtn"].texture.key as string)).toMatch(/^todayDisc12-10/);
    expect(await app.eval(() => window.__e2e.scene!["todayGlow"].visible)).toBe(false);
    // VoiceOver: the tile is its own control, labelled like the moon ("today's puzzle"), next to it
    await expect
      .poll(() => app.page.evaluate(() => [...document.querySelectorAll(".a11y-root button")].filter((b) => b.getAttribute("aria-label") === "오늘의 퍼즐").length))
      .toBe(2);
    await app.tapButton("todayBtn");
    await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe("2026-11-12");
    await app.waitIdle();
    await solveDaily(app);
    // the sheet shows the same #n as the share text (12 days after the 2026-11-01 epoch → #12)
    expect(await app.eval(() => window.__e2e.scene!["card"]["numText"])).toBe("#12");
    expect(await share(app)).toContain("#12");
    await home(app);
    await expect.poll(() => app.eval(() => window.__e2e.scene!["todayBtn"].texture.key as string)).toMatch(/^todayDisc12-01/);
    expect(await app.eval(() => window.__e2e.scene!["todayGlow"].visible)).toBe(false);
  });

  test("not during the first lessons (gentle 1–3), and the moon still opens the daily", async ({ app }) => {
    await app.seed({ now: "2026-10-14T10:00:00", prefs: { guide: "23" } }); // lessons seen, the moon guide not yet
    await app.open();
    await app.waitIdle();
    await app.page.waitForTimeout(500);
    expect(await app.eval(() => window.__e2e.scene!["todayBtn"].visible)).toBe(false);
    await openDaily(app, "2026-10-14");
  });
});
