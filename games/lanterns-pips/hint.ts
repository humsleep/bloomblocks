// Hint engine for Lanterns-P (pure, integer-only, no text: the UI words it).
//
// 1. Any placed lantern that is not in the level's unique solution →
//    { kind: 'removeWrong', cells: [ONE lantern], remaining: how many wrong
//    lanterns there are in total (this one included) }. Progressive: one
//    lantern per hint, the most culpable first. Culpability of a wrong lantern
//    w = blocked cells it unblocks + numbered stones it un-overfills or
//    un-sticks (⊘) when taken back (analyzeCore before/after; round 5 added ⊘). Ties → the most recently placed (latest
//    toggle of w in `recent`, else lastMoveCell); then (no history) the one
//    that clears more conflicts, then nearest to lastMoveCell, then lowest cell.
// 2. Otherwise (every lantern is correct) the simplest forced placement,
//    recomputed from the board as it stands (no memory of past deductions):
//      T1 'stone'        a numbered stone whose free sides are exactly the
//                        lanterns it still needs (marks from full stones first)
//      T2 'onlyLight'    a dark cell that only one free cell can still light
//      T3 'contradiction' after ruling out every cell where a lantern would
//                        immediately break a number or leave a dark cell with
//                        no way to be lit, a T1/T2 placement appears
//    Lowest tier wins; inside it, nearest to lastMoveCell (Manhattan), then
//    nearest to the most recently touched numbered stone, then lowest cell.
//    anchor = the stone (T1) or dark cell (T2) that forces the cell; for T3,
//    the stone/dark cell that forces it once the ruled-out cells are excluded
//    (ruledOut lists those cells, relevant ones first).
//    Every rule is sound and the current lanterns are all in the unique
//    solution, so the cell is in the solution and never conflicts.
// 3. Complete (or no solution) → { kind: 'none' }.

import { type PipsModel, buildModel } from "./solver.ts";
import { type Board, emptyBoard, mark, place, placeBreaks } from "./deduce.ts";
import { low32, pop32 } from "../lanterns/solver.ts";
import { type BB, NO_CLUE, type PipsLevel, type PipsState, isComplete, neighbours } from "./rules.ts";
import { levelSolution, mostCulpableOf } from "./analysis.ts";

export type HintReason = "stone" | "onlyLight" | "contradiction";

export type Hint =
  | { kind: "removeWrong"; cells: number[]; remaining: number }
  | { kind: "place"; cell: number; reason: HintReason; anchor: number; ruledOut?: number[] }
  | { kind: "none" };

interface LevelInfo {
  readonly m: PipsModel;
  /** The unique solution (or the first found), null if none. */
  readonly sol: BB | null;
}

const infoCache = new WeakMap<object, LevelInfo>();

function infoOf(level: PipsLevel): LevelInfo {
  const hit = infoCache.get(level);
  if (hit !== undefined) return hit;
  const info: LevelInfo = { m: buildModel(level), sol: levelSolution(level) };
  infoCache.set(level, info);
  return info;
}

/** The level's solution (unique for generated levels), or null. */
export function solutionOf(level: PipsLevel): BB | null {
  return infoOf(level).sol;
}

const inMask = (lo: number, hi: number, i: number): boolean => ((i < 32 ? lo >>> i : hi >>> (i - 32)) & 1) === 1;

function bitsOf(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let t = lo >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t));
  for (let t = hi >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t) + 32);
  return out;
}

function dist(a: number, b: number): number {
  const dx = (a & 7) - (b & 7);
  const dy = (a >> 3) - (b >> 3);
  return (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
}

interface Cand {
  cell: number;
  anchor: number;
}

/** T1 marks (full stones) to a fixpoint. */
function markFullStones(m: PipsModel, b: Board): void {
  for (let guard = 0; guard < 64; guard++) {
    let any = false;
    const aLo = (m.r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
    const aHi = (m.r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
    for (let k = 0; k < m.clueCell.length; k++) {
      const p = pop32((m.adjLo[k]! & b.pLo) >>> 0) + pop32((m.adjHi[k]! & b.pHi) >>> 0);
      const avLo = (m.adjLo[k]! & aLo) >>> 0;
      const avHi = (m.adjHi[k]! & aHi) >>> 0;
      if ((avLo | avHi) === 0 || p !== m.clueVal[k]) continue;
      b.mLo = (b.mLo | avLo) >>> 0;
      b.mHi = (b.mHi | avHi) >>> 0;
      any = true;
    }
    if (!any) return;
  }
}

function t1Cands(m: PipsModel, b: Board): Cand[] {
  const out: Cand[] = [];
  const aLo = (m.r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
  const aHi = (m.r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
  for (let k = 0; k < m.clueCell.length; k++) {
    const p = pop32((m.adjLo[k]! & b.pLo) >>> 0) + pop32((m.adjHi[k]! & b.pHi) >>> 0);
    const avLo = (m.adjLo[k]! & aLo) >>> 0;
    const avHi = (m.adjHi[k]! & aHi) >>> 0;
    const a = pop32(avLo) + pop32(avHi);
    if (a === 0 || p + a !== m.clueVal[k]) continue;
    for (const q of bitsOf(avLo, avHi)) out.push({ cell: q, anchor: m.clueCell[k]! });
  }
  return out;
}

function t2Cands(m: PipsModel, b: Board): Cand[] {
  const r = m.r;
  const out: Cand[] = [];
  const aLo = (r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
  const aHi = (r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
  for (const c of bitsOf((r.floorLo & ~b.lLo) >>> 0, (r.floorHi & ~b.lHi) >>> 0)) {
    const cLo = (r.lo[c]! & aLo) >>> 0;
    const cHi = (r.hi[c]! & aHi) >>> 0;
    if (pop32(cLo) + pop32(cHi) !== 1) continue;
    out.push({ cell: cLo !== 0 ? low32(cLo) : low32(cHi) + 32, anchor: c });
  }
  return out;
}

/** Most recently touched numbered stone: a numbered stone next to the newest touched cell that has one. */
function recentStone(level: PipsLevel, touched: readonly number[]): number {
  for (let k = touched.length - 1; k >= 0; k--) {
    const c = touched[k]!;
    if (!Number.isInteger(c) || c < 0 || c > 63) continue;
    let best = -1;
    for (const s of neighbours(level.w, level.h, c)) if (level.clues[s] !== NO_CLUE && (best < 0 || s < best)) best = s;
    if (best >= 0) return best;
  }
  return -1;
}

function pick(cands: readonly Cand[], last: number, stone: number): Cand {
  let best = cands[0]!;
  const key = (c: Cand): [number, number, number, number] => [
    last >= 0 ? dist(c.cell, last) : 0, stone >= 0 ? dist(c.cell, stone) : 0, dist(c.cell, c.anchor), c.cell,
  ];
  let bk = key(best);
  for (const c of cands) {
    const k = key(c);
    for (let t = 0; t < 4; t++) {
      if (k[t]! < bk[t]!) {
        best = c;
        bk = k;
        break;
      }
      if (k[t]! > bk[t]!) break;
    }
  }
  return best;
}

/** The most culpable wrong lantern (see header; analysis.ts mostCulpableOf). */
export function mostCulpable(level: PipsLevel, state: PipsState, wrong: readonly number[], last: number, recent: readonly number[]): number {
  return mostCulpableOf(level, state, wrong, last, recent);
}

export interface HintTrace {
  readonly hint: Hint;
  /** Tier that produced a placement: 1, 2, 3; 0 = fallback (no deduction found; should not happen), -1 = not a placement. */
  readonly tier: number;
}

/**
 * Hint with the tier that produced it (tests / tooling). `recent` = cells the
 * player toggled, oldest first (optional; lastMoveCell is used when absent).
 */
export function hintTrace(level: PipsLevel, state: PipsState, lastMoveCell?: number, recent?: readonly number[]): HintTrace {
  const none: HintTrace = { hint: { kind: "none" }, tier: -1 };
  if (isComplete(state)) return none;
  const { m, sol } = infoOf(level);
  if (sol === null) return none;
  const r = m.r;
  const lantLo = (state.lanterns.lo & r.floorLo) >>> 0;
  const lantHi = (state.lanterns.hi & r.floorHi) >>> 0;
  const wrong = bitsOf((lantLo & ~sol.lo) >>> 0, (lantHi & ~sol.hi) >>> 0);
  const last = lastMoveCell !== undefined && Number.isInteger(lastMoveCell) && lastMoveCell >= 0 && lastMoveCell < 64 ? lastMoveCell : -1;
  const history = recent ?? (last >= 0 ? [last] : []);
  if (wrong.length > 0) {
    const w = mostCulpable(level, state, wrong, last, history);
    return { hint: { kind: "removeWrong", cells: [w], remaining: wrong.length }, tier: -1 };
  }

  const stone = recentStone(level, history);
  const b = emptyBoard();
  for (const q of bitsOf(lantLo, lantHi)) place(m, b, q);
  const ok = (c: Cand): boolean => inMask(sol.lo, sol.hi, c.cell) && !inMask(b.lLo, b.lHi, c.cell);
  const ruled: number[] = [];
  for (let guard = 0; guard < 128; guard++) {
    markFullStones(m, b);
    let tier = 1;
    let cands = t1Cands(m, b).filter(ok);
    if (cands.length === 0) {
      tier = 2;
      cands = t2Cands(m, b).filter(ok);
    }
    if (cands.length > 0) {
      const c = pick(cands, last, stone);
      if (ruled.length === 0) {
        return { hint: { kind: "place", cell: c.cell, reason: tier === 1 ? "stone" : "onlyLight", anchor: c.anchor }, tier };
      }
      // Relevant ruled-out cells: around the anchor stone / on the anchor cell's runs.
      const isStone = level.clues[c.anchor] !== NO_CLUE && inMask(level.stones.lo, level.stones.hi, c.anchor);
      const near = (q: number): boolean => isStone ? neighbours(level.w, level.h, c.anchor).includes(q) : inMask(r.lo[c.anchor]!, r.hi[c.anchor]!, q);
      const ruledOut = [...ruled.filter(near).sort((x, y) => x - y), ...ruled.filter((q) => !near(q)).sort((x, y) => x - y)];
      return { hint: { kind: "place", cell: c.cell, reason: "contradiction", anchor: c.anchor, ruledOut }, tier: 3 };
    }
    // T3: rule out every cell where a lantern breaks something at once.
    const av = bitsOf((r.floorLo & ~b.lLo & ~b.mLo) >>> 0, (r.floorHi & ~b.lHi & ~b.mHi) >>> 0);
    const hits = av.filter((q) => placeBreaks(m, b, q));
    if (hits.length === 0) break;
    for (const q of hits) {
      mark(b, q);
      ruled.push(q);
    }
  }
  // Fallback (beyond T3 from this position): the nearest missing solution cell,
  // anchored on the dark cell it lights that has the fewest free candidates.
  const todo = bitsOf((sol.lo & ~lantLo) >>> 0, (sol.hi & ~lantHi) >>> 0).map((q) => ({ cell: q, anchor: q }));
  if (todo.length === 0) return none;
  const c = pick(todo, last, stone);
  let anchor = c.cell;
  let bestN = 99;
  const aLo = (r.floorLo & ~b.lLo) >>> 0;
  const aHi = (r.floorHi & ~b.lHi) >>> 0;
  for (const d of bitsOf((r.lo[c.cell]! & aLo) >>> 0, (r.hi[c.cell]! & aHi) >>> 0)) {
    const n = pop32((r.lo[d]! & aLo) >>> 0) + pop32((r.hi[d]! & aHi) >>> 0);
    if (n < bestN) [bestN, anchor] = [n, d];
  }
  return { hint: { kind: "place", cell: c.cell, reason: "contradiction", anchor, ruledOut: ruled.slice().sort((x, y) => x - y) }, tier: 0 };
}

/**
 * The next hint. lastMoveCell = the cell of the player's latest toggle;
 * recent = optional toggle history (oldest first) for the "most recently
 * touched numbered stone" tie-break.
 */
export function hintFor(level: PipsLevel, state: PipsState, lastMoveCell?: number, recent?: readonly number[]): Hint {
  return hintTrace(level, state, lastMoveCell, recent).hint;
}
