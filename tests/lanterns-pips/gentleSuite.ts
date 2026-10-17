// Gentle track suite (registered by tracks.test.ts).
import { expect, it } from "vitest";
import { Rng } from "../../core/rng.ts";
import { pipsBotSeconds } from "../../games/lanterns-pips/generator.ts";
import {
  GENTLE_FINALES, GENTLE_FINALE_REAL_T2, GENTLE_FINALE_SINGLES, GENTLE_FINALE_T2_TOTAL, GENTLE_FINALE_TAIL_MAX, GENTLE_FINALE_ZERO_MAX, GENTLE_MAX_SIZE, GENTLE_RAMP_FROM,
  GENTLE_RAMP_T2_MAX, GENTLE_RAMP_T2_TOTAL_MAX, GENTLE_T2, GENTLE_TAIL_MAX, GENTLE_ZERO_MAX, TRACK_BANDS, beatTarget,
  finaleIndex, gentleT2, isFinale, trackParams, trackSeedKey,
} from "../../games/lanterns-pips/tracks.ts";
import { TRICK_WINDOW, isolatedSingles, trickSignature } from "../../games/lanterns-pips/tricks.ts";
import { realT2 } from "../../games/lanterns-pips/deduce.ts";
import { percentile } from "../../sim/stats.ts";
import { trackSuite } from "./trackSuite.ts";

// Gentle (round 4 J curve): 1–9 5×5/6×6; 11–19 6×6 + a rising share of 7×7; 21+ mostly 7×7;
// finales (every 10th level) 7×7 — round 5: gentle never exceeds 7×7; a finale has strictly the most
// T2 steps of its decade and at most GENTLE_FINALE_SINGLES isolated single cells. Round 6: from
// GENTLE_RAMP_FROM (21) the required T2 steps follow a per-level ramp (gentleT2; r5 "22–35 is flat").

/** Highest T2 requirement among the nine non-finale levels before finale n. */
const decadeT2Max = (n: number): number => Math.max(...Array.from({ length: 9 }, (_, k) => trackParams("gentle", n - 9 + k).t2!.hi));

trackSuite({
  track: "gentle",
  uniqueTo: 300,
  hintTo: 200,
  size: (n, w) =>
    n % 10 === 0 ? w === 7 : n <= 3 ? w === 5 : n < 10 ? w === 5 || w === 6 : w === 6 || w === 7,
  median: { lo: 36, hi: 56 },
  extra: (get) => {
    it("the ladder rises: required T2 steps per band are non-decreasing and band 1 starts above band 0", () => {
      for (let b = 1; b < GENTLE_T2.length; b++) {
        expect(GENTLE_T2[b]!.lo).toBeGreaterThanOrEqual(GENTLE_T2[b - 1]!.lo);
        expect(GENTLE_T2[b]!.hi).toBeGreaterThanOrEqual(GENTLE_T2[b - 1]!.hi);
      }
      expect(GENTLE_T2[1]!.lo).toBeGreaterThan(GENTLE_T2[0]!.hi);
      // Band 1's steady target starts where band 0's peak target ends.
      expect(beatTarget(TRACK_BANDS.gentle[1]!, "steady").lo).toBeGreaterThanOrEqual(beatTarget(TRACK_BANDS.gentle[0]!, "peak").hi);
      for (let f = 1; f < GENTLE_FINALES.length; f++) {
        expect(GENTLE_FINALES[f]!.t2.lo).toBeGreaterThanOrEqual(GENTLE_FINALES[f - 1]!.t2.lo);
        expect(GENTLE_FINALES[f]!.time.lo).toBeGreaterThanOrEqual(GENTLE_FINALES[f - 1]!.time.lo);
      }
      // A finale's T2 floor is above every level of its decade (strictly the most T2 steps).
      for (let n = 10; n <= 400; n += 10) expect(trackParams("gentle", n).t2!.lo, `finale ${n}`).toBeGreaterThan(decadeT2Max(n));
    });

    it("round 7 real-T2 ramp (21+): rises inside decade 2 and decade to decade; 35 asks more than 22; ≤ GENTLE_RAMP_T2_MAX", () => {
      expect(GENTLE_RAMP_FROM).toBe(21);
      for (let n = 1; n < GENTLE_RAMP_FROM; n++) if (!isFinale("gentle", n)) expect(trackParams("gentle", n).t2).toEqual(GENTLE_T2[trackParams("gentle", n).band]);
      for (let n = GENTLE_RAMP_FROM; n <= 400; n++) {
        if (isFinale("gentle", n)) continue;
        const t = trackParams("gentle", n).t2!;
        expect(t, `gentle ${n}`).toEqual(gentleT2(n));
        expect(t.hi - t.lo, `gentle ${n}`).toBe(1);
        expect(t.hi).toBeLessThanOrEqual(GENTLE_RAMP_T2_MAX);
      }
      // r5 played J 22, 30, 35: 35 needs more real T2 steps than 22, the finale above both.
      expect(gentleT2(35).lo).toBeGreaterThanOrEqual(gentleT2(22).lo + 1);
      expect(trackParams("gentle", 30).t2!.lo).toBeGreaterThan(gentleT2(28).hi);
      const mean = (ns: number[]): number => ns.reduce((a, n) => a + gentleT2(n).lo, 0) / ns.length;
      // Decade 2 rises inside (second half above the first); from 31 on the ramp sits at its cap (3–4).
      expect(mean([25, 26, 27, 28])).toBeGreaterThan(mean([21, 22, 23]));
      for (const d of [20, 30]) {
        expect(mean([d + 5, d + 6, d + 7, d + 8])).toBeGreaterThanOrEqual(mean([d + 1, d + 2, d + 3]));
        for (let k = 1; k <= 9; k++) expect(gentleT2(d + 10 + k).lo, `${d + 10 + k} vs ${d + k}`).toBeGreaterThanOrEqual(gentleT2(d + k).lo);
      }
      expect(mean([31, 32, 33, 35, 36, 37, 38])).toBeGreaterThan(mean([21, 22, 23, 25, 26, 27, 28]));
    });

    it("size cap: gentle never exceeds 7×7 (params 1–1000, every finale entry); 8×8 is deduce only", () => {
      expect(GENTLE_MAX_SIZE).toBe(7);
      for (const f of GENTLE_FINALES) expect(f.size).toBeLessThanOrEqual(GENTLE_MAX_SIZE);
      for (let n = 1; n <= 1000; n++) expect(trackParams("gentle", n).w, `gentle ${n}`).toBeLessThanOrEqual(GENTLE_MAX_SIZE);
      // Round 5 changed only the finales (own seed-key version); the other gentle levels keep theirs.
      // Round 6 changed every level from GENTLE_RAMP_FROM (21) on, finales included (g6); 1–20 keep their boards.
      expect(trackSeedKey("gentle", 20)).toBe("lanterns-pips:gentle:g5:20");
      expect(trackSeedKey("gentle", 16)).toBe("lanterns-pips:gentle:g4:16");
      // Round 7: the same range again (g7: real-T2 ramp, 0-rock caps).
      expect(trackSeedKey("gentle", 21)).toBe("lanterns-pips:gentle:g7:21");
      expect(trackSeedKey("gentle", 30)).toBe("lanterns-pips:gentle:g7:30");
    });

    it("required T2 steps sit in the band's range on levels 1–300; level 15 is clearly above level 8", { timeout: 300_000 }, () => {
      for (let n = 1; n <= 300; n++) {
        const g = get(n);
        const p = trackParams("gentle", n);
        // From GENTLE_RAMP_FROM the range counts real T2 steps (not leaning on a 0 rock); totals and 0 rocks are capped.
        const counted = n >= GENTLE_RAMP_FROM ? realT2(g.meta.grade) : g.meta.grade.t2;
        expect(counted, `gentle ${n}`).toBeGreaterThanOrEqual(p.t2!.lo);
        expect(counted, `gentle ${n}`).toBeLessThanOrEqual(p.t2!.hi);
        if (n >= GENTLE_RAMP_FROM) {
          const zeros = g.level.clues.filter((c) => c === 0).length;
          const total = isFinale("gentle", n) ? GENTLE_FINALE_T2_TOTAL : { lo: 0, hi: GENTLE_RAMP_T2_TOTAL_MAX };
          expect(zeros, `gentle ${n} zero rocks`).toBeLessThanOrEqual(isFinale("gentle", n) ? GENTLE_FINALE_ZERO_MAX : GENTLE_ZERO_MAX);
          expect(g.meta.grade.t2, `gentle ${n} total`).toBeGreaterThanOrEqual(total.lo);
          expect(g.meta.grade.t2, `gentle ${n} total`).toBeLessThanOrEqual(total.hi);
          if (isFinale("gentle", n)) expect(realT2(g.meta.grade)).toBeGreaterThanOrEqual(GENTLE_FINALE_REAL_T2.lo);
        }
        // The bounded search never had to relax a constraint on the tested range.
        expect(g.meta.relaxed ?? 0, `gentle ${n} relaxed`).toBe(0);
      }
      const l8 = get(8);
      const l15 = get(15);
      expect(l15.level.w).toBeGreaterThanOrEqual(l8.level.w);
      expect(l15.meta.grade.t2).toBeGreaterThanOrEqual(l8.meta.grade.t2 + 2);
      expect(l15.meta.difficulty).toBeGreaterThan(l8.meta.difficulty);
    });

    it(`finales (10, 20, …, 300): 7×7, T1+T2, strictly the most T2 steps of their decade, ≤ ${GENTLE_FINALE_SINGLES} isolated singles, bot ≤ ${GENTLE_FINALE_TAIL_MAX} s`, { timeout: 300_000 }, () => {
      for (let n = 10; n <= 300; n += 10) {
        expect(isFinale("gentle", n)).toBe(true);
        const g = get(n);
        expect(g.level.w, `gentle ${n}`).toBe(GENTLE_FINALES[finaleIndex(n)]!.size);
        expect(g.level.w, `gentle ${n}`).toBe(7);
        expect(g.meta.grade.t3, `gentle ${n}`).toBe(0);
        expect(g.meta.difficulty, `gentle ${n}`).toBeLessThanOrEqual(110);
        expect(g.meta.difficultyTail, `gentle ${n}`).toBeLessThanOrEqual(GENTLE_FINALE_TAIL_MAX);
        expect(g.meta.grade.t2, `gentle ${n}`).toBeGreaterThan(decadeT2Max(n));
        // Isolated single cells: lone dark squares that must light themselves (J-20 had five).
        const singles = isolatedSingles(g.level);
        expect(g.meta.singles, `gentle ${n}`).toBe(singles.length);
        expect(singles.length, `gentle ${n}`).toBeLessThanOrEqual(GENTLE_FINALE_SINGLES);
        for (let m = n - 9; m < n; m++) {
          const o = get(m);
          expect(o.level.w, `gentle ${m} vs finale ${n}`).toBeLessThanOrEqual(g.level.w);
          expect(o.meta.grade.t2, `gentle ${m} vs finale ${n}`).toBeLessThan(g.meta.grade.t2);
          // Round 7: also strictly the most REAL T2 steps (the ones not leaning on a 0 rock) and no more 0 rocks than the cap.
          if (n >= 30) expect(realT2(o.meta.grade), `gentle ${m} vs finale ${n} (real T2)`).toBeLessThan(realT2(g.meta.grade));
          // Bot time: the peak of its decade on the played range (J 1–40). 7×7 T1+T2 boards top out near
          // 60 s, so from 50 on the finale is the hardest by T2 steps, not necessarily by bot time.
          if (n <= 40) expect(o.meta.difficulty, `gentle ${m} vs finale ${n}`).toBeLessThan(g.meta.difficulty);
        }
        expect(g.meta.difficulty, `finale ${n}`).toBeGreaterThanOrEqual(TRACK_BANDS.gentle[trackParams("gentle", n).band]!.lo);
      }
      for (const n of [1, 9, 11, 15, 29, 31]) expect(isFinale("gentle", n)).toBe(false);
    });

    it("J curve: base boards grow after every finale (1–9 5×5/6×6, 11–19 rising 7×7 share, 21+ mostly 7×7)", () => {
      const sizes = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, k) => get(from + k).level.w);
      const share7 = (xs: number[]): number => xs.filter((w) => w === 7).length;
      expect(sizes(1, 9).every((w) => w === 5 || w === 6)).toBe(true);
      expect(sizes(11, 19).every((w) => w === 6 || w === 7)).toBe(true);
      // 7×7 share rises inside 11–19: 11–14 below 15–19 (as a fraction).
      expect(share7(sizes(11, 14)) * 5).toBeLessThan(share7(sizes(15, 19)) * 4);
      expect(share7(sizes(11, 19))).toBeGreaterThan(0);
      for (let d = 2; d < 30; d++) {
        const xs = sizes(d * 10 + 1, d * 10 + 9);
        expect(share7(xs), `gentle ${d * 10 + 1}–${d * 10 + 9} mostly 7×7`).toBeGreaterThanOrEqual(6);
      }
      // Mean base size per decade never drops.
      let prev = 0;
      for (let d = 0; d < 30; d++) {
        const xs = sizes(d * 10 + 1, d * 10 + 9);
        const sum = xs.reduce((a, b) => a + b, 0);
        expect(sum, `decade ${d}`).toBeGreaterThanOrEqual(prev);
        prev = sum;
      }
    });

    it(`trick rotation: no trick signature repeats within ${TRICK_WINDOW} consecutive levels (1–300)`, { timeout: 300_000 }, () => {
      const sig: string[] = [];
      for (let n = 1; n <= 300; n++) {
        const g = get(n);
        const t = trickSignature(g.level);
        expect(g.meta.trick, `gentle ${n}`).toBe(t.signature);
        // Finales from GENTLE_RAMP_FROM have no bucket: their total T2 (> GENTLE_RAMP_T2_TOTAL_MAX) already differs from every neighbour's.
        if (!(isFinale("gentle", n) && n >= GENTLE_RAMP_FROM)) expect(t.bucket, `gentle ${n}`).toBe(n % TRICK_WINDOW);
        expect(t.kinds.length, `gentle ${n}`).toBe(g.meta.grade.t2);
        for (let m = n - TRICK_WINDOW + 1; m < n; m++) if (m >= 1) expect(sig[m - 1], `gentle ${m} and ${n} share a trick signature`).not.toBe(t.signature);
        sig.push(t.signature);
      }
      // Not trivially distinct: real variety in the first 30.
      expect(new Set(sig.slice(0, 30)).size).toBeGreaterThanOrEqual(15);
    });

    it("bot time: P90 ≤ 110 s on levels 1–40 (40 fresh bot runs each); tail ≤ GENTLE_TAIL_MAX on 1–300", { timeout: 300_000 }, () => {
      for (let n = 1; n <= 40; n++) {
        const g = get(n);
        const s = pipsBotSeconds(g.level, Rng.from(`test:p90:gentle:${n}`), 40, []).sort((a, b) => a - b);
        expect(percentile(s, 90)!, `gentle ${n}`).toBeLessThanOrEqual(110);
      }
      for (let n = 1; n <= 300; n++) expect(get(n).meta.difficultyTail, `gentle ${n}`).toBeLessThanOrEqual(GENTLE_TAIL_MAX);
    });
  },
});
