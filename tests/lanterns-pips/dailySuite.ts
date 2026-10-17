// Daily suite (registered by tracks.test.ts).
import { describe, expect, it } from "vitest";
import { weekday } from "../../games/lanterns/generator.ts";
import { grade, openingCells } from "../../games/lanterns-pips/deduce.ts";
import { UNIQUE_GATE_NODES, openingBucket } from "../../games/lanterns-pips/generator.ts";
import * as P from "../../games/lanterns-pips/index.ts";
import { countSolutions } from "../../games/lanterns-pips/solver.ts";
import { DAILY_BANDS, DAILY_T2, OPENING_WINDOW, dailyParams, dayNumber, weekdayOf } from "../../games/lanterns-pips/tracks.ts";
import { rowsOf } from "./trackSuite.ts";

const DAYS = 120;
const START = Date.UTC(2026, 9, 13); // 2026-10-13 (test-side date math only)
const dateAt = (k: number): string => new Date(START + k * 86_400_000).toISOString().slice(0, 10);

describe("lanterns-pips daily", () => {
  it("dayNumber / weekday agree with the calendar", () => {
    expect(dayNumber(2000, 1, 1)).toBe(0);
    expect(dayNumber(2026, 10, 13)).toBe(9782);
    for (let k = 0; k < 800; k++) {
      const d = dateAt(k * 7 + (k % 7));
      const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
      expect(dayNumber(y, m, dd)).toBe(dayNumber(2026, 10, 13) + k * 7 + (k % 7));
      expect(weekdayOf(dayNumber(y, m, dd))).toBe(weekday(y, m, dd));
    }
  });

  it(`uniqueness gate: ${DAYS} consecutive dailies are unique, gentle (T1+T2), 6×6, deterministic`, { timeout: 300_000 }, () => {
    const openings: string[] = [];
    for (let k = 0; k < DAYS; k++) {
      const date = dateAt(k);
      const g = P.generatedForDaily(date);
      const ctx = `${date}\n${rowsOf(g.level)}`;
      const res = countSolutions(g.level, 2, UNIQUE_GATE_NODES);
      expect(res.aborted, ctx).toBe(false);
      expect(res.count, ctx).toBe(1);
      expect(P.bbEqual(res.solution, g.meta.solution), ctx).toBe(true);
      const gr = grade(g.level, 2);
      expect(gr.solved, ctx).toBe(true);
      // Round 6: one or two T2 steps (a small "aha"), never a contradiction step.
      expect(gr.t2, ctx).toBeGreaterThanOrEqual(DAILY_T2.lo);
      expect(gr.t2, ctx).toBeLessThanOrEqual(DAILY_T2.hi);
      expect(g.meta.grade.t3, ctx).toBe(0);
      expect(g.meta.relaxed ?? 0, ctx).toBe(0);
      expect(g.level.w, ctx).toBe(6);
      const p = dailyParams(date);
      const [y, m, d] = date.split("-").map(Number) as [number, number, number];
      const sunday = weekday(y, m, d) === 0;
      expect(p.target).toEqual(sunday ? DAILY_BANDS.sunday : DAILY_BANDS.week);
      expect(p.tierCap).toBe(2);
      expect(p.t2).toEqual({ lo: 1, hi: 2 });
      expect(p.seedKey).toBe(`lanterns-pips:daily:g3:${date}`);
      // Openings: non-empty, bucket = day number mod 10 → no repeat within 10 days.
      expect(g.meta.opening).toEqual(openingCells(g.level));
      expect(g.meta.opening.length, ctx).toBeGreaterThan(0);
      expect(openingBucket(g.meta.opening, OPENING_WINDOW)).toBe(dayNumber(y, m, d) % OPENING_WINDOW);
      const key = JSON.stringify(g.meta.opening);
      expect(openings.slice(-(OPENING_WINDOW - 1)), `${date} repeats an opening`).not.toContain(key);
      openings.push(key);
      if (k % 30 === 0) expect(P.levelRows(P.levelForDaily(date))).toEqual(P.levelRows(g.level));
    }
  });

  it("rejects malformed dates", () => {
    expect(() => P.levelForDaily("2026-13-01")).toThrow();
    expect(() => P.levelForDaily("20261013")).toThrow();
  });
});
