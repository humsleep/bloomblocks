// FUZZ_DAYS (800) consecutive dailies from 2026-10-14: every board is 6×6, has exactly one
// solution, is solvable without case-splitting (T1+T2 only, no contradiction step) with one or
// two T2 steps (round 6: a small "aha"), is solvable by hints from the empty board, and no two
// dates share a board.
// Also the daily number / moon are defined for every date.
import { describe, expect, it } from "vitest";
import { dailyNumber, generatedForDaily, hintFor, isComplete, lanternsPips as G, levelRows, moonPhase } from "../../games/lanterns-pips/index.ts";
import { countSolutions } from "../../games/lanterns-pips/solver.ts";
import { grade } from "../../games/lanterns-pips/deduce.ts";
import { DAILY_T2, dayNumber } from "../../games/lanterns-pips/tracks.ts";
import { DAYS } from "./corpus.ts";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe("dailies", () => {
  it(`${DAYS} consecutive dates: unique, T1+T2 with ${DAILY_T2.lo}–${DAILY_T2.hi} T2 steps, solvable, distinct`, () => {
    const t2s = [0, 0, 0];
    const seen = new Map<string, string>();
    const start = Date.UTC(2026, 9, 14);
    let prevNum = dailyNumber(iso(new Date(start))) - 1;
    for (let k = 0; k < DAYS; k++) {
      const date = iso(new Date(start + k * 86_400_000));
      const g = generatedForDaily(date);
      const { level } = g;
      expect([level.w, level.h]).toEqual([6, 6]);
      const r = countSolutions(level, 2, 2_000_000);
      expect(r.count, `${date}: solutions`).toBe(1);
      expect(r.aborted).toBeFalsy();
      const gr = grade(level, 2);
      expect(gr.solved, `${date}: needs case-splitting`).toBe(true);
      expect(gr.t2, `${date}: T2 steps`).toBeGreaterThanOrEqual(DAILY_T2.lo);
      expect(gr.t2, `${date}: T2 steps`).toBeLessThanOrEqual(DAILY_T2.hi);
      t2s[gr.t2]!++;
      // hint walk from the empty board = a human-reachable solve
      let s = G.init(date, level);
      for (let step = 0; step < 40 && !isComplete(s); step++) {
        const h = hintFor(level, s);
        expect(h.kind, `${date}: hint ${step}`).toBe("place");
        if (h.kind !== "place") break;
        s = G.apply(s, { x: h.cell & 7, y: h.cell >> 3 })!;
      }
      expect(isComplete(s), `${date}: not solved by hints`).toBe(true);
      const key = levelRows(level).join("/");
      expect(seen.get(key), `${date} repeats the board of ${seen.get(key)}`).toBeUndefined();
      seen.set(key, date);
      const n = dailyNumber(date);
      expect(n).toBe(prevNum + 1);
      prevNum = n;
      expect(moonPhase(date)).toBeGreaterThanOrEqual(0);
      expect(moonPhase(date)).toBeLessThan(8);
      const [y, m, d] = date.split("-").map(Number) as [number, number, number];
      expect(dayNumber(y, m, d)).toBe(Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 1)) / 86_400_000));
    }
    expect(seen.size).toBe(DAYS);
    // Both "aha" sizes actually occur (removal stops at the cap, so 2 is the common one).
    expect(t2s[1]).toBeGreaterThan(DAYS / 50);
    expect(t2s[2]).toBeGreaterThan(DAYS / 2);
  });
});
