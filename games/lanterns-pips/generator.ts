// Seeded Lanterns-P level generator. Pure, integer-only, deterministic: the
// same seed key yields the same level everywhere. Spec: docs/lanterns-pips.md.
//
// generate(params):
//   rng = Rng.from(seedKey)
//   repeat (attempt = 0..):
//     stones   seeded layout (density band, optional rot180/mirror symmetry)
//     reject   disconnected floor, isolated floor cell, open room (as lanterns)
//     solution a random valid full solution: while a floor cell is dark, take
//              a random dark cell and put a lantern on a random still-dark
//              cell of its row/column runs (never a conflict); with
//              solutionPicks k > 1, the most-lantern one of k draws
//     clues    every stone gets its number (adjacent lanterns of that solution)
//     reject   not tier-solvable with all numbers (the exact counter classifies why)
//     remove   numbers in random order; a removal sticks iff the level stays
//              tier-solvable (⇒ UNIQUE: every tier rule is sound) within the tag's tier cap
//              (intro/easy: T1–T2, others: T1–T3)
//     score    tier grade + human-like bot runs (deduce.ts), estimated seconds
//   gate     exact uniqueness re-checked on the final numbers (larger node cap);
//            a board that is not provably unique is never returned
//   track    (optional, track/daily levels) t2 {lo, hi}: a removal also needs
//            grade.t2 ≤ hi, and a final board with t2 outside [lo, hi] is rejected;
//            zeroMaxPct: 0-numbers go first in the removal order, reject if more
//            than that percent of the numbers are 0; startVisible: reject unless
//            some non-zero number's floor sides are exactly its count;
//            requireT3: reject if T1–T2 solve it; isolatedMax: a presented
//            board may have at most that many isolated single cells (tricks.ts);
//            opening: present the board under the first dihedral transform
//            (0..7) whose opening bucket (FNV-1a of the opening cells mod `mod`)
//            equals `want`, else reject — consecutive levels get distinct buckets,
//            so no opening repeats inside a window of `mod` levels
//   accept   median inside the band (and tail ≤ tailMax); otherwise keep the closest
//   after maxAttempts the closest candidate is returned (meta.inBand = false).
//   search   (optional, round 6 — PERF-1; see PipsSearch) solution draws ranked to favour T2
//            steps, larger numbers removed first, the presented transform's own T2 count in
//            range, at most scoredMax scored candidates, staged relaxation while nothing is
//            found, hard cap 2 × maxAttempts. Without it the older streams are unchanged.
// Round 6 dropped the exact counter from the removal loop and the all-numbers check: tier-solvable
// ⇒ unique, so the counter could only differ by aborting (T1+T2 boards: its propagation never
// branches; T3 boards: far below the cap) — older streams' outputs are identical (deduce 1–200 and
// the legacy canary checked), generation ~2× faster.

import { fnv1a32 } from "../../core/hash.ts";
import { Rng } from "../../core/rng.ts";
import { udiv } from "../lanterns/generator.ts";
import { type Rays, buildRays, low32, pop32 } from "../lanterns/solver.ts";
import { type Grade, grade, hasOpening, openingCells, pipsHumanSolve, pipsTraceSeconds } from "./deduce.ts";
import { type BB, EMPTY, NO_CLUE, type PipsLevel, index, neighbours, validateLevel } from "./rules.ts";
import { type PipsModel, buildModel, countSolutions } from "./solver.ts";
import { isolatedSingles, trickSignature } from "./tricks.ts";

/** Version of the legacy free stream (pipsLevelForIndex). Track/daily streams: TRACK_GENERATOR_VERSION in tracks.ts. */
export const PIPS_GENERATOR_VERSION = 1;

export type Symmetry = "none" | "rot180" | "mirror";

export interface Band {
  readonly lo: number;
  readonly hi: number;
}

export interface PipsGenParams {
  readonly seedKey: string;
  readonly levelId: number;
  readonly w: number;
  readonly h: number;
  /** Stone density range, percent of all cells (inclusive). */
  readonly densityMin: number;
  readonly densityMax: number;
  readonly symmetry: Symmetry | "any";
  /** Highest deduction tier a removal may require (2 or 3). */
  readonly tierCap: number;
  readonly target: Band;
  readonly maxAttempts: number;
  readonly tag: string;
  /** Reject boards that T1–T2 alone solve (the level must need a T3 step). */
  readonly requireT3?: boolean;
  /** Bot tail (~p88) cap in seconds; the excess counts as band distance. */
  readonly tailMax?: number;
  /** Draw this many random full solutions and keep the one with the most lanterns (default 1). */
  readonly solutionPicks?: number;
  /** Opening rotation (see header). nonEmpty: the opening must hold at least one cell. */
  readonly opening?: { readonly mod: number; readonly want: number; readonly nonEmpty: boolean };
  /** Required T2 steps (grade.t2 of the final board): a removal sticks only while t2 ≤ max; below min → reject. */
  readonly t2?: Band;
  /** At most this percent of the numbered stones may be 0 (0-numbers are tried first in the removal order). */
  readonly zeroMaxPct?: number;
  /** The empty board must show a forced lantern: some non-zero number whose floor sides are exactly its count. */
  readonly startVisible?: boolean;
  /**
   * Trick rotation (tricks.ts): the presented board's trick-signature bucket must equal `want`
   * (chosen jointly with the opening transform), else reject — no signature repeats within `mod` levels.
   */
  readonly trick?: { readonly mod: number; readonly want: number };
  /** At most this many isolated single cells (tricks.ts isolatedSingles: solution lanterns lighting only their own square), else reject. */
  readonly isolatedMax?: number;
  /** Bounded search (round 6, PERF-1); absent = the older streams' exact behaviour. See PipsSearch. */
  readonly search?: PipsSearch;
}

/**
 * Bounded search (round 6, PERF-1). Opt-in so that older streams keep their output.
 *   score         rank the solutionPicks draws by 'lanterns' (most lanterns), 'free' (most
 *                 stone-free lanterns — no number can place them, each is a T2 step — then most
 *                 lanterns) or 'sum' (lanterns + stone-free lanterns, then lanterns); the first
 *                 draw whose full numbers are tier-solvable within the t2 cap is used
 *   bigFirst      removal tries larger numbers first (they place lanterns by T1)
 *   scoredMax     stop after this many scored candidates (bot runs), keeping the closest
 * Always on the search path: the presented transform must itself have its T2 count in
 * [t2.lo, t2.hi] (tierCap 2), and while no candidate exists the constraints relax in
 * stages every maxAttempts / 4 attempts (relaxStage), least visible first: 1 no trick bucket (a no-op, reported as 0, without one),
 * 2 + any opening bucket, 3 + t2.lo − 1, 4 + no t2 floor / opening / singles limit.
 * Hard cap 2 × maxAttempts attempts (never unbounded). meta.relaxed = the stage of the result.
 */
export interface PipsSearch {
  readonly score: "lanterns" | "free" | "sum" | "sumNoZero";
  readonly bigFirst: boolean;
  readonly scoredMax: number;
  /**
   * Round 7 (r6 "zero rocks make finales easy"): at most this many 0 rocks on the presented board
   * (0-numbers are tried first in the removal order, then larger numbers first), else reject
   * (reason `zeros`). Relaxed only at the last stage.
   */
  readonly zeroMax?: number;
  /** Round 7: the t2 range (removal cap, floor, transform check) counts realT2 = T2 steps that do not lean on a 0 rock (deduce.ts Grade.t2zero). */
  readonly realT2?: boolean;
  /** Round 7: once a candidate exists, search at most this many more attempts (default: up to maxAttempts). */
  readonly afterFound?: number;
  /** Round 7: removal orders tried per layout (see generatePips); default 1. */
  readonly orders?: number;
  /**
   * Round 7: a range on the TOTAL T2 count (grade.t2, 0-leaning steps included) on top of `t2`
   * (which then counts realT2): the removal cap and the floor apply to both.
   */
  readonly t2Total?: Band;
}

export const PIPS_REJECT_REASONS = [
  "disconnected", "isolated", "openRoom", "notUnique", "tooDeep", "solverLimit", "tooShallow", "opening", "t2Range", "zeros", "noStart", "trick", "singles",
] as const;
export type PipsRejectReason = (typeof PIPS_REJECT_REASONS)[number];

export interface PipsGenMeta {
  /** The unique solution. */
  readonly solution: BB;
  readonly lanterns: number;
  readonly stones: number;
  /** Numbered stones left after removal. */
  readonly clues: number;
  /** Tier grade (deterministic tier solver). */
  readonly grade: Grade;
  /** Human-like bot estimated seconds: ~p20 / median / ~p88. */
  readonly difficultyFast: number;
  readonly difficulty: number;
  readonly difficultyTail: number;
  readonly inBand: boolean;
  readonly attempts: number;
  readonly rejected: Readonly<Record<PipsRejectReason, number>>;
  readonly symmetry: Symmetry;
  /** T1-forced lanterns from the empty board (openingCells), as presented. */
  readonly opening: readonly number[];
  /** Dihedral transform applied to the generated board (0 = none). */
  readonly transform: number;
  /** Trick signature of the presented board (tricks.ts; "" = no T2 step). */
  readonly trick: string;
  /** Isolated single cells of the presented board (tricks.ts isolatedSingles: self-light T2 steps). */
  readonly singles: number;
  /** Search path only: relaxation stage of the returned board (0 = every constraint held). */
  readonly relaxed?: number;
}

export interface PipsGeneratedLevel {
  readonly seedKey: string;
  readonly levelId: number;
  readonly tag: string;
  readonly level: PipsLevel;
  readonly meta: PipsGenMeta;
}

export const PIPS_SCREEN_RUNS = 8;
export const PIPS_CONFIRM_RUNS = 24;
export const PIPS_GIVE_UP_SECONDS = 300;

// ---------------------------------------------------------------- layout

function setBit(b: BB, i: number): BB {
  return i < 32 ? { lo: (b.lo | (1 << i)) >>> 0, hi: b.hi } : { lo: b.lo, hi: (b.hi | (1 << (i - 32))) >>> 0 };
}

function bit(b: BB, i: number): boolean {
  return ((i < 32 ? b.lo >>> i : b.hi >>> (i - 32)) & 1) === 1;
}

function partner(sym: Symmetry, w: number, h: number, i: number): number {
  const x = i & 7;
  const y = i >> 3;
  if (sym === "rot180") return index(w - 1 - x, h - 1 - y);
  if (sym === "mirror") return index(w - 1 - x, y);
  return i;
}

export function drawSymmetry(p: PipsGenParams, rng: Rng): Symmetry {
  if (p.symmetry !== "any") return p.symmetry;
  const r = rng.nextInt(4);
  return r < 2 ? "rot180" : r === 2 ? "mirror" : "none";
}

export function layStones(p: PipsGenParams, rng: Rng, sym: Symmetry): BB {
  const area = p.w * p.h;
  const pct = p.densityMin + rng.nextInt(p.densityMax - p.densityMin + 1);
  const k = udiv(area * pct + 50, 100);
  const cells: number[] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) cells.push(index(x, y));
  rng.shuffle(cells);
  let stones = EMPTY;
  let n = 0;
  for (const c of cells) {
    if (n >= k) break;
    if (bit(stones, c)) continue;
    const q = partner(sym, p.w, p.h, c);
    if (q !== c && n + 2 > k + 1) continue;
    stones = setBit(stones, c);
    n++;
    if (q !== c) {
      stones = setBit(stones, q);
      n++;
    }
  }
  return stones;
}

export function floorConnected(r: Rays): boolean {
  if ((r.floorLo | r.floorHi) === 0) return false;
  const floor = { lo: r.floorLo, hi: r.floorHi };
  const start = r.floorLo !== 0 ? low32(r.floorLo) : low32(r.floorHi) + 32;
  let seen = setBit(EMPTY, start);
  const queue = [start];
  while (queue.length > 0) {
    const c = queue.pop()!;
    for (const d of neighbours(r.w, r.h, c)) {
      if (bit(seen, d) || !bit(floor, d)) continue;
      seen = setBit(seen, d);
      queue.push(d);
    }
  }
  return seen.lo === r.floorLo && seen.hi === r.floorHi;
}

export function hasIsolatedCell(r: Rays): boolean {
  for (let i = 0; i < 64; i++) if (pop32(r.lo[i]!) + pop32(r.hi[i]!) === 1) return true;
  return false;
}

export function largestOpenRect(w: number, h: number, stones: BB): number {
  let best = 0;
  for (let y0 = 0; y0 < h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      for (let y1 = y0; y1 < h; y1++) {
        for (let x1 = x0; x1 < w; x1++) {
          let open = true;
          for (let y = y0; y <= y1 && open; y++) for (let x = x0; x <= x1 && open; x++) if (bit(stones, index(x, y))) open = false;
          if (!open) break;
          const a = (x1 - x0 + 1) * (y1 - y0 + 1);
          if (a > best) best = a;
        }
      }
    }
  }
  return best;
}

/** The k-th (0-based) set bit of the 64-bit set lo | hi << 32, ascending. */
function kthBit(lo: number, hi: number, k: number): number {
  const nLo = pop32(lo);
  let t = k < nLo ? lo : hi;
  for (let j = k < nLo ? k : k - nLo; j > 0; j--) t = (t & (t - 1)) >>> 0;
  return low32(t) + (k < nLo ? 0 : 32);
}

/**
 * A random valid full solution (every floor cell lit, no two lanterns see each other): while a
 * floor cell is dark, c = dark cells (ascending)[nextInt(#dark)], then a lantern on
 * (c's still-dark run cells, ascending)[nextInt(#)]. Allocation-free; draws as before.
 */
export function randomSolution(r: Rays, rng: Rng): BB {
  let pLo = 0;
  let pHi = 0;
  let dLo = r.floorLo;
  let dHi = r.floorHi;
  while ((dLo | dHi) !== 0) {
    const c = kthBit(dLo, dHi, rng.nextInt(pop32(dLo) + pop32(dHi)));
    const cLo = (r.lo[c]! & dLo) >>> 0;
    const cHi = (r.hi[c]! & dHi) >>> 0;
    const q = kthBit(cLo, cHi, rng.nextInt(pop32(cLo) + pop32(cHi)));
    if (q < 32) pLo = (pLo | (1 << q)) >>> 0;
    else pHi = (pHi | (1 << (q - 32))) >>> 0;
    dLo = (dLo & ~r.lo[q]!) >>> 0;
    dHi = (dHi & ~r.hi[q]!) >>> 0;
  }
  return { lo: pLo, hi: pHi };
}

/** Numbers for every stone from a solution. */
export function fullClues(w: number, h: number, stones: BB, solution: BB): number[] {
  const clues = new Array<number>(64).fill(NO_CLUE);
  for (let i = 0; i < 64; i++) {
    if (!bit(stones, i)) continue;
    let n = 0;
    for (const j of neighbours(w, h, i)) if (bit(solution, j)) n++;
    clues[i] = n;
  }
  return clues;
}

// ---------------------------------------------------------------- transforms

/**
 * Dihedral transform t (0..7) of cell i on an n×n board: 0 identity, 1 rot90,
 * 2 rot180, 3 rot270, 4 mirror x, 5 mirror y, 6 transpose, 7 anti-transpose.
 */
export function transformCell(n: number, i: number, t: number): number {
  const x = i & 7;
  const y = i >> 3;
  const k = n - 1;
  switch (t) {
    case 0: return i;
    case 1: return index(k - y, x);
    case 2: return index(k - x, k - y);
    case 3: return index(y, k - x);
    case 4: return index(k - x, y);
    case 5: return index(x, k - y);
    case 6: return index(y, x);
    case 7: return index(k - y, k - x);
    default: throw new RangeError(`transform ${t} out of range`);
  }
}

export function transformBB(n: number, b: BB, t: number): BB {
  let out = EMPTY;
  for (let i = 0; i < 64; i++) if (bit(b, i)) out = setBit(out, transformCell(n, i, t));
  return out;
}

/** The level under dihedral transform t (square boards only unless t = 0). */
export function transformLevel(level: PipsLevel, t: number): PipsLevel {
  if (t === 0) return level;
  if (level.w !== level.h) throw new RangeError("transforms need a square board");
  const clues = new Array<number>(64).fill(NO_CLUE);
  for (let i = 0; i < 64; i++) if (level.clues[i] !== NO_CLUE) clues[transformCell(level.w, i, t)] = level.clues[i]!;
  return { w: level.w, h: level.h, stones: transformBB(level.w, level.stones, t), clues };
}

/** Opening bucket: FNV-1a of the opening cell indices, mod `mod`. */
export function openingBucket(cells: readonly number[], mod: number): number {
  return fnv1a32(Uint8Array.from(cells)) % mod;
}

// ---------------------------------------------------------------- difficulty

export interface PipsDifficulty {
  readonly fast: number;
  readonly median: number;
  readonly tail: number;
  readonly runs: number;
}

export function pipsBotSeconds(level: PipsLevel, rng: Rng, runs: number, out: number[], model?: PipsModel): number[] {
  const m = model ?? buildModel(level);
  for (let k = 0; k < runs; k++) {
    const botRng = new Rng(rng.nextU32(), rng.nextU32(), rng.nextU32(), rng.nextU32() | 1);
    const t = pipsHumanSolve(level, { rng: botRng, record: false }, m);
    const sec = t.completed ? pipsTraceSeconds(t) : PIPS_GIVE_UP_SECONDS;
    out.push(sec < PIPS_GIVE_UP_SECONDS ? sec : PIPS_GIVE_UP_SECONDS);
  }
  return out;
}

export function pipsDifficultyFrom(samples: readonly number[]): PipsDifficulty {
  const s = samples.slice().sort((a, b) => a - b);
  const q = (pm: number): number => s[udiv((s.length - 1) * pm, 1000)]!;
  return { fast: q(200), median: q(500), tail: q(880), runs: s.length };
}

function bandDistance(d: PipsDifficulty, b: Band, tailMax?: number): number {
  const m = d.median < b.lo ? b.lo - d.median : d.median > b.hi ? d.median - b.hi : 0;
  return tailMax !== undefined && d.tail > tailMax ? m + d.tail - tailMax : m;
}

/** Node cap of the final uniqueness gate (10× the removal-loop cap). */
export const UNIQUE_GATE_NODES = 2_000_000;

// ---------------------------------------------------------------- start / numbers

/** 0-numbers are at most pct percent of the numbered stones (integer test). */
export function zerosWithin(clues: readonly number[], pct: number): boolean {
  let zeros = 0;
  let all = 0;
  for (let i = 0; i < 64; i++) {
    if (clues[i] === NO_CLUE || clues[i] === undefined) continue;
    all++;
    if (clues[i] === 0) zeros++;
  }
  return zeros * 100 <= pct * all;
}

/**
 * Visible starting lanterns: on the empty board (no marks), every floor side of
 * a non-zero number whose floor-side count equals the number. Ascending, unique.
 */
export function startCells(level: PipsLevel): number[] {
  const floorSide = (j: number): boolean => !bit(level.stones, j);
  const out: number[] = [];
  for (let i = 0; i < 64; i++) {
    const v = level.clues[i]!;
    if (v === NO_CLUE || v === 0) continue;
    const sides = neighbours(level.w, level.h, i).filter(floorSide);
    if (sides.length === v) for (const j of sides) if (!out.includes(j)) out.push(j);
  }
  return out.sort((a, b) => a - b);
}

// ---------------------------------------------------------------- generate

/** Lanterns of a solution that touch no stone: no number can ever place them, so each one is a T2 step. */
export function freeLanterns(w: number, h: number, stones: BB, solution: BB): number {
  let n = 0;
  for (let i = 0; i < 64; i++) {
    if (!bit(solution, i)) continue;
    if (!neighbours(w, h, i).some((j) => bit(stones, j))) n++;
  }
  return n;
}

/** Relaxation stage of attempt a (search path, only while no candidate exists): 0 strict … RELAX_LAST. */
export const RELAX_LAST = 4;
export function relaxStage(attempt: number, maxAttempts: number): number {
  const s = udiv(attempt * RELAX_LAST, maxAttempts);
  return s < RELAX_LAST ? s : RELAX_LAST;
}

type Best = { level: PipsLevel; meta: Omit<PipsGenMeta, "attempts" | "rejected" | "inBand">; dist: number };

export function generatePips(p: PipsGenParams): PipsGeneratedLevel {
  validateLevel({ w: p.w, h: p.h, stones: EMPTY, clues: new Array<number>(64).fill(NO_CLUE) });
  const rng = Rng.from(p.seedKey);
  const rejected: Record<PipsRejectReason, number> = {
    disconnected: 0, isolated: 0, openRoom: 0, notUnique: 0, tooDeep: 0, solverLimit: 0, tooShallow: 0, opening: 0,
    t2Range: 0, zeros: 0, noStart: 0, trick: 0, singles: 0,
  };
  const roomMax = udiv(p.w * p.h * 36, 100);
  const search = p.search;
  /** The T2 count the t2 range applies to (realT2 on the round-7 search path). */
  const t2v = (g: Grade): number => (search?.realT2 === true ? g.t2 - g.t2zero : g.t2);
  // Legacy streams: up to maxAttempts × 20 attempts while nothing scored. Search path: hard cap 2 × maxAttempts.
  const cap = search === undefined ? p.maxAttempts * 20 : p.maxAttempts * 2;
  let best: Best | null = null;
  let scored = 0;
  let foundAt = 0;
  let stage = 0;
  let attempt = 0;
  for (; attempt < cap; attempt++) {
    if (best !== null && attempt >= p.maxAttempts) break;
    if (best !== null && search?.afterFound !== undefined && attempt >= foundAt + search.afterFound) break;
    if (search !== undefined && best === null) {
      stage = relaxStage(attempt, p.maxAttempts);
      // Stage 1 only drops the trick bucket: without one it relaxes nothing (reported as 0).
      if (stage === 1 && p.trick === undefined) stage = 0;
    }
    // Relaxed constraints (search path, stage > 0): see PipsSearch.
    const t2lo = p.t2 === undefined ? 0 : stage >= RELAX_LAST ? 0 : stage >= 3 && p.t2.lo > 0 ? p.t2.lo - 1 : p.t2.lo;
    const isolatedMax = stage >= RELAX_LAST ? undefined : p.isolatedMax;
    const trickWant = stage >= 1 ? undefined : p.trick;
    const openingWant = p.opening === undefined ? undefined : stage >= RELAX_LAST ? undefined : stage >= 2 ? { ...p.opening, mod: 1, want: 0 } : p.opening;
    const zeroMax = search?.zeroMax === undefined || stage >= RELAX_LAST ? undefined : search.zeroMax;
    const sym = drawSymmetry(p, rng);
    const stones = layStones(p, rng, sym);
    const r = buildRays({ w: p.w, h: p.h, stones });
    if (!floorConnected(r)) {
      rejected.disconnected++;
      continue;
    }
    if (hasIsolatedCell(r)) {
      rejected.isolated++;
      continue;
    }
    if (largestOpenRect(p.w, p.h, stones) > roomMax) {
      rejected.openRoom++;
      continue;
    }
    let solution = randomSolution(r, rng);
    let level: PipsLevel;
    let clues: number[];
    if (search !== undefined) {
      // All solutionPicks draws, best score first (PipsSearch.score; ties keep draw order; no extra rng use):
      // the first whose full numbers are tier-solvable (⇒ unique) within the t2 cap is used.
      const draws = [solution];
      for (let k = 1; k < (p.solutionPicks ?? 1); k++) draws.push(randomSolution(r, rng));
      const score = (b: BB): number => {
        const lan = pop32(b.lo) + pop32(b.hi);
        const free = search.score === "lanterns" ? 0 : freeLanterns(p.w, p.h, stones, b);
        if (search.score === "free") return free * 64 + lan;
        if (search.score !== "sumNoZero") return (free + lan) * 64 + lan;
        // Round 7: stones that would be 0 count against the draw (fewer 0 rocks to keep).
        let zeros = 0;
        for (let i = 0; i < 64; i++) if (bit(stones, i) && !neighbours(p.w, p.h, i).some((j) => bit(b, j))) zeros++;
        return (free + lan - zeros + 64) * 64 + lan;
      };
      const ranked = draws.map((b, k) => ({ b, k, s: score(b) })).sort((x, y) => y.s - x.s || x.k - y.k);
      let found: { sol: BB; clues: number[] } | null = null;
      let why: PipsRejectReason = "tooDeep";
      for (const d of ranked) {
        const c = fullClues(p.w, p.h, stones, d.b);
        const lv: PipsLevel = { w: p.w, h: p.h, stones, clues: c };
        const g0 = grade(lv, p.tierCap, buildModel(lv, r));
        if (!g0.solved) continue;
        if ((p.t2 !== undefined && t2v(g0) > p.t2.hi) || (search.t2Total !== undefined && g0.t2 > search.t2Total.hi)) {
          why = "t2Range";
          continue;
        }
        found = { sol: d.b, clues: c };
        break;
      }
      if (found === null) {
        rejected[why]++;
        continue;
      }
      solution = found.sol;
      clues = found.clues;
      level = { w: p.w, h: p.h, stones, clues };
    } else {
      for (let k = 1; k < (p.solutionPicks ?? 1); k++) {
        const alt = randomSolution(r, rng);
        if (pop32(alt.lo) + pop32(alt.hi) > pop32(solution.lo) + pop32(solution.hi)) solution = alt;
      }
      clues = fullClues(p.w, p.h, stones, solution);
      level = { w: p.w, h: p.h, stones, clues };
      // Tier-solvable ⇒ unique (every tier rule is sound), so the exact counter only classifies failures.
      const g0 = grade(level, p.tierCap, buildModel(level, r));
      if (!g0.solved) {
        const all = countSolutions(level, 2);
        if (all.aborted) rejected.solverLimit++;
        else if (all.count !== 1) rejected.notUnique++;
        else rejected.tooDeep++;
        continue;
      }
      if (p.t2 !== undefined && g0.t2 > p.t2.hi) {
        rejected.t2Range++;
        continue;
      }
    }
    // Greedy removal in random order (0-numbers first when they are capped; larger numbers first
    // with search.bigFirst — stable sorts after the shuffle, no extra rng use). A removal sticks iff
    // the board stays tier-solvable (⇒ unique) within the t2 cap.
    let order: number[] = [];
    for (let i = 0; i < 64; i++) if (clues[i] !== NO_CLUE) order.push(i);
    rng.shuffle(order);
    if (p.zeroMaxPct !== undefined) order = [...order.filter((i) => clues[i] === 0), ...order.filter((i) => clues[i] !== 0)];
    if (search?.bigFirst === true) {
      // Larger numbers first; with zeroMax the 0-numbers go before all of them.
      const vals = search.zeroMax !== undefined ? [0, 4, 3, 2, 1] : [4, 3, 2, 1, 0];
      let k = 0;
      const src = order.slice();
      for (const v of vals) for (const i of src) if (clues[i] === v) order[k++] = i;
    }
    const removeIn = (ord: readonly number[]): number[] => {
      const out = clues.slice();
      for (const i of ord) {
        const v = out[i]!;
        out[i] = NO_CLUE;
        const trial: PipsLevel = { w: p.w, h: p.h, stones, clues: out.slice() };
        const tm = buildModel(trial, r);
        const gt = grade(trial, p.tierCap, tm);
        if (!gt.solved || (p.t2 !== undefined && t2v(gt) > p.t2.hi) || (search?.t2Total !== undefined && gt.t2 > search.t2Total.hi)) out[i] = v;
        // Search path: never remove the last number that opens the board (an empty opening fails every transform).
        else if (search !== undefined && p.opening?.nonEmpty === true && !hasOpening(tm)) out[i] = v;
      }
      return out;
    };
    let cur = removeIn(order);
    if (search?.orders !== undefined && search.orders > 1 && p.t2 !== undefined) {
      // Round 7: up to `orders` removal orders on the same layout (the extra ones reshuffle the
      // non-zero numbers, 0s still first); the first whose identity board reaches t2lo − 1 with the
      // 0 cap kept is used, else the one with the most counted T2 steps.
      const ok = (c: number[]): number => {
        if (zeroMax !== undefined && c.filter((x) => x === 0).length > zeroMax) return -1;
        return t2v(grade({ w: p.w, h: p.h, stones, clues: c }, p.tierCap));
      };
      let bestScore = ok(cur);
      for (let k = 1; k < search.orders && bestScore < t2lo - 1; k++) {
        const zs = order.filter((i) => clues[i] === 0);
        const nz = order.filter((i) => clues[i] !== 0);
        rng.shuffle(nz);
        const c = removeIn([...zs, ...nz]);
        const sc = ok(c);
        if (sc > bestScore) {
          bestScore = sc;
          cur = c;
        }
      }
    }
    level = { w: p.w, h: p.h, stones, clues: cur };
    // Uniqueness gate on the final numbers (no rng use: the legacy stream is unchanged).
    const gate = countSolutions(level, 2, UNIQUE_GATE_NODES);
    if (gate.aborted || gate.count !== 1) {
      if (gate.aborted) rejected.solverLimit++;
      else rejected.notUnique++;
      continue;
    }
    let sol = solution;
    if (p.requireT3 === true && grade(level, 2).solved) {
      rejected.tooShallow++;
      continue;
    }
    if ((p.zeroMaxPct !== undefined && !zerosWithin(cur, p.zeroMaxPct)) || (zeroMax !== undefined && cur.filter((c) => c === 0).length > zeroMax)) {
      rejected.zeros++;
      continue;
    }
    if (p.startVisible === true && startCells(level).length === 0) {
      rejected.noStart++;
      continue;
    }
    let transform = 0;
    let opening = openingCells(level);
    let trick = "";
    let singles = -1;
    if (search !== undefined && p.t2 !== undefined && p.tierCap === 2) {
      // Cheap early reject: a transform moves the T2 count by little; far below the floor → next layout.
      const t2 = t2v(grade(level, 2));
      if (t2 + 2 < t2lo) {
        rejected.t2Range++;
        continue;
      }
    }
    if (openingWant !== undefined || trickWant !== undefined || isolatedMax !== undefined || (search !== undefined && p.t2 !== undefined)) {
      transform = -1;
      let openingOk = false;
      let trickOk = false;
      let t2Ok = false;
      for (let t = 0; t < 8 && transform < 0; t++) {
        const lt = transformLevel(level, t);
        const lm = buildModel(lt);
        const op = t === 0 ? opening : openingCells(lt, lm);
        if (openingWant !== undefined && ((openingWant.nonEmpty && op.length === 0) || openingBucket(op, openingWant.mod) !== openingWant.want % openingWant.mod)) continue;
        openingOk = true;
        const ts = trickSignature(lt, lm);
        // Search path: the presented board's own T2 count (= its signature path length, T1+T2 tiers) must be in range.
        if (search !== undefined && p.t2 !== undefined && p.tierCap === 2) {
          const n2 = search.realT2 === true ? t2v(grade(lt, 2, lm)) : ts.kinds.length;
          if (n2 < t2lo || n2 > p.t2.hi) continue;
          const tt = search.t2Total;
          if (tt !== undefined && stage < RELAX_LAST && (ts.kinds.length < tt.lo || ts.kinds.length > tt.hi)) continue;
        }
        t2Ok = true;
        if (trickWant !== undefined && ts.bucket !== trickWant.want % trickWant.mod) continue;
        trickOk = true;
        // Isolated singles are path-based (tricks.ts), so they are counted on the presented board.
        const ns = isolatedSingles(lt, ts).length;
        if (isolatedMax !== undefined && ns > isolatedMax) continue;
        trick = ts.signature;
        singles = ns;
        transform = t;
        opening = op;
      }
      if (transform < 0) {
        if (trickOk) rejected.singles++;
        else if (t2Ok) rejected.trick++;
        else if (openingOk) rejected.t2Range++;
        else rejected.opening++;
        continue;
      }
      level = transformLevel(level, transform);
      sol = transformBB(p.w, solution, transform);
    }
    if (singles < 0) {
      const ts = trickSignature(level);
      trick = ts.signature;
      singles = isolatedSingles(level, ts).length;
    }
    const model = buildModel(level);
    const g = grade(level, p.tierCap, model);
    const tt = search?.t2Total;
    if ((p.t2 !== undefined && (t2v(g) < t2lo || t2v(g) > p.t2.hi)) || (tt !== undefined && stage < RELAX_LAST && (g.t2 < tt.lo || g.t2 > tt.hi))) {
      rejected.t2Range++;
      continue;
    }
    const samples = pipsBotSeconds(level, rng, PIPS_SCREEN_RUNS, [], model);
    let diff = pipsDifficultyFrom(samples);
    let dist = bandDistance(diff, p.target, p.tailMax);
    if (dist === 0 || best === null || dist < best.dist) {
      diff = pipsDifficultyFrom(pipsBotSeconds(level, rng, PIPS_CONFIRM_RUNS, samples, model));
      dist = bandDistance(diff, p.target, p.tailMax);
    }
    let nClues = 0;
    for (let i = 0; i < 64; i++) if (cur[i] !== NO_CLUE) nClues++;
    const meta: Best["meta"] = {
      solution: sol, lanterns: pop32(solution.lo) + pop32(solution.hi), stones: pop32(stones.lo) + pop32(stones.hi), clues: nClues,
      grade: g, difficultyFast: diff.fast, difficulty: diff.median, difficultyTail: diff.tail, symmetry: sym, opening, transform, trick, singles,
      ...(search !== undefined ? { relaxed: stage } : {}),
    };
    if (best === null) foundAt = attempt;
    if (best === null || dist < best.dist) best = { level, meta, dist };
    if (dist === 0) break;
    scored++;
    if (search !== undefined && scored >= search.scoredMax) {
      attempt++;
      break;
    }
  }
  if (best === null) throw new Error(`pips generator: no valid level for ${p.seedKey}`);
  validateLevel(best.level);
  // Belt and braces: every returned board passed the exact gate above.
  const final = countSolutions(best.level, 2, UNIQUE_GATE_NODES);
  if (final.aborted || final.count !== 1) throw new Error(`pips generator: non-unique board for ${p.seedKey}`);
  return {
    seedKey: p.seedKey, levelId: p.levelId, tag: p.tag, level: best.level,
    meta: { ...best.meta, inBand: best.dist === 0, attempts: attempt + (best.dist === 0 ? 1 : 0), rejected },
  };
}

// ---------------------------------------------------------------- curve

/** 1–5 → 5×5, 6–14 → 6×6, 15+ → 7×7 (same ramp as lanterns). */
export function pipsSizeForIndex(n: number): number {
  return n <= 5 ? 5 : n <= 14 ? 6 : 7;
}

export const PIPS_CYCLE = ["mid", "mid+", "hard", "easy", "mid"] as const;

/** Bands (estimated seconds, human-like bot median) per size and tag. */
export const PIPS_BANDS: Readonly<Record<number, Readonly<Record<string, Band>>>> = {
  5: { intro: { lo: 20, hi: 32 }, easy: { lo: 24, hi: 36 }, mid: { lo: 32, hi: 48 }, "mid+": { lo: 36, hi: 54 }, hard: { lo: 44, hi: 64 } },
  6: { easy: { lo: 40, hi: 56 }, mid: { lo: 52, hi: 72 }, "mid+": { lo: 58, hi: 80 }, hard: { lo: 66, hi: 92 } },
  7: { easy: { lo: 50, hi: 66 }, mid: { lo: 62, hi: 82 }, "mid+": { lo: 68, hi: 90 }, hard: { lo: 76, hi: 104 } },
};

export const PIPS_DENSITY: Readonly<Record<number, Band>> = {
  5: { lo: 16, hi: 24 },
  6: { lo: 17, hi: 26 },
  7: { lo: 18, hi: 28 },
};

export function pipsSeedKey(n: number): string {
  return `lanterns-pips:free:g${PIPS_GENERATOR_VERSION}:${n}`;
}

export function pipsParamsForIndex(n: number): PipsGenParams {
  if (!Number.isInteger(n) || n < 1 || n > 0xefffffff) throw new RangeError(`level index ${n} out of range`);
  const size = pipsSizeForIndex(n);
  const tag = n <= 2 ? "intro" : PIPS_CYCLE[(n - 1) % 5]!;
  const band = PIPS_BANDS[size]![tag] ?? PIPS_BANDS[size]!.mid!;
  const d = PIPS_DENSITY[size]!;
  return {
    seedKey: pipsSeedKey(n), levelId: n, w: size, h: size, densityMin: d.lo, densityMax: d.hi, symmetry: "any",
    tierCap: tag === "intro" || tag === "easy" ? 2 : 3, target: band, maxAttempts: 120, tag,
  };
}

/** Free-play level n (1-based) of variant P. */
export function pipsLevelForIndex(n: number): PipsGeneratedLevel {
  return generatePips(pipsParamsForIndex(n));
}

export { pipsLevelForIndex as levelForIndex };
