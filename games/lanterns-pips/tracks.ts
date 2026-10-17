// Two level tracks + the daily for Lanterns-P (pure, integer-only, deterministic).
// Spec: docs/lanterns-pips.md ("Tracks").
//
//   gentle  base boards grow decade by decade (round 4, the J curve): 1–9
//           5×5/6×6, 11–19 6×6 with a rising share of 7×7, 21+ mostly 7×7
//           (6×6 breathers); a "finale" every 10th level (7×7: gentle never
//           exceeds 7×7, 8×8 is deduce only — round 5) is the peak of its decade
//           (size, the most required T2 steps, bot time) with at most
//           GENTLE_FINALE_SINGLES isolated single cells (tricks.ts). Solvable by T1+T2 only (tierCap 2: no contradiction step
//           anywhere), unique, opening never empty, bot tail ≤ GENTLE_TAIL_MAX.
//           Required T2 steps rise with the band (GENTLE_T2) and, from level 21 on
//           (round 6), per level (gentleT2: up inside each decade and decade to
//           decade, ≤ 6); finales have their own rising ladder (GENTLE_FINALES, 7–9
//           from 30 on). No trick signature (tricks.ts) repeats within TRICK_WINDOW
//           consecutive levels. Levels 21+ use the generator's bounded search (PERF-1).
//   deduce  6×6 → 7×7 → 8×8. Levels 1–3: 6×6, T1+T2 only, continuing from the
//           top of the gentle ladder (DEDUCE_START) with a visible start (a
//           non-zero number whose free sides are exactly its count). Needs at
//           least one T3 step from level 4 on; 0-numbers ≤ 40 % of the numbers on
//           levels 1–10; unique, bot tail (~p88) ≤ 180 s.
//   daily   gentle only (Mon–Sat one steady 6×6 band, Sunday the upper gentle
//           band); no weekday ramp. Round 6: exactly 1–2 T2 steps (DAILY_T2), bounded search.
//
// Difficulty: band b = min((n − 1) / 10, last) with lo/hi non-decreasing in b
// (monotone ladder; the tag names the band). Inside a band the level's beat
// (cycle steady, steady, peak, breather, steady; levels 1–2 breathers) picks
// a sub-range, so the ride goes up and down without any level claiming a band
// above its own. Openings: bucket(opening) = n mod 10 (daily: day number mod
// 10), so no two levels within 10 of each other share an opening.

import { parseDate, udiv } from "../lanterns/generator.ts";
import { type Band, PIPS_DENSITY, type PipsGenParams, type PipsGeneratedLevel, generatePips } from "./generator.ts";
import { TRICK_WINDOW } from "./tricks.ts";
import type { PipsLevel } from "./rules.ts";

export type Track = "gentle" | "deduce";
export const TRACKS: readonly Track[] = ["gentle", "deduce"];
export type Beat = "breather" | "steady" | "peak";

/** Deduce track version (part of its seed keys; unchanged since round 3). Gentle: GENTLE_TRACK_VERSION. */
export const TRACK_GENERATOR_VERSION = 3;
/** Gentle track version (part of its seed keys): 4 = round-4 J curve (growing base boards, trick rotation). */
export const GENTLE_TRACK_VERSION = 4;
/**
 * Gentle finale version (seed keys of levels 10, 20, …): 5 = round 5 (7×7 cap,
 * strictly the most T2 steps of the decade, ≤ GENTLE_FINALE_SINGLES isolated
 * single cells). The other gentle levels keep GENTLE_TRACK_VERSION (unchanged output).
 */
export const GENTLE_FINALE_VERSION = 5;
/**
 * Gentle levels from GENTLE_RAMP_FROM on (finales included) — round 6: the per-level T2 ramp
 * (gentleT2: r5 "22–35 is flat") and the bounded search (PERF-1). Levels before it keep
 * GENTLE_TRACK_VERSION / GENTLE_FINALE_VERSION and their exact boards (J-12, J-16, J-20). 6 = round 6,
 * 7 = round 7 (real-T2 ramp, 0-rock caps, finale rules: GENTLE_FINALE_REAL_T2 / _ZERO_MAX / _T2_TOTAL).
 */
export const GENTLE_RAMP_FROM = 21;
export const GENTLE_RAMP_VERSION = 7;
/** Seed-key version per track; bump a track's entry when its output changes. */
export const TRACK_VERSIONS: Readonly<Record<Track, number>> = { gentle: GENTLE_TRACK_VERSION, deduce: TRACK_GENERATOR_VERSION };
/** Bump when daily output changes (part of the daily seed keys). 3 = round 6: 1–2 T2 steps (a small "aha"), bounded search. */
export const DAILY_GENERATOR_VERSION = 3;

/** Window (in levels / days) inside which no opening repeats. */
export const OPENING_WINDOW = 10;

export const BEAT_CYCLE: readonly Beat[] = ["steady", "steady", "peak", "breather", "steady"];

/** Band ladders (human-like bot median, seconds); lo and hi are non-decreasing. */
export const TRACK_BANDS: Readonly<Record<Track, readonly Band[]>> = {
  gentle: [
    { lo: 24, hi: 36 },
    { lo: 36, hi: 52 },
    { lo: 40, hi: 56 },
    { lo: 42, hi: 58 },
    { lo: 44, hi: 60 },
  ],
  deduce: [
    { lo: 36, hi: 80 },
    { lo: 54, hi: 90 },
    { lo: 60, hi: 98 },
    { lo: 64, hi: 104 },
    { lo: 66, hi: 106 },
  ],
};

/** Gentle: required T2 steps (grade.t2) per band, non-decreasing in lo and hi. */
export const GENTLE_T2: readonly Band[] = [
  { lo: 0, hi: 1 },
  { lo: 2, hi: 3 },
  { lo: 3, hi: 4 },
  { lo: 4, hi: 5 },
  { lo: 4, hi: 6 },
];

/**
 * Gentle finales (n ≡ 0 mod 10), T1+T2 only; k-th finale uses entry
 * min(n / 10 − 1, last). Board `size` (7: gentle never exceeds 7×7), bot median
 * target `time`, required T2 steps `t2`; time.lo ≥ its band's hi and t2.lo > its
 * band's T2 hi (strictly the most T2 steps of its decade); the tail is capped at
 * GENTLE_FINALE_TAIL_MAX; at most GENTLE_FINALE_SINGLES isolated single cells.
 */
const GENTLE_FINALE_T2_TOTAL_ROW: Band = { lo: 6, hi: 10 };
export const GENTLE_FINALES: readonly { readonly time: Band; readonly t2: Band; readonly size: number }[] = [
  { time: { lo: 44, hi: 64 }, t2: { lo: 4, hi: 6 }, size: 7 },
  { time: { lo: 54, hi: 70 }, t2: { lo: 5, hi: 7 }, size: 7 },
  // From GENTLE_RAMP_FROM (30, 40, 50+) round 7: t2 = the TOTAL T2 range (GENTLE_FINALE_T2_TOTAL); the floor that
  // matters is real T2 ≥ GENTLE_FINALE_REAL_T2.lo (trackParams uses it as `t2`), ≤ GENTLE_FINALE_ZERO_MAX zeros.
  { time: { lo: 56, hi: 76 }, t2: GENTLE_FINALE_T2_TOTAL_ROW, size: 7 },
  { time: { lo: 58, hi: 80 }, t2: GENTLE_FINALE_T2_TOTAL_ROW, size: 7 },
  { time: { lo: 58, hi: 84 }, t2: GENTLE_FINALE_T2_TOTAL_ROW, size: 7 },
];
/** Largest gentle board (round 5: 8×8 only in deduce). */
export const GENTLE_MAX_SIZE = 7;
/** Size of every gentle finale (kept for compatibility; = GENTLE_MAX_SIZE). */
export const GENTLE_FINALE_SIZE = 7;
/**
 * Gentle finales: at most this many isolated single cells (tricks.ts
 * isolatedSingles — self-light T2 steps: a lone dark square that must light
 * itself). J-20 (round 4) had five and testers called it tidying, not thinking.
 */
export const GENTLE_FINALE_SINGLES = 2;
export const GENTLE_FINALE_TAIL_MAX = 110;
/** Gentle: bot tail (~p88) cap on every level (seconds); P90 stays ≤ 120 s (tested). */
export const GENTLE_TAIL_MAX = 110;
/** Gentle levels 11–19 with a 7×7 board (n mod 10): one in 11–14, three in 15–19. */
export const GENTLE_SECOND_DECADE_7: readonly number[] = [3, 6, 7, 8];

/** Gentle: random full solutions drawn per layout, the most-lantern one kept (longer, not deeper). */
export const GENTLE_SOLUTION_PICKS = 8;
/** Gentle finales: more draws (7×7 cap — length has to come from lanterns and T2 steps, not size). */
export const GENTLE_FINALE_SOLUTION_PICKS = 8;

/** Deduce: per-level bot tail cap (seconds). */
export const DEDUCE_TAIL_MAX = 180;
/** Deduce: first level that must need a T3 step (levels before it are T1+T2 only). */
export const DEDUCE_T3_FROM = 4;
/** Deduce levels 1..DEDUCE_T3_FROM−1: 6×6, T1+T2, the top of the gentle ladder, a visible start. */
export const DEDUCE_START: { readonly time: Band; readonly t2: Band } = { time: { lo: 38, hi: 48 }, t2: { lo: 3, hi: 5 } };
/** Generation attempts per track level (scored candidates; an in-band candidate stops early). */
export const TRACK_ATTEMPTS = 400;
/** Generation attempts for the constrained levels (deduce start). */
export const CONSTRAINED_ATTEMPTS = 600;
/** Gentle generation attempts (cheap T1+T2 boards; the trick rotation rejects ~4 in 5 candidates). */
export const GENTLE_ATTEMPTS = 1600;
/** Gentle finale generation attempts (levels before GENTLE_RAMP_FROM). */
export const GENTLE_FINALE_ATTEMPTS = 4000;
/**
 * Round 6 bounded search (generator PipsSearch) for gentle levels from GENTLE_RAMP_FROM on and for
 * dailies: attempts per relaxation window × 4 (hard cap 2 × attempts), scored candidates kept.
 */
export const GENTLE_SEARCH_ATTEMPTS = 3000;
export const GENTLE_SEARCH_SCORED = 8;
/** Round 7: attempts allowed after the first candidate (for the bot band), so a long strict search stays bounded. */
export const GENTLE_SEARCH_AFTER_FOUND = 600;
/** Round 7 finales: more scored candidates / attempts after the first one, so the finale also tops its decade by bot time (J 1–40). */
export const GENTLE_FINALE_SEARCH_SCORED = 24;
export const GENTLE_FINALE_AFTER_FOUND = 2000;
/**
 * Finales from GENTLE_RAMP_FROM: T2 ≥ 7 on 7×7 together with the opening, trick and singles rules is
 * rarer — a longer window (1000 strict attempts), 16 solution draws and a denser layout (22–32 % stones:
 * more short runs → more lanterns and more T2 spots; measured ~3× fewer attempts than 18–28 %).
 */
export const GENTLE_FINALE_SEARCH_ATTEMPTS = 6000;
export const GENTLE_FINALE_SEARCH_PICKS = 16;
/** Round 7: 25–34 % (with the 0 cap and the real-T2 floor; 22–32 % needed ~1.5× the attempts). */
export const GENTLE_FINALE_DENSITY: Band = { lo: 25, hi: 34 };
export const DAILY_SEARCH_ATTEMPTS = 400;
export const DAILY_SEARCH_SCORED = 8;
/**
 * Sunday dailies: with at most 2 T2 steps the time has to come from lanterns — more solution draws
 * and more scored candidates (measured on the 2026-11..2028-12 Sundays: 39 % → 93 % in band).
 */
export const DAILY_SUNDAY_PICKS = 32;
/** Daily: required T2 steps — one or two small "aha" moments on a rest-sized 6×6 (r5 compromise). */
export const DAILY_T2: Band = { lo: 1, hi: 2 };
/** Deduce: 0-numbers at most this percent of the numbered stones on levels 1..DEDUCE_ZERO_CAP_TO. */
export const DEDUCE_ZERO_MAX_PCT = 40;
export const DEDUCE_ZERO_CAP_TO = 10;

const DENSITY_7 = { lo: 18, hi: 28 };
const DENSITY_8 = { lo: 18, hi: 28 };

export function bandIndex(track: Track, n: number): number {
  const last = TRACK_BANDS[track].length - 1;
  const b = udiv(n - 1, 10);
  return b < last ? b : last;
}

/** Beat of level n; deduce levels before DEDUCE_T3_FROM (the T1+T2 start) are breathers. */
export function beatFor(n: number, track: Track = "gentle"): Beat {
  if (track === "deduce" && n < DEDUCE_T3_FROM) return "breather";
  return n <= 2 ? "breather" : BEAT_CYCLE[(n - 1) % 5]!;
}

/** Gentle finale: every 10th level (10, 20, 30, …). */
export function isFinale(track: Track, n: number): boolean {
  return track === "gentle" && n >= 10 && n % 10 === 0;
}

/** Finale ladder entry for gentle level n (n ≡ 0 mod 10). */
export function finaleIndex(n: number): number {
  const k = udiv(n, 10) - 1;
  return k < GENTLE_FINALES.length - 1 ? k : GENTLE_FINALES.length - 1;
}

/** Sub-range of a band for a beat: breather lower half, steady middle half, peak upper half. */
/** Most REAL T2 steps (deduce.ts realT2) any non-finale gentle level asks for (round 7); finales start above it. */
export const GENTLE_RAMP_T2_MAX = 4;
/**
 * Round 7: TOTAL T2 steps (0-leaning ones included) of a non-finale level from GENTLE_RAMP_FROM are at
 * most this; a finale has at least GENTLE_FINALE_T2_TOTAL.lo > it. So a finale's trick signature (one kind
 * per T2 step) can never equal a non-finale's, and finales need no trick bucket of their own.
 */
export const GENTLE_RAMP_T2_TOTAL_MAX = 5;
/** Round 7 (r6 "0 rocks make it easy"): 0 rocks on gentle levels from GENTLE_RAMP_FROM (finales / others). */
export const GENTLE_FINALE_ZERO_MAX = 2;
export const GENTLE_ZERO_MAX = 3;

/**
 * Gentle REAL-T2 ramp (round 7; round 6 counted every T2 step): levels from GENTLE_RAMP_FROM, finales
 * excluded. Counts realT2 = T2 steps that do not lean on a 0 rock (deduce.ts). Required steps rise
 * inside each decade and from decade to decade. lo = base + (second half of the decade, n mod 10 ≥ 5)
 * + (peak beat), except a breather (6×6 dip) stays at the base; hi = min(lo + 1, GENTLE_RAMP_T2_MAX),
 * lo ≤ hi − 1; base 2 for 21–29, 3 from 31 on.
 *   21 22 → 2–3, 23 → 3–4, 24 (6×6) → 2–3, 25–28 → 3–4, 29 (6×6) → 2–3, 30 finale ≥ 5
 *   31–39 → 3–4, 40 finale ≥ 5 (same from 41 on)
 * Measured (r6 boards): a 7×7 T1+T2 board rarely has more than 5 real T2 steps with ≤ 2 isolated
 * singles and ≤ 2 zeros, so the ramp stops at 4 and every finale (≥ 5) stays strictly above its decade.
 */
export function gentleT2(n: number): Band {
  const beat = beatFor(n);
  const base = n <= 30 ? 2 : 3;
  const want = beat === "breather" ? base : base + (n % 10 >= 5 ? 1 : 0) + (beat === "peak" ? 1 : 0);
  const hi = want + 1 < GENTLE_RAMP_T2_MAX ? want + 1 : GENTLE_RAMP_T2_MAX;
  return { lo: want < hi - 1 ? want : hi - 1, hi };
}

/** Round 7 finales (from GENTLE_RAMP_FROM): real T2 floor (above the ramp) and total T2 range. */
export const GENTLE_FINALE_REAL_T2: Band = { lo: 5, hi: 9 };
export const GENTLE_FINALE_T2_TOTAL: Band = GENTLE_FINALE_T2_TOTAL_ROW;

export function beatTarget(band: Band, beat: Beat): Band {
  const span = band.hi - band.lo;
  if (beat === "breather") return { lo: band.lo, hi: band.lo + (span >>> 1) };
  if (beat === "peak") return { lo: band.lo + (span >>> 1), hi: band.hi };
  return { lo: band.lo + (span >>> 2), hi: band.hi - (span >>> 2) };
}

export function trackSize(track: Track, n: number): number {
  const beat = beatFor(n, track);
  if (track === "gentle") {
    if (isFinale(track, n)) return GENTLE_FINALES[finaleIndex(n)]!.size;
    if (n <= 3) return 5;
    if (n < 10) return beat === "breather" ? 5 : 6;
    if (n < 20) return GENTLE_SECOND_DECADE_7.includes(n % 10) ? 7 : 6;
    return beat === "breather" ? 6 : 7;
  }
  if (n <= 4) return 6;
  if (n <= 12) return beat === "breather" ? 6 : 7;
  if (n <= 30) return beat === "peak" ? 8 : 7;
  return beat === "breather" ? 7 : 8;
}

function densityFor(size: number): Band {
  return size === 7 ? DENSITY_7 : size === 8 ? DENSITY_8 : PIPS_DENSITY[size]!;
}

/** 5×5 boards top out near 36 s (bot): keep their target reachable (it only ever moves down, inside the band). */
export const SIZE5_TARGET_MAX = 36;

export function clampForSize(size: number, t: Band): Band {
  if (size !== 5 || t.hi <= SIZE5_TARGET_MAX) return t;
  const lo = t.lo < SIZE5_TARGET_MAX - 8 ? t.lo : SIZE5_TARGET_MAX - 8;
  return { lo, hi: SIZE5_TARGET_MAX };
}

export function trackSeedKey(track: Track, n: number): string {
  const v = track === "gentle" && n >= GENTLE_RAMP_FROM ? GENTLE_RAMP_VERSION : isFinale(track, n) ? GENTLE_FINALE_VERSION : TRACK_VERSIONS[track];
  return `lanterns-pips:${track}:g${v}:${n}`;
}

export interface TrackParams extends PipsGenParams {
  readonly band: number;
  readonly beat: Beat;
  /** Gentle 7×7 finale (every 10th level); tag `b<band>-finale`, own target ladder. */
  readonly finale?: boolean;
}

export function trackParams(track: Track, n: number): TrackParams {
  if (track !== "gentle" && track !== "deduce") throw new RangeError(`unknown track ${String(track)}`);
  if (!Number.isInteger(n) || n < 1 || n > 0xefffffff) throw new RangeError(`level index ${n} out of range`);
  const band = bandIndex(track, n);
  const beat = beatFor(n, track);
  const size = trackSize(track, n);
  const d = densityFor(size);
  const gentle = track === "gentle";
  const opening = { mod: OPENING_WINDOW, want: n % OPENING_WINDOW, nonEmpty: gentle };
  const trick = { mod: TRICK_WINDOW, want: n % TRICK_WINDOW };
  const base = { seedKey: trackSeedKey(track, n), levelId: n, w: size, h: size, densityMin: d.lo, densityMax: d.hi, symmetry: "any" as const, maxAttempts: TRACK_ATTEMPTS };
  const ramp = gentle && n >= GENTLE_RAMP_FROM;
  const finale = gentle && isFinale(track, n);
  const search = ramp
    ? {
      search: {
        score: "sumNoZero" as const, bigFirst: true, realT2: true,
        scoredMax: finale ? GENTLE_FINALE_SEARCH_SCORED : GENTLE_SEARCH_SCORED, afterFound: finale ? GENTLE_FINALE_AFTER_FOUND : GENTLE_SEARCH_AFTER_FOUND,
        zeroMax: finale ? GENTLE_FINALE_ZERO_MAX : GENTLE_ZERO_MAX, t2Total: finale ? GENTLE_FINALE_T2_TOTAL : { lo: 0, hi: GENTLE_RAMP_T2_TOTAL_MAX },
      },
    }
    : {};
  if (finale) {
    const f = GENTLE_FINALES[finaleIndex(n)]!;
    return {
      ...base, ...search, ...(ramp ? { densityMin: GENTLE_FINALE_DENSITY.lo, densityMax: GENTLE_FINALE_DENSITY.hi } : {}),
      maxAttempts: ramp ? GENTLE_FINALE_SEARCH_ATTEMPTS : GENTLE_FINALE_ATTEMPTS, tierCap: 2, target: f.time, t2: ramp ? GENTLE_FINALE_REAL_T2 : f.t2, tailMax: GENTLE_FINALE_TAIL_MAX,
      solutionPicks: ramp ? GENTLE_FINALE_SEARCH_PICKS : GENTLE_FINALE_SOLUTION_PICKS,
      // Round 7: finales from GENTLE_RAMP_FROM need no trick bucket (their total T2 > any non-finale's, see GENTLE_RAMP_T2_TOTAL_MAX).
      isolatedMax: GENTLE_FINALE_SINGLES, tag: `b${band}-finale`, band, beat: "peak", finale: true, opening, ...(ramp ? {} : { trick }),
    };
  }
  if (gentle) {
    return {
      ...base, ...search, maxAttempts: ramp ? GENTLE_SEARCH_ATTEMPTS : GENTLE_ATTEMPTS, tierCap: 2, target: clampForSize(size, beatTarget(TRACK_BANDS.gentle[band]!, beat)),
      t2: ramp ? gentleT2(n) : GENTLE_T2[band]!, tailMax: GENTLE_TAIL_MAX,
      solutionPicks: GENTLE_SOLUTION_PICKS, tag: `b${band}-${beat}`, band, beat, opening, trick,
    };
  }
  const zeros = n <= DEDUCE_ZERO_CAP_TO ? { zeroMaxPct: DEDUCE_ZERO_MAX_PCT } : {};
  if (n < DEDUCE_T3_FROM) {
    // The start: the top of the gentle ladder (T1+T2 on 6×6) with a visible first lantern.
    return {
      ...base, maxAttempts: CONSTRAINED_ATTEMPTS, tierCap: 2, target: DEDUCE_START.time, t2: DEDUCE_START.t2, tailMax: DEDUCE_TAIL_MAX, startVisible: true, ...zeros,
      tag: `b${band}-${beat}`, band, beat, opening,
    };
  }
  return {
    ...base, tierCap: 3, target: beatTarget(TRACK_BANDS.deduce[band]!, beat), tailMax: DEDUCE_TAIL_MAX, requireT3: true, ...zeros,
    tag: `b${band}-${beat}`, band, beat, opening,
  };
}

// ---------------------------------------------------------------- daily

/** Days since 2000-01-01 (proleptic Gregorian, integer). */
export function dayNumber(y: number, m: number, d: number): number {
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const leapsUpTo = (yr: number): number => udiv(yr, 4) - udiv(yr, 100) + udiv(yr, 400);
  // Leap years in 2000..y-1.
  const leaps = leapsUpTo(y - 1) - leapsUpTo(1999);
  return (y - 2000) * 365 + leaps + cum[m - 1]! + (leap && m > 2 ? 1 : 0) + d - 1;
}

/** 0 = Sunday … 6 = Saturday (2000-01-01 was a Saturday). */
export function weekdayOf(day: number): number {
  return (day + 6) % 7;
}

/** Daily bands: Mon–Sat one steady gentle 6×6 band; Sunday the upper gentle band. */
export const DAILY_BANDS: Readonly<Record<"week" | "sunday", Band>> = {
  week: { lo: 36, hi: 46 },
  sunday: { lo: 42, hi: 50 },
};

export function dailyParams(dateISO: string): TrackParams {
  const { y, m, d } = parseDate(dateISO);
  const day = dayNumber(y, m, d);
  const sunday = weekdayOf(day) === 0;
  const dens = PIPS_DENSITY[6]!;
  return {
    seedKey: `lanterns-pips:daily:g${DAILY_GENERATOR_VERSION}:${dateISO}`, levelId: y * 10000 + m * 100 + d, w: 6, h: 6,
    densityMin: dens.lo, densityMax: dens.hi, symmetry: "any", tierCap: 2, target: sunday ? DAILY_BANDS.sunday : DAILY_BANDS.week,
    maxAttempts: DAILY_SEARCH_ATTEMPTS, solutionPicks: sunday ? DAILY_SUNDAY_PICKS : GENTLE_SOLUTION_PICKS, t2: DAILY_T2,
    search: { score: "lanterns", bigFirst: false, scoredMax: sunday ? DAILY_SUNDAY_PICKS : DAILY_SEARCH_SCORED }, tag: sunday ? "daily-sunday" : "daily", band: sunday ? 3 : 2, beat: sunday ? "peak" : "steady",
    opening: { mod: OPENING_WINDOW, want: day % OPENING_WINDOW, nonEmpty: true },
  };
}

// ---------------------------------------------------------------- cached entry points

const CACHE_MAX = 64;
const cache = new Map<string, PipsGeneratedLevel>();

function cached(key: string, make: () => PipsGeneratedLevel): PipsGeneratedLevel {
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const g = make();
  cache.set(key, g);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return g;
}

/** Level n (1-based) of a track, with generator metadata (solution, grade, opening, bot times). */
export function generatedForTrack(track: Track, n: number): PipsGeneratedLevel {
  const p = trackParams(track, n);
  return cached(p.seedKey, () => generatePips(p));
}

/** Daily level (always gentle) with generator metadata. */
export function generatedForDaily(dateISO: string): PipsGeneratedLevel {
  const p = dailyParams(dateISO);
  return cached(p.seedKey, () => generatePips(p));
}

export function levelForTrack(track: Track, n: number): PipsLevel {
  return generatedForTrack(track, n).level;
}

export function levelForDaily(dateISO: string): PipsLevel {
  return generatedForDaily(dateISO).level;
}
