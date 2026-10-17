// Human-style deduction for Lanterns-P (pure, integer-only). Shared by the
// generator (difficulty grade + tier cap) and the human-like bot (time model).
//
// Board knowledge: placed lanterns P, lit cells (P included), marks M ("no
// lantern here", mental notes). available = floor & ~lit & ~M.
//
// Rule tiers (a person's order of attack):
//   T1 numbered stone n with p adjacent lanterns and a available neighbours:
//      p = n → mark the a cells (covers 0-stones); p + a = n → place them all.
//   T2 a dark cell whose candidate positions (its row/column runs ∩ available)
//      are a single cell → place it.
//   T3 one-step contradiction: hypothetically place a lantern on an available
//      cell q; if that IMMEDIATELY leaves some number unreachable/overfull or
//      some dark cell with no candidate (no further chaining), mark q.
// A level is tier-k solvable if repeatedly applying the lowest available tier
// (≤ k) completes it. Every rule is sound, so tier-solvable ⇒ unique.

import type { Rng } from "../../core/rng.ts";
import { low32, pop32 } from "../lanterns/solver.ts";
import type { PipsLevel, PipsMove } from "./rules.ts";
import { type PipsModel, buildModel } from "./solver.ts";

/** Mutable working board (bitboard words). */
export interface Board {
  pLo: number;
  pHi: number;
  lLo: number;
  lHi: number;
  mLo: number;
  mHi: number;
}

export const emptyBoard = (): Board => ({ pLo: 0, pHi: 0, lLo: 0, lHi: 0, mLo: 0, mHi: 0 });
const copyBoard = (b: Board): Board => ({ ...b });

export interface Deduction {
  readonly tier: 1 | 2 | 3;
  /** Cells to place a lantern on. */
  readonly place: readonly number[];
  /** Cells to mark "no lantern". */
  readonly mark: readonly number[];
}

function bitsOf(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let t = lo >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t));
  for (let t = hi >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t) + 32);
  return out;
}

export function place(m: PipsModel, b: Board, q: number): void {
  if (q < 32) b.pLo = (b.pLo | (1 << q)) >>> 0;
  else b.pHi = (b.pHi | (1 << (q - 32))) >>> 0;
  b.lLo = (b.lLo | m.r.lo[q]!) >>> 0;
  b.lHi = (b.lHi | m.r.hi[q]!) >>> 0;
}

export function mark(b: Board, q: number): void {
  if (q < 32) b.mLo = (b.mLo | (1 << q)) >>> 0;
  else b.mHi = (b.mHi | (1 << (q - 32))) >>> 0;
}

export function applyDeduction(m: PipsModel, b: Board, d: Deduction): void {
  for (const q of d.place) place(m, b, q);
  for (const q of d.mark) mark(b, q);
}

/** Some number is overfull/unreachable, or some dark cell has no candidate. */
function brokenWith(m: PipsModel, pLo: number, pHi: number, lLo: number, lHi: number, mLo: number, mHi: number): boolean {
  const r = m.r;
  const aLo = (r.floorLo & ~lLo & ~mLo) >>> 0;
  const aHi = (r.floorHi & ~lHi & ~mHi) >>> 0;
  for (let k = 0; k < m.clueCell.length; k++) {
    const v = m.clueVal[k]!;
    const p = pop32((m.adjLo[k]! & pLo) >>> 0) + pop32((m.adjHi[k]! & pHi) >>> 0);
    const a = pop32((m.adjLo[k]! & aLo) >>> 0) + pop32((m.adjHi[k]! & aHi) >>> 0);
    if (p > v || p + a < v) return true;
  }
  for (let t = (r.floorLo & ~lLo) >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) {
    const c = low32(t);
    if (((r.lo[c]! & aLo) | (r.hi[c]! & aHi)) === 0) return true;
  }
  for (let t = (r.floorHi & ~lHi) >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) {
    const c = low32(t) + 32;
    if (((r.lo[c]! & aLo) | (r.hi[c]! & aHi)) === 0) return true;
  }
  return false;
}

export function broken(m: PipsModel, b: Board): boolean {
  return brokenWith(m, b.pLo, b.pHi, b.lLo, b.lHi, b.mLo, b.mHi);
}

export function allLit(m: PipsModel, b: Board): boolean {
  return ((m.r.floorLo & ~b.lLo) | (m.r.floorHi & ~b.lHi)) === 0;
}

export function findT1(m: PipsModel, b: Board): Deduction[] {
  const out: Deduction[] = [];
  const aLo = (m.r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
  const aHi = (m.r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
  for (let k = 0; k < m.clueCell.length; k++) {
    const v = m.clueVal[k]!;
    const p = pop32((m.adjLo[k]! & b.pLo) >>> 0) + pop32((m.adjHi[k]! & b.pHi) >>> 0);
    const avLo = (m.adjLo[k]! & aLo) >>> 0;
    const avHi = (m.adjHi[k]! & aHi) >>> 0;
    const a = pop32(avLo) + pop32(avHi);
    if (a === 0) continue;
    if (p === v) out.push({ tier: 1, place: [], mark: bitsOf(avLo, avHi) });
    else if (p + a === v) out.push({ tier: 1, place: bitsOf(avLo, avHi), mark: [] });
  }
  return out;
}

export function findT2(m: PipsModel, b: Board): Deduction[] {
  const r = m.r;
  const out: Deduction[] = [];
  const seen: number[] = [];
  const aLo = (r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
  const aHi = (r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
  for (const c of bitsOf((r.floorLo & ~b.lLo) >>> 0, (r.floorHi & ~b.lHi) >>> 0)) {
    const cLo = (r.lo[c]! & aLo) >>> 0;
    const cHi = (r.hi[c]! & aHi) >>> 0;
    if (pop32(cLo) + pop32(cHi) !== 1) continue;
    const q = cLo !== 0 ? low32(cLo) : low32(cHi) + 32;
    if (seen.includes(q)) continue;
    seen.push(q);
    out.push({ tier: 2, place: [q], mark: [] });
  }
  return out;
}

/** true if placing on available cell q immediately breaks something (T3 test). */
export function placeBreaks(m: PipsModel, b: Board, q: number): boolean {
  const pLo = q < 32 ? (b.pLo | (1 << q)) >>> 0 : b.pLo;
  const pHi = q < 32 ? b.pHi : (b.pHi | (1 << (q - 32))) >>> 0;
  return brokenWith(m, pLo, pHi, (b.lLo | m.r.lo[q]!) >>> 0, (b.lHi | m.r.hi[q]!) >>> 0, b.mLo, b.mHi);
}

/** Available cells in ascending order (T3 scan order for the grader). */
export function availableCells(m: PipsModel, b: Board): number[] {
  return bitsOf((m.r.floorLo & ~b.lLo & ~b.mLo) >>> 0, (m.r.floorHi & ~b.lHi & ~b.mHi) >>> 0);
}

export interface Grade {
  /** Solved by tiers ≤ maxTier. */
  readonly solved: boolean;
  /** Rule applications per tier. */
  readonly t1: number;
  readonly t2: number;
  readonly t3: number;
  /** Highest tier needed (0 = no deduction needed, e.g. solved by... never in practice). */
  readonly maxTierUsed: number;
  /**
   * Round 7 (r6: "zero-derived steps read as free"): T2 steps on the path that lean on a 0 rock —
   * some other spot of the dark cell is ruled out only by a 0 rock's mark (dark, marked when a 0
   * clue marked its sides). t2 − t2zero = the "real" T2 steps (realT2).
   */
  readonly t2zero: number;
}

/** T2 steps that do not stem directly from a 0 clue (see Grade.t2zero). */
export function realT2(g: Grade): number {
  return g.t2 - g.t2zero;
}

/**
 * Apply the FIRST T1 deduction (clue order) — exactly findT1(m, b)[0] — without allocating.
 * Returns the clue's index in the model (m.clueVal[k] is its number), or −1 when there is none.
 */
export function applyFirstT1(m: PipsModel, b: Board): number {
  const aLo = (m.r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
  const aHi = (m.r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
  for (let k = 0; k < m.clueCell.length; k++) {
    const v = m.clueVal[k]!;
    const avLo = (m.adjLo[k]! & aLo) >>> 0;
    const avHi = (m.adjHi[k]! & aHi) >>> 0;
    const a = pop32(avLo) + pop32(avHi);
    if (a === 0) continue;
    const p = pop32((m.adjLo[k]! & b.pLo) >>> 0) + pop32((m.adjHi[k]! & b.pHi) >>> 0);
    if (p === v) {
      b.mLo = (b.mLo | avLo) >>> 0;
      b.mHi = (b.mHi | avHi) >>> 0;
      return k;
    }
    if (p + a === v) {
      for (let t = avLo; t !== 0; t = (t & (t - 1)) >>> 0) place(m, b, low32(t));
      for (let t = avHi; t !== 0; t = (t & (t - 1)) >>> 0) place(m, b, low32(t) + 32);
      return k;
    }
  }
  return -1;
}

/**
 * The FIRST T2 step (dark cell order) — exactly findT2(m, b)[0]: returns its dark cell c and spot q
 * as c * 64 + q, or −1. Allocation-free.
 */
export function firstT2(m: PipsModel, b: Board): number {
  const r = m.r;
  const aLo = (r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
  const aHi = (r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
  for (let w = 0; w < 2; w++) {
    for (let t = w === 0 ? (r.floorLo & ~b.lLo) >>> 0 : (r.floorHi & ~b.lHi) >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) {
      const c = low32(t) + (w << 5);
      const cLo = (r.lo[c]! & aLo) >>> 0;
      const cHi = (r.hi[c]! & aHi) >>> 0;
      if (pop32(cLo) + pop32(cHi) !== 1) continue;
      return c * 64 + (cLo !== 0 ? low32(cLo) : low32(cHi) + 32);
    }
  }
  return -1;
}

/** Deterministic tier solver: always applies the lowest tier available (first in cell order). */
export function grade(level: PipsLevel, maxTier = 3, model?: PipsModel): Grade {
  const m = model ?? buildModel(level);
  const b = emptyBoard();
  let t1 = 0;
  let t2 = 0;
  let t3 = 0;
  let t2zero = 0;
  // Marks made by 0 clues (a mark has one origin: only available cells get marked).
  let zLo = 0;
  let zHi = 0;
  for (let guard = 0; guard < 512; guard++) {
    if (broken(m, b)) break;
    if (allLit(m, b)) return { solved: true, t1, t2, t3, maxTierUsed: t3 > 0 ? 3 : t2 > 0 ? 2 : t1 > 0 ? 1 : 0, t2zero };
    const mLo0 = b.mLo;
    const mHi0 = b.mHi;
    const k = applyFirstT1(m, b);
    if (k >= 0) {
      if (m.clueVal[k] === 0) {
        zLo = (zLo | (b.mLo & ~mLo0)) >>> 0;
        zHi = (zHi | (b.mHi & ~mHi0)) >>> 0;
      }
      t1++;
      continue;
    }
    if (maxTier < 2) break;
    const s2 = firstT2(m, b);
    if (s2 >= 0) {
      const c = s2 >> 6;
      const q = s2 & 63;
      // Other spots of c ruled out only by a 0 rock: dark and 0-marked.
      const oLo = (m.r.lo[c]! & ~b.lLo & zLo & ~(q < 32 ? 1 << q : 0)) >>> 0;
      const oHi = (m.r.hi[c]! & ~b.lHi & zHi & ~(q >= 32 ? 1 << (q - 32) : 0)) >>> 0;
      if ((oLo | oHi) !== 0) t2zero++;
      place(m, b, q);
      t2++;
      continue;
    }
    if (maxTier < 3) break;
    let hit = -1;
    for (const q of availableCells(m, b)) {
      if (placeBreaks(m, b, q)) {
        hit = q;
        break;
      }
    }
    if (hit < 0) break;
    mark(b, hit);
    t3++;
  }
  return { solved: false, t1, t2, t3, maxTierUsed: t3 > 0 ? 3 : t2 > 0 ? 2 : t1 > 0 ? 1 : 0, t2zero };
}

// ---------------------------------------------------------------- human-like bot

/**
 * Time model (seconds, integer), same base as sim/ and games/lanterns:
 * 4 s per placement, 2 s per removal, 6 s per dead end (a guess that failed),
 * plus thinking penalties: +2 s to spot a T2 cell, +6 s per T3 contradiction
 * found, +1 s per T3 trial that led nowhere.
 */
export const PIPS_TIME = { place: 4, remove: 2, deadEnd: 6, t2: 2, t3: 6, trial: 1 } as const;

export interface PipsHumanOptions {
  readonly rng?: Rng | null;
  /** ‰ chance, when no T1 move is in sight, that the bot guesses instead of looking deeper (default 150). */
  readonly lapsePermille?: number;
  /** Give up after this many placements + removals (default 400). */
  readonly maxActions?: number;
  /** Record the toggle sequence (default true). */
  readonly record?: boolean;
}

export interface PipsTrace {
  readonly completed: boolean;
  readonly placements: number;
  readonly removals: number;
  readonly deadEnds: number;
  readonly guesses: number;
  readonly t1: number;
  readonly t2: number;
  readonly t3: number;
  readonly trials: number;
  /** Toggles as played, replayable through rules.toggle. */
  readonly moves: readonly PipsMove[];
}

export function pipsTraceSeconds(t: PipsTrace): number {
  const k = PIPS_TIME;
  return t.placements * k.place + t.removals * k.remove + t.deadEnds * k.deadEnd + t.t2 * k.t2 + t.t3 * k.t3 + t.trials * k.trial;
}

/**
 * Human-like play: T1 first; otherwise (unless it lapses) T2, then a T3 scan in
 * random order. On a lapse, or when stuck, it guesses one lantern for the most
 * constrained dark cell (never overfilling a visible number) and keeps
 * deducing; a contradiction (or getting stuck) under a guess → undo every
 * lantern since the guess, mark the guessed cell, continue. One open guess at a time.
 */
export function pipsHumanSolve(level: PipsLevel, opts: PipsHumanOptions = {}, model?: PipsModel): PipsTrace {
  const m = model ?? buildModel(level);
  const r = m.r;
  const rng = opts.rng ?? null;
  const lapse = opts.lapsePermille ?? 150;
  const maxActions = opts.maxActions ?? 400;
  const record = opts.record ?? true;
  const moves: PipsMove[] = [];
  let b = emptyBoard();
  let placements = 0;
  let removals = 0;
  let deadEnds = 0;
  let guesses = 0;
  let t1 = 0;
  let t2 = 0;
  let t3 = 0;
  let trials = 0;
  let guess: { cell: number; snap: Board } | null = null;
  const pick = <T>(xs: readonly T[]): T => xs[rng && xs.length > 1 ? rng.nextInt(xs.length) : 0]!;
  const put = (q: number): void => {
    place(m, b, q);
    placements++;
    if (record) moves.push({ x: q & 7, y: q >> 3 });
  };
  const result = (completed: boolean): PipsTrace => ({ completed, placements, removals, deadEnds, guesses, t1, t2, t3, trials, moves });
  const backtrack = (): void => {
    const g = guess!;
    // Lanterns placed since the guess (the guess included), removed newest first.
    const since = bitsOf((b.pLo & ~g.snap.pLo) >>> 0, (b.pHi & ~g.snap.pHi) >>> 0);
    for (let k = since.length - 1; k >= 0; k--) {
      const q = since[k]!;
      removals++;
      if (record) moves.push({ x: q & 7, y: q >> 3 });
    }
    deadEnds++;
    b = copyBoard(g.snap);
    mark(b, g.cell);
    guess = null;
  };
  /** Overfills an adjacent number (visible on the board). */
  const overfills = (q: number): boolean => {
    for (let k = 0; k < m.clueCell.length; k++) {
      const inAdj = q < 32 ? (m.adjLo[k]! >>> q) & 1 : (m.adjHi[k]! >>> (q - 32)) & 1;
      if (inAdj === 0) continue;
      const p = pop32((m.adjLo[k]! & b.pLo) >>> 0) + pop32((m.adjHi[k]! & b.pHi) >>> 0);
      if (p + 1 > m.clueVal[k]!) return true;
    }
    return false;
  };
  const makeGuess = (): boolean => {
    const aLo = (r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
    const aHi = (r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
    let bestN = 99;
    let best: number[] = [];
    for (const c of bitsOf((r.floorLo & ~b.lLo) >>> 0, (r.floorHi & ~b.lHi) >>> 0)) {
      const cands = bitsOf((r.lo[c]! & aLo) >>> 0, (r.hi[c]! & aHi) >>> 0).filter((q) => !overfills(q));
      if (cands.length === 0) continue;
      if (cands.length < bestN) {
        bestN = cands.length;
        best = cands;
      }
    }
    if (best.length === 0) return false;
    const q = pick(best);
    guess = { cell: q, snap: copyBoard(b) };
    guesses++;
    put(q);
    return true;
  };

  while (placements + removals < maxActions) {
    if (broken(m, b)) {
      if (guess === null) return result(false);
      backtrack();
      continue;
    }
    if (allLit(m, b)) return result(true);
    const d1 = findT1(m, b);
    if (d1.length > 0) {
      const d = pick(d1);
      for (const q of d.place) put(q);
      for (const q of d.mark) mark(b, q);
      t1++;
      continue;
    }
    const lapsed = guess === null && rng !== null && rng.nextInt(1000) < lapse;
    if (!lapsed) {
      const d2 = findT2(m, b);
      if (d2.length > 0) {
        put(pick(d2).place[0]!);
        t2++;
        continue;
      }
      const av = availableCells(m, b);
      if (rng) rng.shuffle(av);
      let hit = -1;
      for (const q of av) {
        if (placeBreaks(m, b, q)) {
          hit = q;
          break;
        }
        trials++;
      }
      if (hit >= 0) {
        mark(b, hit);
        t3++;
        continue;
      }
    }
    if (guess !== null) {
      backtrack();
      continue;
    }
    if (!makeGuess()) return result(false);
  }
  return result(false);
}

// ---------------------------------------------------------------- opening

/**
 * The level's "opening": every lantern forced by T1 alone from the empty board
 * (number rule applied to a fixpoint, marks from satisfied numbers included),
 * ascending cell indices. Two levels have the same opening iff these sets are
 * equal (coordinates, not board size). Empty = no T1 placement at the start.
 */
/** openingCells(level).length > 0, without building the set (stops at the first T1 placement). */
export function hasOpening(m: PipsModel): boolean {
  const b = emptyBoard();
  for (let guard = 0; guard < 256; guard++) {
    const ds = findT1(m, b);
    if (ds.length === 0) return false;
    for (const d of ds) {
      if (d.place.length > 0) return true;
      applyDeduction(m, b, d);
    }
  }
  return false;
}

export function openingCells(level: PipsLevel, model?: PipsModel): number[] {
  const m = model ?? buildModel(level);
  const b = emptyBoard();
  for (let guard = 0; guard < 256; guard++) {
    const ds = findT1(m, b);
    if (ds.length === 0) break;
    for (const d of ds) applyDeduction(m, b, d);
  }
  return bitsOf(b.pLo, b.pHi);
}

// ---------------------------------------------------------------- forced dead end (round 7)

/** Rounds of forced moves a dead end may lie behind (round 7; analysis.ts BoardAnalysis.deadEnd). */
export const FORCED_ROUNDS = 4;

export interface DeadEnd {
  /** The numbered stone ('number') or floor cell ('cell') where the contradiction shows. */
  readonly at: number;
  readonly kind: "number" | "cell";
  /** Rounds of forced moves applied before it shows (1 = after one round). */
  readonly rounds: number;
}

function brokenAt(m: PipsModel, b: Board): { at: number; kind: "number" | "cell" } | null {
  const r = m.r;
  const aLo = (r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
  const aHi = (r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
  for (let k = 0; k < m.clueCell.length; k++) {
    const v = m.clueVal[k]!;
    const p = pop32((m.adjLo[k]! & b.pLo) >>> 0) + pop32((m.adjHi[k]! & b.pHi) >>> 0);
    const a = pop32((m.adjLo[k]! & aLo) >>> 0) + pop32((m.adjHi[k]! & aHi) >>> 0);
    if (p > v || p + a < v) return { at: m.clueCell[k]!, kind: "number" };
  }
  for (const c of bitsOf((r.floorLo & ~b.lLo) >>> 0, (r.floorHi & ~b.lHi) >>> 0)) {
    if (((r.lo[c]! & aLo) | (r.hi[c]! & aHi)) === 0) return { at: c, kind: "cell" };
  }
  return null;
}

/**
 * Forced dead end (round 7, r6 Priya J-25: "after taking back A5 nothing was stuck, but the 1 could
 * no longer come right"). From the placed lanterns (no marks), apply every T1 and T2 deduction
 * available, round by round (all deductions of a round are read off the same board), up to
 * `maxRounds` rounds. Returns where the board breaks — a number over/unreachable, a dark cell with
 * no spot, or two forced lanterns of one round that see each other — or null (no contradiction
 * within the rounds, or nothing forced). Every rule is sound, so a dead end proves that some placed
 * lantern is wrong; it is what a player following forced moves would run into.
 */
export function forcedDeadEnd(m: PipsModel, lanterns: { lo: number; hi: number }, maxRounds = FORCED_ROUNDS): DeadEnd | null {
  const b = emptyBoard();
  for (const q of bitsOf(lanterns.lo & m.r.floorLo, lanterns.hi & m.r.floorHi)) place(m, b, q);
  for (let round = 0; ; round++) {
    const hit = brokenAt(m, b);
    if (hit !== null) return round === 0 ? null : { ...hit, rounds: round };
    if (round >= maxRounds || allLit(m, b)) return null;
    const ds = [...findT1(m, b), ...findT2(m, b)];
    if (ds.length === 0) return null;
    for (const d of ds) for (const q of d.mark) mark(b, q);
    for (const d of ds) {
      for (const q of d.place) {
        if (inBits(b.pLo, b.pHi, q)) continue;
        if (inBits(b.lLo, b.lHi, q) || inBits(b.mLo, b.mHi, q)) return { at: q, kind: "cell", rounds: round + 1 };
        place(m, b, q);
      }
    }
  }
}

const inBits = (lo: number, hi: number, i: number): boolean => ((i < 32 ? lo >>> i : hi >>> (i - 32)) & 1) === 1;

