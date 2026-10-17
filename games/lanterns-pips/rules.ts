// Lanterns variant P ("pips") — classic Akari / Light Up rules. Rules only.
//
// Same board, light and conflict model as games/lanterns (stride-8 cell index,
// 64-cell bitboards as two u32 words, a lantern lights its own cell and its
// row/column runs up to a stone or the edge, two lanterns that see each other
// conflict). Differences:
//   - no lantern budget;
//   - some stones carry a number 0..4 = the exact count of lanterns on the
//     (up to 4) orthogonally adjacent cells.
// Complete = every floor cell lit, no conflicts, every numbered stone exact.
// Once complete, every move is illegal (apply returns null), as in lanterns.
// Spec: docs/lanterns-pips.md.

import { writeU32LE } from "../../core/bytes.ts";
import { type BB, EMPTY, MAX_SIZE, MIN_SIZE, analyze as lightAnalyze, boardMask, floorMask, hasBit, index, popcount } from "../lanterns/rules.ts";

export { type BB, EMPTY, bbEqual, boardMask, cellsOf, floorMask, hasBit, index, popcount, withBit } from "../lanterns/rules.ts";

/** Marker for "no number" in PipsLevel.clues. */
export const NO_CLUE = 255;

export interface PipsLevel {
  readonly w: number;
  readonly h: number;
  readonly stones: BB;
  /** clues[i] (i = stride-8 cell index, length 64): 0..4 on a numbered stone, NO_CLUE elsewhere. */
  readonly clues: readonly number[];
}

export interface PipsState extends PipsLevel {
  readonly lanterns: BB;
}

export interface PipsMove {
  readonly x: number;
  readonly y: number;
}

/** Orthogonal neighbours of cell i inside a w×h board. */
export function neighbours(w: number, h: number, i: number): number[] {
  const x = i & 7;
  const y = i >> 3;
  const out: number[] = [];
  if (y > 0) out.push(i - 8);
  if (x > 0) out.push(i - 1);
  if (x < w - 1) out.push(i + 1);
  if (y < h - 1) out.push(i + 8);
  return out;
}

/** Numbered stones as a bitboard. */
export function numberedMask(l: PipsLevel): BB {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 64; i++) {
    if (l.clues[i] === NO_CLUE) continue;
    if (i < 32) lo |= 1 << i;
    else hi |= 1 << (i - 32);
  }
  return { lo: lo >>> 0, hi: hi >>> 0 };
}

export function validateLevel(l: PipsLevel): void {
  const sizeOk = (n: number): boolean => Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE;
  if (!sizeOk(l.w) || !sizeOk(l.h)) throw new RangeError(`board size ${l.w}x${l.h} out of range`);
  const u32 = (v: number): boolean => Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
  if (!u32(l.stones.lo) || !u32(l.stones.hi)) throw new RangeError("stones words must be integers in 0..0xFFFFFFFF");
  const m = boardMask(l.w, l.h);
  if ((l.stones.lo & ~m.lo) !== 0 || (l.stones.hi & ~m.hi) !== 0) throw new RangeError("stone outside board");
  if (l.clues.length !== 64) throw new RangeError("clues must have 64 entries");
  for (let i = 0; i < 64; i++) {
    const c = l.clues[i]!;
    if (c === NO_CLUE) continue;
    if (!Number.isInteger(c) || c < 0 || c > 4) throw new RangeError(`clue ${c} at cell ${i} out of range`);
    if (!hasBit(l.stones, i)) throw new RangeError(`clue at cell ${i} is not on a stone`);
    if (c > neighbours(l.w, l.h, i).length) throw new RangeError(`clue ${c} at cell ${i} exceeds its neighbours`);
  }
}

export function initialState(level: PipsLevel): PipsState {
  validateLevel(level);
  return { w: level.w, h: level.h, stones: level.stones, clues: level.clues, lanterns: EMPTY };
}

/** Lanterns orthogonally adjacent to cell i. */
export function adjacentLanterns(s: PipsState, i: number): number {
  let n = 0;
  for (const j of neighbours(s.w, s.h, i)) if (hasBit(s.lanterns, j)) n++;
  return n;
}

export interface PipsAnalysis {
  /** Lit cells (lanterns included). */
  lit: BB;
  /** Lanterns that see at least one other lantern. */
  conflicts: BB;
  used: number;
  /** Numbered stones whose adjacent-lantern count differs from the number. */
  unmatched: BB;
  /** Numbered stones with more adjacent lanterns than the number. */
  over: BB;
}

export function analyze(s: PipsState): PipsAnalysis {
  const a = lightAnalyze({ w: s.w, h: s.h, budget: 0, stones: s.stones, lanterns: s.lanterns });
  let uLo = 0;
  let uHi = 0;
  let oLo = 0;
  let oHi = 0;
  for (let i = 0; i < 64; i++) {
    const c = s.clues[i]!;
    if (c === NO_CLUE) continue;
    const n = adjacentLanterns(s, i);
    if (n === c) continue;
    if (i < 32) uLo |= 1 << i;
    else uHi |= 1 << (i - 32);
    if (n > c) {
      if (i < 32) oLo |= 1 << i;
      else oHi |= 1 << (i - 32);
    }
  }
  return { lit: a.lit, conflicts: a.conflicts, used: a.used, unmatched: { lo: uLo >>> 0, hi: uHi >>> 0 }, over: { lo: oLo >>> 0, hi: oHi >>> 0 } };
}

export function isComplete(s: PipsState): boolean {
  const a = analyze(s);
  if (popcount(a.conflicts) !== 0 || popcount(a.unmatched) !== 0) return false;
  const f = floorMask(s);
  return (f.lo & ~a.lit.lo) === 0 && (f.hi & ~a.lit.hi) === 0;
}

/** Floor cells not yet lit. */
export function darkCells(s: PipsState): BB {
  const f = floorMask(s);
  const { lit } = analyze(s);
  return { lo: (f.lo & ~lit.lo) >>> 0, hi: (f.hi & ~lit.hi) >>> 0 };
}

/** Toggle a lantern. null if off-board, a stone, or already complete. Never mutates. */
export function toggle(s: PipsState, m: PipsMove): PipsState | null {
  const { x, y } = m;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return null;
  const i = index(x, y);
  if (hasBit(s.stones, i)) return null;
  if (isComplete(s)) return null;
  const on = !hasBit(s.lanterns, i);
  const lanterns = i < 32
    ? { lo: (on ? s.lanterns.lo | (1 << i) : s.lanterns.lo & ~(1 << i)) >>> 0, hi: s.lanterns.hi }
    : { lo: s.lanterns.lo, hi: (on ? s.lanterns.hi | (1 << (i - 32)) : s.lanterns.hi & ~(1 << (i - 32))) >>> 0 };
  return { ...s, lanterns };
}

/**
 * Canonical state bytes (60, little-endian):
 *   0 w u8 · 1 h u8 · 2 numbered-stone count u8 · 3 reserved 0 ·
 *   4 stones.lo · 8 stones.hi · 12 numbered.lo · 16 numbered.hi ·
 *   20 lanterns.lo · 24 lanterns.hi (u32 each) ·
 *   28..59 clue nibbles: cell i in byte 28 + (i >> 1), low nibble for even i;
 *          0..4 on a numbered stone, 0xF elsewhere.
 */
export function stateBytes(s: PipsState): Uint8Array {
  const b = new Uint8Array(60);
  const num = numberedMask(s);
  b[0] = s.w;
  b[1] = s.h;
  b[2] = popcount(num);
  writeU32LE(b, 4, s.stones.lo);
  writeU32LE(b, 8, s.stones.hi);
  writeU32LE(b, 12, num.lo);
  writeU32LE(b, 16, num.hi);
  writeU32LE(b, 20, s.lanterns.lo);
  writeU32LE(b, 24, s.lanterns.hi);
  for (let i = 0; i < 64; i++) {
    const c = s.clues[i]!;
    const v = c === NO_CLUE ? 0xf : c;
    const k = 28 + (i >> 1);
    b[k] = b[k]! | ((i & 1) === 0 ? v : v << 4);
  }
  return b;
}
