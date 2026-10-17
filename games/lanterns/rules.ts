// B1 Lanterns (등불 정원) — rules only.
//
// Board W×H, 5 <= W,H <= 8. Cells are indexed with a fixed stride of 8:
//   i = y * 8 + x   (so the 1-byte move encoding is exactly the index)
// A 64-cell bitboard is stored as two u32 words: lo = cells 0..31 (rows 0-3),
// hi = cells 32..63 (rows 4-7). Bits outside the W×H board are always 0.
//
// A lantern lights its own cell and extends in 4 directions until a stone or
// the edge (light passes over other lanterns). Two lanterns that see each other
// are in conflict. Complete = every floor cell lit, no conflicts, used <= budget.
// Placing beyond the budget is legal (the UI shows it); it just cannot complete.
// Once complete, every move is illegal (apply returns null). Full spec for
// ports: docs/lanterns-rules.md.

import { writeU32LE } from "../../core/bytes.ts";

export const MIN_SIZE = 5;
export const MAX_SIZE = 8;

/** 64-bit bitboard as two u32 words. */
export interface BB {
  readonly lo: number;
  readonly hi: number;
}

export interface LanternsLevel {
  readonly w: number;
  readonly h: number;
  /** Lantern budget N (0..255). */
  readonly budget: number;
  readonly stones: BB;
}

export interface LanternsState {
  readonly w: number;
  readonly h: number;
  readonly budget: number;
  readonly stones: BB;
  readonly lanterns: BB;
}

export interface LanternsMove {
  readonly x: number;
  readonly y: number;
}

export const EMPTY: BB = { lo: 0, hi: 0 };

export function index(x: number, y: number): number {
  return (y << 3) | x;
}

export function hasBit(b: BB, i: number): boolean {
  return ((i < 32 ? b.lo >>> i : b.hi >>> (i - 32)) & 1) === 1;
}

export function withBit(b: BB, i: number, on: boolean): BB {
  if (i < 32) {
    const m = (1 << i) >>> 0;
    return { lo: (on ? b.lo | m : b.lo & ~m) >>> 0, hi: b.hi };
  }
  const m = (1 << (i - 32)) >>> 0;
  return { lo: b.lo, hi: (on ? b.hi | m : b.hi & ~m) >>> 0 };
}

function popcount32(v: number): number {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

export function popcount(b: BB): number {
  return popcount32(b.lo) + popcount32(b.hi);
}

export function bbEqual(a: BB, b: BB): boolean {
  return a.lo === b.lo && a.hi === b.hi;
}

/** All cells inside a W×H board. */
export function boardMask(w: number, h: number): BB {
  let b = EMPTY;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b = withBit(b, index(x, y), true);
  return b;
}

export function floorMask(s: { w: number; h: number; stones: BB }): BB {
  const m = boardMask(s.w, s.h);
  return { lo: (m.lo & ~s.stones.lo) >>> 0, hi: (m.hi & ~s.stones.hi) >>> 0 };
}

export function validateLevel(l: LanternsLevel): void {
  const sizeOk = (n: number): boolean => Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE;
  if (!sizeOk(l.w) || !sizeOk(l.h)) throw new RangeError(`board size ${l.w}x${l.h} out of range`);
  if (!Number.isInteger(l.budget) || l.budget < 0 || l.budget > 255) throw new RangeError("budget out of range");
  const u32 = (v: number): boolean => Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
  if (!u32(l.stones.lo) || !u32(l.stones.hi)) throw new RangeError("stones words must be integers in 0..0xFFFFFFFF");
  const m = boardMask(l.w, l.h);
  if ((l.stones.lo & ~m.lo) !== 0 || (l.stones.hi & ~m.hi) !== 0) throw new RangeError("stone outside board");
}

export function initialState(level: LanternsLevel): LanternsState {
  validateLevel(level);
  return { w: level.w, h: level.h, budget: level.budget, stones: level.stones, lanterns: EMPTY };
}

/**
 * Toggle a lantern. null if (x,y) is off-board, a stone, or the level is
 * already complete (no moves after completion; docs/lanterns-rules.md).
 * Never mutates.
 */
export function toggle(s: LanternsState, m: LanternsMove): LanternsState | null {
  const { x, y } = m;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return null;
  const i = index(x, y);
  if (hasBit(s.stones, i)) return null;
  if (isComplete(s)) return null;
  return { ...s, lanterns: withBit(s.lanterns, i, !hasBit(s.lanterns, i)) };
}

export interface Analysis {
  /** Lit cells (lanterns included). */
  lit: BB;
  /** Lanterns that see at least one other lantern. */
  conflicts: BB;
  used: number;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function analyze(s: LanternsState): Analysis {
  let lit = EMPTY;
  let conflicts = EMPTY;
  for (let i = 0; i < 64; i++) {
    if (!hasBit(s.lanterns, i)) continue;
    lit = withBit(lit, i, true);
    for (const [dx, dy] of DIRS) {
      let x = (i & 7) + dx;
      let y = (i >> 3) + dy;
      while (x >= 0 && y >= 0 && x < s.w && y < s.h) {
        const j = index(x, y);
        if (hasBit(s.stones, j)) break;
        lit = withBit(lit, j, true);
        if (hasBit(s.lanterns, j)) conflicts = withBit(conflicts, i, true);
        x += dx;
        y += dy;
      }
    }
  }
  return { lit, conflicts, used: popcount(s.lanterns) };
}

export function litCells(s: LanternsState): BB {
  return analyze(s).lit;
}

export function conflictingLanterns(s: LanternsState): BB {
  return analyze(s).conflicts;
}

export function lanternsUsed(s: LanternsState): number {
  return popcount(s.lanterns);
}

/** Floor cells not yet lit (what the UI highlights as "still dark"). */
export function darkCells(s: LanternsState): BB {
  const f = floorMask(s);
  const { lit } = analyze(s);
  return { lo: (f.lo & ~lit.lo) >>> 0, hi: (f.hi & ~lit.hi) >>> 0 };
}

export function isComplete(s: LanternsState): boolean {
  const a = analyze(s);
  if (a.used > s.budget || popcount(a.conflicts) !== 0) return false;
  const f = floorMask(s);
  return (f.lo & ~a.lit.lo) === 0 && (f.hi & ~a.lit.hi) === 0;
}

/** Cells of a bitboard as coordinates, row-major. */
export function cellsOf(b: BB): LanternsMove[] {
  const out: LanternsMove[] = [];
  for (let i = 0; i < 64; i++) if (hasBit(b, i)) out.push({ x: i & 7, y: i >> 3 });
  return out;
}

/**
 * Canonical state bytes (20, little-endian):
 *   0 w u8 · 1 h u8 · 2 budget u8 · 3 reserved 0 ·
 *   4 stones.lo u32 · 8 stones.hi u32 · 12 lanterns.lo u32 · 16 lanterns.hi u32
 */
export function stateBytes(s: LanternsState): Uint8Array {
  const b = new Uint8Array(20);
  b[0] = s.w;
  b[1] = s.h;
  b[2] = s.budget;
  writeU32LE(b, 4, s.stones.lo);
  writeU32LE(b, 8, s.stones.hi);
  writeU32LE(b, 12, s.lanterns.lo);
  writeU32LE(b, 16, s.lanterns.hi);
  return b;
}
