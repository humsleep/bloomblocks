// Deduce track suite (registered by tracks.test.ts).
import { expect, it } from "vitest";
import { grade } from "../../games/lanterns-pips/deduce.ts";
import { startCells, zerosWithin } from "../../games/lanterns-pips/generator.ts";
import { DEDUCE_START, DEDUCE_T3_FROM, DEDUCE_TAIL_MAX, DEDUCE_ZERO_CAP_TO, DEDUCE_ZERO_MAX_PCT, GENTLE_T2 } from "../../games/lanterns-pips/tracks.ts";
import { percentile } from "../../sim/stats.ts";
import { trackSuite } from "./trackSuite.ts";

// Deduce: 6×6 (1–3 always) → 7×7 → 8×8.
trackSuite({
  track: "deduce",
  uniqueTo: 300,
  hintTo: 200,
  size: (n, w) => (n <= 4 ? w === 6 : n <= 12 ? w === 6 || w === 7 : w === 7 || w === 8),
  median: { lo: 60, hi: 110 },
  extra: (get) => {
    it(`bot tail (~p88) ≤ ${DEDUCE_TAIL_MAX} s on every level 1–300; P90 of level medians (1–100) ≤ 180 s`, { timeout: 300_000 }, () => {
      for (let n = 1; n <= 300; n++) expect(get(n).meta.difficultyTail, `deduce ${n}`).toBeLessThanOrEqual(DEDUCE_TAIL_MAX);
      const meds = Array.from({ length: 100 }, (_, k) => get(k + 1).meta.difficulty).sort((a, b) => a - b);
      expect(percentile(meds, 90)!).toBeLessThanOrEqual(180);
    });

    it(`the start (1–${DEDUCE_T3_FROM - 1}): 6×6, T1+T2, top of the gentle ladder, a forced lantern from a non-zero number at once`, () => {
      expect(DEDUCE_T3_FROM).toBe(4);
      for (let n = 1; n < DEDUCE_T3_FROM; n++) {
        const g = get(n);
        const ctx = `deduce ${n}`;
        expect(g.level.w, ctx).toBe(6);
        expect(g.meta.grade.t3, ctx).toBe(0);
        expect(grade(g.level, 2).solved, ctx).toBe(true);
        expect(startCells(g.level).length, ctx).toBeGreaterThan(0);
        for (const c of startCells(g.level)) expect(g.meta.opening, ctx).toContain(c);
        expect(g.meta.grade.t2, ctx).toBeGreaterThanOrEqual(DEDUCE_START.t2.lo);
        expect(g.meta.grade.t2, ctx).toBeLessThanOrEqual(DEDUCE_START.t2.hi);
        // Continues from the top of the gentle ladder (levels 21–30: band 2).
        expect(DEDUCE_START.t2.lo).toBeGreaterThanOrEqual(GENTLE_T2[2]!.lo);
        expect(g.meta.difficulty, ctx).toBeGreaterThanOrEqual(DEDUCE_START.time.lo - 4);
        expect(g.meta.difficulty, ctx).toBeLessThanOrEqual(DEDUCE_START.time.hi);
      }
      expect(grade(get(DEDUCE_T3_FROM).level, 2).solved).toBe(false);
    });

    it(`0-numbers are at most ${DEDUCE_ZERO_MAX_PCT} % of the numbers on levels 1–${DEDUCE_ZERO_CAP_TO}`, () => {
      for (let n = 1; n <= DEDUCE_ZERO_CAP_TO; n++) {
        const c = get(n).level.clues;
        expect(zerosWithin(c, DEDUCE_ZERO_MAX_PCT), `deduce ${n}: ${c.filter((v) => v === 0).length} zeros`).toBe(true);
      }
    });
  },
});
