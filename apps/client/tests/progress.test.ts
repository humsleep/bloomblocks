// Phase 5 flow rules (src/game/progress.ts): the alley strip, street milestones, streak
// milestones / the 7-day gift, the month strip (shields like daily.ts), the first-session tower.
import { describe, expect, it } from "vitest";
import { alleyOf, giftEarned, milestoneOf, monthStrip, nextDay, STREAK_MILESTONES, streakMilestone, towerOpen } from "../src/game/progress.ts";
import { streakFromDates } from "../src/game/daily.ts";

describe("alley strip", () => {
  it("is the block of ten the current level belongs to, finale = the 10th, lamp at the 5th", () => {
    const a = alleyOf(1);
    expect(a.start).toBe(1);
    expect(a.cells.map((c) => c.state)).toEqual(["current", ...Array(9).fill("ahead")]);
    expect(a.cells[9]).toMatchObject({ n: 10, finale: true });
    expect(a.cells.filter((c) => c.lamp).map((c) => c.n)).toEqual([5]);
    const b = alleyOf(14);
    expect(b.start).toBe(11);
    expect(b.cells.map((c) => c.state).join(",")).toBe("done,done,done,current,ahead,ahead,ahead,ahead,ahead,ahead");
    expect(b.cells.filter((c) => c.lamp).map((c) => c.n)).toEqual([15]);
    expect(alleyOf(10).cells[9]!.state).toBe("current");
    expect(alleyOf(11).start).toBe(11);
    expect(alleyOf(0).start).toBe(1);
  });
});

describe("street milestones", () => {
  it("lamp every 5, landmark every 10 (layout.ts lampEvery / landmarkEvery)", () => {
    expect([1, 4, 5, 6, 10, 15, 20, 25, 30].map(milestoneOf)).toEqual([null, null, "lamp", null, "landmark", "lamp", "landmark", "lamp", "landmark"]);
    expect(milestoneOf(0)).toBeNull();
  });
});

describe("streak milestones and the gift", () => {
  it("3 · 7 · 30 · 100 · 365 only", () => {
    expect(STREAK_MILESTONES).toEqual([3, 7, 30, 100, 365]);
    expect([1, 2, 3, 4, 7, 14, 30, 100, 365, 366].map(streakMilestone)).toEqual([0, 0, 3, 0, 7, 0, 30, 100, 365, 0]);
  });
  it("the gift follows the ads policy's every-7th-day rule", () => {
    expect([0, 6, 7, 13, 14, 21].map(giftEarned)).toEqual([false, false, true, false, true, true]);
  });
});

describe("month strip", () => {
  it("done / covered by a shield / missed, today ringed, the rest of the month ahead", () => {
    const { ym, days } = monthStrip(["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-07"], "2026-10-09");
    expect(ym).toBe("2026-10");
    expect(days).toHaveLength(31);
    const m = days.slice(0, 10).map((d) => d.mark[0]).join("");
    // 3 covered (shield 1); the gap 5–6 needs two, one is left → 5, 6 missed; 8 pending, covered by the last one
    expect(m).toBe("ddsdmmdsff");
    expect(days[8]).toMatchObject({ day: 9, today: true, mark: "future" });
    expect(days.filter((d) => d.today)).toHaveLength(1);
  });

  it("agrees with daily.ts: a covered gap keeps the streak, an uncoverable one breaks it", () => {
    const dates = ["2026-10-01", "2026-10-03", "2026-10-05", "2026-10-07"];
    // 2 and 4 covered (both shields), 6 cannot be → streak restarts on the 7th
    expect(streakFromDates(dates).streak).toBe(1);
    const m = monthStrip(dates, "2026-10-07").days.slice(0, 7).map((d) => d.mark[0]).join("");
    expect(m).toBe("dsdsdmd");
    const two = ["2026-10-01", "2026-10-03"];
    expect(streakFromDates(two).streak).toBe(2);
    expect(monthStrip(two, "2026-10-03").days.slice(0, 3).map((d) => d.mark)).toEqual(["done", "shield", "done"]);
  });

  it("pending: days missed since the last completion show as covered while shields remain", () => {
    const m = monthStrip(["2026-10-10"], "2026-10-13").days.slice(9, 13).map((d) => d.mark[0]).join("");
    expect(m).toBe("dssf"); // 11, 12 covered (pending), 13 = today, not done yet
    const broken = monthStrip(["2026-10-10"], "2026-10-15").days.slice(9, 15).map((d) => d.mark[0]).join("");
    expect(broken).toBe("dmmmmf"); // four missed days cannot be covered by two shields
  });

  it("shields are per calendar month (a gap across the 1st spends each month's own)", () => {
    const d = monthStrip(["2026-09-29", "2026-10-02"], "2026-10-02").days.slice(0, 2).map((x) => x.mark);
    expect(d).toEqual(["shield", "done"]);
    expect(streakFromDates(["2026-09-29", "2026-10-02"]).streak).toBe(2);
  });

  it("february and leap years", () => {
    expect(monthStrip([], "2027-02-10").days).toHaveLength(28);
    expect(monthStrip([], "2028-02-10").days).toHaveLength(29);
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });
});

describe("first session diet", () => {
  it("the tower opens after gentle 8 and not in the first session, unless already visited", () => {
    expect(towerOpen({ cleared: 5, session: 3, visited: false })).toBe(false);
    expect(towerOpen({ cleared: 8, session: 1, visited: false })).toBe(false);
    expect(towerOpen({ cleared: 8, session: 2, visited: false })).toBe(true);
    expect(towerOpen({ cleared: 2, session: 1, visited: true })).toBe(true);
  });
});
