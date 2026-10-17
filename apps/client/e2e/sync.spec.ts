// iCloud sync (phase 4) with a fake iCloud shared by several browser contexts — each context is
// one "device" (its own fake files / Preferences in its own localStorage), the cloud store lives
// in the test runner (window.__cloudHost binding, e2e/bridge.ts). A write on one device reaches
// the others as a 'server' change.
//   two devices   A solves the dailies of days 1–3, B (a new device) those of days 4–5 → streak 5 on both
//   reinstall     local storage wiped, the cloud kept → progress, the board in play, streak and best restored
import { type Browser, type BrowserContext, type Page, test as base } from "@playwright/test";
import { ALL_GUIDES, App, expect } from "./fixtures.ts";

class Cloud {
  values = new Map<string, string>();
  private pages: Page[] = [];

  async attach(ctx: BrowserContext): Promise<void> {
    await ctx.exposeBinding("__cloudHost", async ({ page }, op: string, arg?: { key: string; value?: string }) => {
      if (op === "getAll") return Object.fromEntries(this.values);
      if (op === "remove") this.values.delete(arg!.key);
      if (op === "set") {
        this.values.set(arg!.key, arg!.value!);
        for (const p of this.pages) {
          if (p !== page && !p.isClosed()) void p.evaluate((k) => (window as unknown as { __cloudFire: (e: unknown) => void }).__cloudFire({ reason: "server", keys: [k] }), arg!.key).catch(() => undefined);
        }
      }
      return null;
    });
  }

  track(p: Page): void {
    this.pages.push(p);
  }

  /** A device's snapshot (wire form, src/sync/model.ts) */
  snapshots(): Array<{ dev: string; p: number[]; s: [string, number, number, Record<string, number>]; j: unknown[] }> {
    return [...this.values.values()].map((v) => JSON.parse(v));
  }
}

const test = base;

async function device(browser: Browser, cloud: Cloud, now: string, extra: { files?: Record<string, string>; prefs?: Record<string, string>; noGuide?: boolean } = {}): Promise<{ ctx: BrowserContext; app: App }> {
  const u = test.info().project.use;
  const ctx = await browser.newContext({
    baseURL: u.baseURL!,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    timezoneId: "Asia/Seoul",
    locale: "ko-KR",
    ...(u.userAgent ? { userAgent: u.userAgent } : {}),
  });
  await cloud.attach(ctx);
  const page = await ctx.newPage();
  cloud.track(page);
  const app = new App(page);
  await app.seed({ now, files: extra.files ?? {}, prefs: extra.noGuide ? { ...extra.prefs } : { guide: ALL_GUIDES, ...extra.prefs } });
  return { ctx, app };
}

const synced = (app: App): Promise<void> => expect.poll(() => app.eval(() => window.__e2e.sync()?.status ?? null), { timeout: 20_000 }).toBe("synced");
const streakPref = async (app: App): Promise<{ last: string; streak: number; best: number } | null> => JSON.parse((await app.pref("streak")) ?? "null");

async function solveTodaysDaily(app: App, date: string): Promise<number> {
  await app.waitIdle();
  await expect.poll(() => app.eval(() => window.__e2e.scene!["scenery"].moonBreath)).toBe(true);
  await app.tapPoint(await app.eval(() => window.__e2e.moonPoint()));
  await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBe(date);
  await app.waitIdle();
  await app.solve();
  await expect.poll(() => app.eval(() => !!window.__e2e.scene!["card"]?.isOpen), { timeout: 20_000 }).toBe(true);
  const streak = Number(await app.eval(() => window.__e2e.scene!["card"]["streakText"]));
  await app.tapPoint(await app.eval(() => window.__e2e.cardPoint("home")));
  await expect.poll(() => app.eval(() => window.__e2e.session!["daily"])).toBeNull();
  await app.waitIdle();
  return streak;
}

/** Background the app: the mirror writes at once. */
async function pause(app: App): Promise<void> {
  await app.eval(() => window.__e2e.fakes.fire("pause"));
  await app.eval(() => window.__e2e.fakes.fire("resume"));
}

test.describe("iCloud sync", () => {
  test("two devices: A solves days 1–3, B days 4–5 → both show streak 5", async ({ browser }) => {
    test.setTimeout(240_000);
    const cloud = new Cloud();
    const { ctx: ca, app: a } = await device(browser, cloud, "2026-10-12T10:00:00");
    await a.open();
    await synced(a);
    for (const [now, date, want] of [["2026-10-12T10:00:00", "2026-10-12", 1], ["2026-10-13T20:00:00", "2026-10-13", 2], ["2026-10-14T08:30:00", "2026-10-14", 3]] as const) {
      if (date !== "2026-10-12") {
        await a.setNow(now);
        await a.reload();
        await synced(a);
      }
      expect(await solveTodaysDaily(a, date)).toBe(want);
    }
    await pause(a);
    await expect.poll(() => cloud.snapshots().find((x) => x.s[0] === "2026-10-14")?.s[1] ?? 0).toBe(3);

    // device B: a new phone, first launch on day 4
    const { ctx: cb, app: b } = await device(browser, cloud, "2026-10-15T09:00:00");
    await b.open();
    await synced(b);
    await expect.poll(() => streakPref(b)).toMatchObject({ last: "2026-10-14", streak: 3 });
    expect(await solveTodaysDaily(b, "2026-10-15")).toBe(4);
    await b.setNow("2026-10-16T09:00:00");
    await b.reload();
    await synced(b);
    expect(await solveTodaysDaily(b, "2026-10-16")).toBe(5);
    await pause(b);

    // A on day 5: the moon rests (solved on B) and the streak is 5
    await a.setNow("2026-10-16T21:00:00");
    await a.reload();
    await synced(a);
    await expect.poll(() => streakPref(a)).toMatchObject({ last: "2026-10-16", streak: 5, best: 5 });
    await expect.poll(() => a.eval(() => window.__e2e.scene!["scenery"].moonBreath)).toBe(false);
    expect(JSON.parse((await a.pref("daily"))!).result).toMatchObject({ dateISO: "2026-10-16", streak: 5 });
    expect(await streakPref(b)).toMatchObject({ last: "2026-10-16", streak: 5, best: 5 });
    // one key per device, each written by its owner only
    expect([...cloud.values.keys()].sort()).toEqual([`d.${(await a.eval(() => window.__e2e.sync()!.deviceId))}`, `d.${(await b.eval(() => window.__e2e.sync()!.deviceId))}`].sort());
    for (const app of [a, b]) expect(app.errors).toEqual([]);
    await ca.close();
    await cb.close();
  });

  test("uninstall / reinstall: local storage wiped, the cloud kept → progress, the board in play, streak and best restored", async ({ browser }) => {
    test.setTimeout(180_000);
    const cloud = new Cloud();
    const progress = JSON.stringify({ v: 3, game: "pips", track: "gentle", gentle: { level: 4, cleared: 3, hints: 1 }, deduce: { level: 2, cleared: 1, hints: 0 } });
    const { ctx: c1, app: a } = await device(browser, cloud, "2026-10-13T10:00:00", {
      files: { "pips-progress.json": progress },
      prefs: { numbers: "dots", streak: JSON.stringify({ v: 1, last: null, streak: 0, best: 7, shields: {} }) },
    });
    await a.open();
    await synced(a);
    expect(await solveTodaysDaily(a, "2026-10-13")).toBe(1);
    await a.setNow("2026-10-14T10:00:00");
    await a.reload();
    await synced(a);
    expect(await solveTodaysDaily(a, "2026-10-14")).toBe(2);
    expect(await a.eval(() => [window.__e2e.session!["track"], window.__e2e.session!["levelNumber"]])).toEqual(["gentle", 4]);
    const sol = await a.solution();
    await a.play(sol.slice(0, 2));
    await pause(a);
    await expect.poll(() => cloud.snapshots()[0]?.j.length ?? 0).toBe(1);
    const before = await streakPref(a);
    expect(before).toMatchObject({ last: "2026-10-14", streak: 2, best: 7 });
    const oldId = await a.eval(() => window.__e2e.sync()!.deviceId);
    await c1.close();

    // reinstall: a fresh context = empty files and Preferences (no lessons seen); same iCloud account
    const { ctx: c2, app: b } = await device(browser, cloud, "2026-10-14T19:00:00", { noGuide: true });
    await b.open();
    // watch for the first-run goal card: a returning player whose iCloud arrives at once never sees it
    await b.page.evaluate(() => {
      const w = window as unknown as { __seenGuides: Array<{ kind: string; early: boolean }>; __syncSignal?: { holdUntil: number } };
      w.__seenGuides = [];
      setInterval(() => {
        const k = (window.__e2e.scene?.["tut"] ? "tutorial" : window.__e2e.scene?.["guide"]?.active?.kind) as string | undefined;
        // early = shown while the first-run hold was still on (the hold failed)
        if (k && !w.__seenGuides.some((g) => g.kind === k)) w.__seenGuides.push({ kind: k, early: performance.now() < (w.__syncSignal?.holdUntil ?? 0) });
      }, 30);
    });
    await synced(b);
    await expect.poll(() => b.eval(() => window.__e2e.session!["levelNumber"]), { timeout: 20_000 }).toBe(4);
    await b.waitIdle();
    expect(await b.eval(() => [window.__e2e.session!.levelOf("gentle"), window.__e2e.session!.cleared("gentle"), window.__e2e.session!.levelOf("deduce")])).toEqual([4, 3, 2]);
    expect((await b.lanterns()).sort((x, y) => x - y)).toEqual(sol.slice(0, 2).sort((x, y) => x - y));
    expect(await streakPref(b)).toEqual(before);
    expect(await b.pref("numbers")).toBe("dots");
    await expect.poll(() => b.eval(() => window.__e2e.scene!["scenery"].moonBreath)).toBe(false); // today was solved before the reinstall
    expect(await b.eval(() => window.__e2e.sync()!.deviceId)).not.toBe(oldId);
    expect(Number(await b.pref("guide")) & (23 | 256)).toBe(23 | 256); // goal, tap, digit, conflict, v11 tutorial: learned
    await b.page.waitForTimeout(1500); // nothing starts teaching afterwards either
    expect(await b.eval(() => window.__e2e.scene!["guide"].active)).toBeNull();
    // iCloud here answers at once: the goal card waits for it (≤ 1.5 s) instead of flashing up. On a
    // badly overloaded machine the restore may take longer than the hold; then the card was shown only
    // after the hold and the restore dismissed it (above) — never shown during the hold.
    const seen = await b.eval(() => (window as unknown as { __seenGuides: Array<{ kind: string; early: boolean }> }).__seenGuides);
    expect(seen.filter((g) => g.early)).toEqual([]);
    // and the restored saves are local now: a relaunch without iCloud keeps them
    await expect.poll(() => b.progress()).toMatchObject({ gentle: { level: 4, cleared: 3 }, deduce: { level: 2 } });
    expect(b.errors).toEqual([]);
    await c2.close();
  });
});
