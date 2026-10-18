// The reminder soft ask is decided by state, not by a timer: a counted 2nd day marks it due
// (persisted), it shows once at a quiet moment on the track board, and it is never lost to a
// quick return, never shown under a finger, and comes back on the next launch if the app quit first.
import { ALL_GUIDES, type App, expect, test } from "./fixtures.ts";

const progress = (gentleLevel: number): string =>
  JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: gentleLevel, cleared: gentleLevel - 1, hints: 0 }, deduce: { level: 3, cleared: 2, hints: 0 } });
const log = (dates: string[]): string => JSON.stringify({ v: 1, days: Object.fromEntries(dates.map((d) => [d, { at: 0, ms: 90_000, hints: 0, undos: 0 }])) });
const streak = (last: string, n: number): string => JSON.stringify({ v: 1, last, streak: n, best: n, shields: {} });

async function seedDay2(app: App): Promise<void> {
  await app.seed({
    now: "2026-10-14T10:00:00",
    files: { "pips-daily-log.json": log(["2026-10-13"]), "pips-progress.json": progress(6) },
    prefs: { guide: ALL_GUIDES, streak: streak("2026-10-13", 1) },
  });
  await app.open();
}
async function solveTodaysDaily(app: App): Promise<void> {
  await app.waitIdle();
  await app.tapPoint(await app.eval(() => window.__e2e.moonPoint()));
  await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe("2026-10-14");
  await app.waitIdle();
  await app.solve();
  await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
}
const asked = (app: App): number => app.log.filter((l) => l.includes("[ask] notify")).length;
const askOpen = (app: App): Promise<boolean> => app.eval(() => window.__e2e.scene!["ask"].kind === "notify");
const moves = (app: App): Promise<number> => app.eval(() => window.__e2e.session!["moves"].length as number);

test("fast return: the ask resolves after the track is back — it still comes once, never during play, no move lost", async ({ app }) => {
  await seedDay2(app);
  // the permission read (inside shouldAsk) answers late: the old timer had already fired by then
  await expect.poll(() => app.eval(() => !!(globalThis as unknown as { __notifyFake?: object }).__notifyFake)).toBe(true);
  await app.eval(() => {
    const f = (globalThis as unknown as { __notifyFake: { checkPermissions: () => Promise<unknown> } }).__notifyFake;
    const real = f.checkPermissions.bind(f);
    f.checkPermissions = async () => {
      await new Promise((r) => setTimeout(r, 6000));
      return real();
    };
  });
  await solveTodaysDaily(app);
  await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
  await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 8_000 }).toBeNull();
  // the race the old timer lost: the track is back and the ask is not even decided yet
  expect(JSON.parse((await app.pref("notify")) ?? "{}").pend).toBeUndefined();
  await app.waitIdle();
  // keep playing the track board: the ask waits while the player is busy
  const have = new Set(await app.lanterns());
  const sol = (await app.solution()).filter((c) => !have.has(c));
  const before = await moves(app);
  for (const c of sol.slice(0, 3)) {
    await app.play([c]);
    expect(await askOpen(app)).toBe(false);
    await app.page.waitForTimeout(600);
  }
  expect(await moves(app)).toBe(before + 3);
  // hands off: the quiet moment brings it, once
  await expect.poll(() => askOpen(app), { timeout: 15_000 }).toBe(true);
  expect(asked(app)).toBe(1);
  // a board tap while it is up is not a move
  await app.tapCell(sol[3]!);
  await app.page.waitForTimeout(300);
  expect(await moves(app)).toBe(before + 3);
  await expect.poll(() => askOpen(app)).toBe(false);
  // answered (not now): never again, the board plays normally
  await app.waitIdle();
  await app.play([sol[3]!]);
  expect(await moves(app)).toBe(before + 4);
  await app.page.waitForTimeout(3000);
  expect(asked(app)).toBe(1);
  expect(JSON.parse((await app.pref("notify"))!)).toMatchObject({ asked: "later" });
  expect(JSON.parse((await app.pref("notify"))!).pend).toBeUndefined();
});

test("slow return: not on the sheet, once on the track; quit before answering → once on the next launch; answered → never", async ({ app }) => {
  await seedDay2(app);
  await solveTodaysDaily(app);
  await app.page.waitForTimeout(3000);
  expect(await askOpen(app)).toBe(false); // never on the result sheet
  expect(typeof JSON.parse((await app.pref("notify"))!).pend).toBe("number"); // due, persisted
  await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
  await expect.poll(() => app.eval(() => window.__e2e.session!["daily"]), { timeout: 8_000 }).toBeNull();
  await expect.poll(() => askOpen(app), { timeout: 15_000 }).toBe(true);
  expect(asked(app)).toBe(1);
  // the app quits with the card up: the next launch asks again (once)
  await app.reload();
  await expect.poll(() => askOpen(app), { timeout: 15_000 }).toBe(true);
  expect(asked(app)).toBe(2);
  await app.tapPoint(await app.eval(() => window.__e2e.askPoint("yes")));
  await expect.poll(() => app.eval(() => window.__e2e.notifyFake()?.prompts)).toBe(1);
  expect(JSON.parse((await app.pref("notify"))!)).toMatchObject({ on: true, asked: "yes" });
  await app.reload();
  await app.waitIdle();
  await app.page.waitForTimeout(4000);
  expect(await askOpen(app)).toBe(false);
  expect(asked(app)).toBe(2);
  // the track still plays: every tap is a move
  const sol = await app.solution();
  const have = new Set(await app.lanterns());
  const before = await moves(app);
  await app.play(sol.filter((c) => !have.has(c)).slice(0, 2));
  expect(await moves(app)).toBe(before + 2);
});
