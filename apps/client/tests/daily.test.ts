// daily.ts: streak (+1 per counted day, 2 shields per calendar month, month rollover,
// clock going backwards), live streak / shields shown, daily state persistence, the
// active-time clock, the share wiring, and local dates across midnight / time zones.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countCompletion, DailyClock, type DailyState, liveStreak, loadDaily, loadStreak, prevMonth, saveDaily, shareResult, SHIELDS_PER_MONTH, shieldsLeft,
  type StreakState, streakFromDates,
} from "../src/game/daily.ts";
import { MOON_PHASES, moonPhase as moonPhase8 } from "@games/lanterns-pips/share.ts";
import { APP_NAME, isoDay, isoFromDay, levelForDaily } from "../src/game/pipsApi.ts";
import { localDateISO } from "../src/game/session.ts";
import { fakeBackend, resetDevice, setPref } from "./helpers.ts";

// Phase 4: every chain of counted dates built from a fresh streak is also recomputed from its date
// set alone (streakFromDates, what the completion log / iCloud merge uses) and must be identical.
const counted = new WeakMap<StreakState, string[]>();
const fresh = (): StreakState => {
  const s: StreakState = { v: 1, last: null, streak: 0, best: 0, shields: {} };
  counted.set(s, []);
  return s;
};
const after = (s: StreakState, ...dates: string[]): StreakState =>
  dates.reduce((acc, d) => {
    const next = countCompletion(acc, d);
    const h = counted.get(acc);
    if (h) {
      const h2 = next !== acc || acc.last === d ? [...new Set([...h, d])] : h;
      counted.set(next, h2);
      expect(streakFromDates(h2), `recomputed after ${h2.join(",")}`).toEqual(next);
    }
    return next;
  }, s);
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => resetDevice());

describe("streak", () => {
  it("first counted completion starts the streak and persists it", async () => {
    const s = countCompletion(fresh(), "2026-10-14");
    expect(s).toEqual({ v: 1, last: "2026-10-14", streak: 1, best: 1, shields: {} });
    await tick();
    expect(JSON.parse(fakeBackend.prefs.get("streak")!)).toEqual(s);
    expect(await loadStreak()).toEqual(s);
  });

  it("+1 per consecutive day, best follows", () => {
    const s = after(fresh(), "2026-10-12", "2026-10-13", "2026-10-14");
    expect(s).toMatchObject({ streak: 3, best: 3, shields: {} });
  });

  it("only the first completion of a date counts (same date again changes nothing)", () => {
    const a = after(fresh(), "2026-10-13", "2026-10-14");
    const b = countCompletion(a, "2026-10-14");
    expect(b).toBe(a);
  });

  it("a missed day is covered by a shield of its own month", () => {
    const s = after(fresh(), "2026-10-12", "2026-10-14");
    expect(s).toMatchObject({ streak: 2, shields: { "2026-10": 1 } });
  });

  it("two shields per calendar month: a third missed day in the month breaks the streak", () => {
    const two = after(fresh(), "2026-10-10", "2026-10-13"); // missed 11, 12
    expect(two).toMatchObject({ streak: 2, shields: { "2026-10": 2 } });
    const broken = countCompletion(two, "2026-10-15"); // missed 14: no shield left in October
    expect(broken).toMatchObject({ streak: 1, best: 2, last: "2026-10-15", shields: { "2026-10": 2 } });
    // three missed days at once in one month also break it, without spending shields
    const gap3 = after(fresh(), "2026-10-01", "2026-10-05");
    expect(gap3).toMatchObject({ streak: 1, shields: {} });
  });

  it(`SHIELDS_PER_MONTH is 2`, () => expect(SHIELDS_PER_MONTH).toBe(2));

  it("month rollover: a new month brings two fresh shields", () => {
    const oct = after(fresh(), "2026-10-27", "2026-10-30"); // October shields used up (28, 29)
    expect(oct.shields).toEqual({ "2026-10": 2 });
    const nov = after(oct, "2026-10-31", "2026-11-03"); // missed Nov 1, 2 → November's shields
    expect(nov).toMatchObject({ streak: 4, shields: { "2026-10": 2, "2026-11": 2 } });
  });

  it("missed days across a month boundary use each month's own shields", () => {
    const s = after(fresh(), "2026-10-30", "2026-11-02"); // missed Oct 31 + Nov 1
    expect(s).toMatchObject({ streak: 2, shields: { "2026-10": 1, "2026-11": 1 } });
  });

  it("year rollover (Dec → Jan) and leap day", () => {
    expect(after(fresh(), "2026-12-30", "2027-01-01")).toMatchObject({ streak: 2, shields: { "2026-12": 1 } });
    expect(after(fresh(), "2028-02-28", "2028-03-01")).toMatchObject({ streak: 2 }); // 2028-02-29 missed, covered
    expect(after(fresh(), "2027-02-28", "2027-03-01")).toMatchObject({ streak: 2, shields: {} });
  });

  // BUG-3 (fixed): "keep this month and the two before" used day−31 / day−62, which skipped the
  // previous month on the 1st after a ≤ 30-day month (Mar 1, May 1, Jul 1, Oct 1, Dec 1).
  it("[BUG-3] the shield book keeps the previous month on the 1st of a month", () => {
    const s = after(fresh(), "2026-09-28", "2026-10-01"); // missed Sep 29, 30 → September's two shields
    expect(s.shields).toEqual({ "2026-09": 2 });
  });

  // every month boundary of 2026–2028 (28/29/30/31-day months, leap Feb 2028, Dec → Jan)
  const ym = (y: number, m: number): string => `${y}-${String(m).padStart(2, "0")}`;
  const firsts: Array<[string, string, string, string]> = [];
  for (let y = 2026; y <= 2028; y++) {
    for (let m = 1; m <= 12; m++) {
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      const back = (k: number): string => {
        const t = new Date(Date.UTC(y, m - 1 - k, 1));
        return ym(t.getUTCFullYear(), t.getUTCMonth() + 1);
      };
      // [1st of the next month, this month, two months back, three months back]
      firsts.push([`${ym(ny, nm)}-01`, ym(y, m), back(1), back(2)]);
    }
  }
  it.each(firsts)("[BUG-3] completing on %s keeps %s (just covered), %s, and drops %s", (first, month, twoBack, threeBack) => {
    const day = isoDay(first);
    const last = isoFromDay(day - 3); // missed the last two days of `month`
    const s0: StreakState = { v: 1, last, streak: 9, best: 9, shields: { [twoBack]: 1, [threeBack]: 2 } };
    const s = countCompletion(s0, first);
    expect(s.streak).toBe(10);
    expect(s.shields).toEqual({ [month]: 2, [twoBack]: 1 });
    expect(prevMonth(first.slice(0, 7))).toBe(month);
  });

  it("[BUG-3] the shield book over three leap / non-leap years: always this month + the two before", () => {
    let s = fresh();
    const all: string[] = [];
    for (let d = isoDay("2026-01-01"); d <= isoDay("2028-12-31"); d++) {
      const date = isoFromDay(d);
      if (Number(date.slice(8)) % 9 === 4) continue; // missed: the 4th, 13th, 22nd, 31st (two get a shield)
      s = countCompletion(s, date);
      all.push(date);
      const m0 = date.slice(0, 7);
      const allowed = new Set([m0, prevMonth(m0), prevMonth(prevMonth(m0))]);
      for (const k of Object.keys(s.shields)) expect(allowed.has(k), `${date}: ${k}`).toBe(true);
      // a month whose shields were used stays in the book for the whole next month
      const prev = prevMonth(m0);
      if (date >= "2026-02" && (date.endsWith("-01") || date.endsWith("-02"))) {
        const usedLast = [4, 13, 22, 31].filter((dom) => isoFromDay(isoDay(`${prev}-01`) + dom - 1).startsWith(prev)).length;
        expect(s.shields[prev] ?? 0, `${date}: ${prev}`).toBe(Math.min(2, usedLast));
      }
    }
    expect(streakFromDates(all)).toEqual(s); // phase 4: the same streak from the date set alone
  });

  it("prevMonth is calendar arithmetic", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(prevMonth("2026-03")).toBe("2026-02");
    expect(prevMonth("2028-03")).toBe("2028-02");
    expect(prevMonth("2026-10")).toBe("2026-09");
  });

  it("the clock going backwards is ignored", () => {
    const s = after(fresh(), "2026-10-14");
    expect(countCompletion(s, "2026-10-12")).toBe(s);
  });

  it("the shield book keeps only recent months", () => {
    let s = fresh();
    for (const d of ["2026-06-01", "2026-06-03", "2026-07-01", "2026-07-03", "2026-08-01", "2026-08-03", "2026-09-01", "2026-09-03"]) s = countCompletion(s, d);
    expect(Object.keys(s.shields).sort()).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("a long streak survives months of exactly-two misses", () => {
    let s = fresh();
    let day = isoDay("2026-01-01");
    let counted = 0;
    const dates: string[] = [];
    for (let m = 0; m < 12; m++) {
      const month = isoFromDay(day).slice(0, 7);
      while (isoFromDay(day).slice(0, 7) === month) {
        const dom = Number(isoFromDay(day).slice(8));
        if (dom !== 10 && dom !== 20) {
          s = countCompletion(s, isoFromDay(day));
          dates.push(isoFromDay(day));
          counted++;
        }
        day++;
      }
    }
    expect(s.streak).toBe(counted);
    expect(s.best).toBe(counted);
    expect(streakFromDates(dates)).toEqual(s);
  });
});

describe("live streak / shields on a given day", () => {
  const s = after(fresh(), "2026-10-12", "2026-10-13");
  it("alive today and tomorrow", () => {
    expect(liveStreak(s, "2026-10-13")).toBe(2);
    expect(liveStreak(s, "2026-10-14")).toBe(2);
  });
  it("alive while the missed days can still be covered, 0 once they cannot", () => {
    expect(liveStreak(s, "2026-10-16")).toBe(2); // missed 14, 15 → two shields
    expect(liveStreak(s, "2026-10-17")).toBe(0); // missed 14, 15, 16
  });
  it("shieldsLeft counts the pending covers", () => {
    expect(shieldsLeft(s, "2026-10-14")).toBe(2);
    expect(shieldsLeft(s, "2026-10-15")).toBe(1);
    expect(shieldsLeft(s, "2026-10-16")).toBe(0);
    expect(shieldsLeft(s, "2026-11-01")).toBe(2); // pending covers are October's
    expect(shieldsLeft(fresh(), "2026-10-14")).toBe(2);
  });
  it("no streak → 0", () => expect(liveStreak(fresh(), "2026-10-14")).toBe(0));
});

describe("daily state (Preferences 'daily')", () => {
  it("fresh for another date, persisted for the same date", async () => {
    expect(await loadDaily("2026-10-14")).toEqual({ date: "2026-10-14", ms: 0, hints: 0, undos: 0, result: null });
    const d: DailyState = { date: "2026-10-14", ms: 61_500, hints: 2, hintAt: [3, 7], undos: 1, result: null };
    saveDaily(d);
    await tick();
    expect(await loadDaily("2026-10-14")).toEqual(d);
    expect((await loadDaily("2026-10-15")).ms).toBe(0);
  });

  it.each([
    ["not JSON", "{"],
    ["ms not a number", JSON.stringify({ date: "2026-10-14", ms: "9" })],
  ])("corrupted daily state (%s) → fresh", async (_n, v) => {
    setPref("daily", v);
    expect(await loadDaily("2026-10-14")).toEqual({ date: "2026-10-14", ms: 0, hints: 0, undos: 0, result: null });
  });

  it("negative time is clamped", async () => {
    setPref("daily", JSON.stringify({ date: "2026-10-14", ms: -5, hints: 1, undos: 0, result: null }));
    expect((await loadDaily("2026-10-14")).ms).toBe(0);
  });

  it("corrupted streak → fresh", async () => {
    setPref("streak", "nope");
    expect(await loadStreak()).toEqual(fresh());
    setPref("streak", JSON.stringify({ v: 2, streak: 9 }));
    expect(await loadStreak()).toEqual(fresh());
  });
});

describe("DailyClock (active time only)", () => {
  afterEach(() => vi.restoreAllMocks());
  it("counts only between start and stop", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const c = new DailyClock(5000);
    expect(c.running).toBe(false);
    now += 9000;
    expect(c.peek()).toBe(5000);
    c.start();
    now += 2000;
    c.start(); // idempotent
    expect(c.peek()).toBe(7000);
    now += 1000;
    expect(c.stop()).toBe(8000);
    now += 60_000; // paused / backgrounded
    expect(c.stop()).toBe(8000);
    expect(c.peek()).toBe(8000);
  });
});

describe("share (system sheet)", () => {
  const level = levelForDaily("2026-10-14");
  it("the user-facing name is Duskwick (internal storage keys keep 'lanternly')", () => {
    expect(APP_NAME).toBe("Duskwick");
  });
  it("sends the rules' text through @capacitor/share; showTime toggles ⏱", async () => {
    await shareResult(level, { dateISO: "2026-11-05", seconds: 161, hints: 0, undos: 0, streak: 5 }, true);
    await shareResult(level, { dateISO: "2026-11-05", seconds: 161, hints: 2, undos: 1, streak: 5 }, false);
    const moon = MOON_PHASES[moonPhase8("2026-11-05")];
    expect(fakeBackend.shares.map((s) => s.text)).toEqual([
      `${APP_NAME} #5 ${moon}\n✨ ⏱ 2:41 🔥5\nhttps://humsleep.github.io/apps/duskwick/5?ct=share`,
      `${APP_NAME} #5 ${moon}\n💡2 🔥5\nhttps://humsleep.github.io/apps/duskwick/5?ct=share`,
    ]);
  });
  it("before the epoch the #n is dropped", async () => {
    await shareResult(level, { dateISO: "2026-10-14", seconds: 59, hints: 0, undos: 3, streak: 1 });
    expect(fakeBackend.shares[0]!.text).toMatch(new RegExp(`^${APP_NAME} \\S+\\n✨ ⏱ 0:59 🔥1\\nhttps://humsleep\\.github\\.io/apps/duskwick/\\?ct=share$`, "u"));
  });
});

describe("local dates across midnight and time zones", () => {
  const TZ = process.env["TZ"];
  afterEach(() => {
    if (TZ === undefined) delete process.env["TZ"];
    else process.env["TZ"] = TZ;
  });
  it.each([
    ["Asia/Seoul", "2026-10-13T14:59:59Z", "2026-10-13"],
    ["Asia/Seoul", "2026-10-13T15:00:00Z", "2026-10-14"],
    ["America/Los_Angeles", "2026-10-14T06:59:59Z", "2026-10-13"],
    ["America/Los_Angeles", "2026-10-14T07:00:00Z", "2026-10-14"],
    ["Pacific/Kiritimati", "2026-10-13T10:00:00Z", "2026-10-14"],
    ["Pacific/Pago_Pago", "2026-10-14T10:59:00Z", "2026-10-13"],
    // DST fall-back day in the US (2026-11-01): still one calendar date
    ["America/New_York", "2026-11-01T05:30:00Z", "2026-11-01"],
    ["America/New_York", "2026-11-01T06:30:00Z", "2026-11-01"],
  ])("%s at %s → %s", (tz, instant, want) => {
    process.env["TZ"] = tz;
    expect(localDateISO(new Date(instant))).toBe(want);
  });

  it("isoDay / isoFromDay are pure calendar arithmetic (no time zone)", () => {
    process.env["TZ"] = "America/Los_Angeles";
    expect(isoFromDay(isoDay("2026-03-08"))).toBe("2026-03-08"); // US DST start
    expect(isoDay("2026-10-15") - isoDay("2026-10-14")).toBe(1);
    expect(isoDay("2027-01-01") - isoDay("2026-12-31")).toBe(1);
    expect(isoDay("2028-03-01") - isoDay("2028-02-28")).toBe(2);
    process.env["TZ"] = "Asia/Seoul";
    expect(isoFromDay(isoDay("2026-10-14"))).toBe("2026-10-14");
  });
});
