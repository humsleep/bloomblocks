// Daily reminders (src/notify): the plan (time, ≤ 1/day, back-off), the texts, and the runtime
// against the web fake (opt-in flow, cancel on a done day, back-off from ignored reminders).
import { beforeEach, describe, expect, it } from "vitest";
import { LANGS } from "../src/a11y/strings.ts";
import { cadenceFor, DEFAULT_MINUTE, idFor, planReminders, reconcile, reminderMinute } from "../src/notify/plan.ts";
import { BANNED, REMINDER_TEXTS, reminderBody } from "../src/notify/texts.ts";
import { type FakeNotify, freshWebFake, notify, type PlanCtx, resetNotifyCache } from "../src/notify/index.ts";
import { resetDevice } from "./helpers.ts";

describe("reminder time", () => {
  it("median finish − 30 min, clamped 09:00–21:30; < 2 finishes → 19:30", () => {
    expect(reminderMinute([])).toBe(DEFAULT_MINUTE);
    expect(reminderMinute([20 * 60])).toBe(DEFAULT_MINUTE);
    expect(reminderMinute([20 * 60, 21 * 60, 22 * 60])).toBe(21 * 60 - 30);
    expect(reminderMinute([20 * 60, 21 * 60])).toBe(20 * 60 + 30 - 30);
    expect(reminderMinute([7 * 60, 8 * 60])).toBe(9 * 60);
    expect(reminderMinute([23 * 60, 23 * 60 + 30])).toBe(21 * 60 + 30);
  });
});

describe("plan", () => {
  const base = { today: "2026-10-16", nowMinute: 10 * 60, todayDone: false, minute: 19 * 60 + 30, ignored: 0 };
  it("one per day for 7 days, today's dropped once done or past", () => {
    const p = planReminders(base);
    expect(p.map((x) => x.date)).toEqual(["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(new Set(p.map((x) => x.id)).size).toBe(7);
    expect(planReminders({ ...base, todayDone: true })[0]!.date).toBe("2026-10-17");
    expect(planReminders({ ...base, nowMinute: 20 * 60 })[0]!.date).toBe("2026-10-17");
    expect(idFor("2026-10-16")).toBe(p[0]!.id);
  });
  it("back-off: 3 ignored → every other day, 7 → weekly (Sunday), 14 → stop", () => {
    expect([0, 2, 3, 6, 7, 13, 14].map(cadenceFor)).toEqual(["daily", "daily", "alternate", "alternate", "weekly", "weekly", "stop"]);
    const alt = planReminders({ ...base, ignored: 3 });
    expect(alt.length).toBeGreaterThanOrEqual(3);
    expect(alt.length).toBeLessThanOrEqual(4);
    const wk = planReminders({ ...base, ignored: 7 });
    expect(wk.map((x) => x.date)).toEqual(["2026-10-18"]); // the Sunday in the next 7 days
    expect(new Date(`${wk[0]!.date}T12:00:00Z`).getUTCDay()).toBe(0);
    expect(planReminders({ ...base, ignored: 14 })).toEqual([]);
  });
  it("reconcile: a tap or a played day resets, an ignored one counts", () => {
    const f = (d: string) => ({ date: d, minute: 1170, id: idFor(d) });
    expect(reconcile({ fired: [f("2026-10-10"), f("2026-10-11")], tapped: new Set(), played: new Set(), ignored: 1 })).toBe(3);
    expect(reconcile({ fired: [f("2026-10-10"), f("2026-10-11")], tapped: new Set(["2026-10-11"]), played: new Set(), ignored: 5 })).toBe(0);
    expect(reconcile({ fired: [f("2026-10-11"), f("2026-10-10")], tapped: new Set(), played: new Set(["2026-10-10"]), ignored: 5 })).toBe(1);
  });
});

describe("texts", () => {
  it("every language, short, positive (no loss / urgency words), no emoji", () => {
    for (const l of LANGS) {
      const t = REMINDER_TEXTS[l];
      expect(t.lines.length, l).toBeGreaterThanOrEqual(4);
      for (const s of [...t.lines, t.streak]) {
        expect(s.length, `${l}: ${s}`).toBeLessThanOrEqual(60);
        expect(s, `${l}: ${s}`).not.toMatch(BANNED);
        expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      }
      expect(t.streak).toContain("{n}");
    }
    expect(reminderBody("ko", 0, 0)).toBe(REMINDER_TEXTS.ko.lines[0]);
    expect(reminderBody("en", 2, 5)).toBe("Day 6: one more lantern for the street?");
    expect(reminderBody("en", 2, 1)).not.toContain("Day");
  });
});

describe("runtime (web fake)", () => {
  let fake: FakeNotify;
  const ctx = (o: Partial<PlanCtx> = {}): PlanCtx => ({
    today: "2026-10-16", nowMinute: 600, played: ["2026-10-14", "2026-10-15"], todayDone: false, finishMinutes: [20 * 60, 21 * 60], streak: 2, lang: "en",
    at: (d, m) => new Date(`${d}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`),
    ...o,
  });
  beforeEach(() => {
    resetDevice();
    resetNotifyCache();
    fake = freshWebFake();
  });
  const getFake = (): FakeNotify => fake;

  it("asks once, from the 2nd counted day; 'not now' never asks again; nothing scheduled while off", async () => {
    expect(await notify.shouldAsk(1)).toBe(false);
    expect(await notify.shouldAsk(2)).toBe(true);
    expect(getFake().prompts).toBe(0); // checking never prompts
    await notify.later();
    expect(await notify.shouldAsk(3)).toBe(false);
    expect(await notify.reschedule(ctx())).toEqual([]);
    expect(getFake().pending).toEqual([]);
  });

  it("yes → one system prompt → 7 reminders at median − 30 min, silent body only; done today → today's cancelled", async () => {
    expect(await notify.shouldAsk(2)).toBe(true);
    expect(await notify.enable()).toBe(true);
    expect(getFake().prompts).toBe(1);
    const p = await notify.reschedule(ctx());
    expect(p).toHaveLength(7);
    expect(p[0]).toMatchObject({ date: "2026-10-16", minute: 20 * 60 });
    expect(getFake().pending).toHaveLength(7);
    expect(new Date(getFake().pending[0]!.at).getHours()).toBe(20);
    await notify.cancelToday("2026-10-16");
    expect(getFake().pending.map((x) => x.id)).not.toContain(idFor("2026-10-16"));
    // re-planning never duplicates
    await notify.reschedule(ctx({ todayDone: true }));
    expect(getFake().pending).toHaveLength(6);
    expect(new Set(getFake().pending.map((x) => x.id)).size).toBe(6);
  });

  it("a due ask survives a relaunch until answered (either way), then is gone", async () => {
    expect(await notify.pendingAsk()).toBeNull();
    await notify.markAsk(19 * 60);
    resetNotifyCache(); // the app quit
    expect(await notify.pendingAsk()).toBe(19 * 60);
    await notify.later();
    resetNotifyCache();
    expect(await notify.pendingAsk()).toBeNull();
    resetDevice();
    resetNotifyCache();
    await notify.markAsk(600);
    expect(await notify.enable()).toBe(true);
    resetNotifyCache();
    expect(await notify.pendingAsk()).toBeNull();
  });

  it("denied at the system prompt → off, never asked again", async () => {
    getFake().answer = "denied";
    expect(await notify.enable()).toBe(false);
    expect(await notify.shouldAsk(5)).toBe(false);
    expect(await notify.isOn()).toBe(false);
  });

  it("ignored reminders back off; a tap resets", async () => {
    await notify.enable();
    await notify.reschedule(ctx());
    // three days later nothing was tapped or played → 3 ignored → every other day
    const later = await notify.reschedule(ctx({ today: "2026-10-19", nowMinute: 600, played: ["2026-10-14", "2026-10-15"] }));
    expect((await notify.prefs()).ignored).toBe(3);
    expect(later.length).toBeLessThan(7);
    getFake().tap(later[0]!.id);
    await new Promise((r) => setTimeout(r, 0));
    expect((await notify.prefs()).ignored).toBe(0);
  });

  it("off → everything cancelled", async () => {
    await notify.enable();
    await notify.reschedule(ctx());
    await notify.disable();
    expect(getFake().pending).toEqual([]);
  });
});
