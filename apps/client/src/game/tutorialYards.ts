// v11 first-yard tutorial (Tutorial.ts): the five hand-made yards and the pure helpers that judge
// them with the rules' own functions only (lanternsPips.apply / isComplete). No Phaser here (unit-tested).
import { hasBit, index, lanternsPips, NO_CLUE, type PipsLevel, type PipsState } from "./pipsApi.ts";

/** a yard: rows of '.' floor, '#' stone, '0'..'4' numbered stone, 'L' a lantern already there */
export const YARDS = {
  t1: ["....."],
  t2: ["...", "L#.", "..."],
  t3: ["L...", "..#."],
  t4: [".L.", ".2.", "..."],
  t5: ["0.."],
} as const;

export const bbHas = (bb: { lo: number; hi: number }, i: number): boolean => hasBit(bb, i);
function withBit(bb: { lo: number; hi: number }, i: number): { lo: number; hi: number } {
  return i < 32 ? { lo: (bb.lo | (1 << i)) >>> 0, hi: bb.hi } : { lo: bb.lo, hi: (bb.hi | (1 << (i - 32))) >>> 0 };
}

/** A yard as a rules level + its starting state (lanterns from 'L'). */
export function yard(rows: readonly string[]): { level: PipsLevel; state: PipsState } {
  let stones = { lo: 0, hi: 0 };
  let lanterns = { lo: 0, hi: 0 };
  const clues = new Array<number>(64).fill(NO_CLUE);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]!;
      const i = index(x, y);
      if (c === "#") stones = withBit(stones, i);
      else if (c >= "0" && c <= "4") {
        stones = withBit(stones, i);
        clues[i] = c.charCodeAt(0) - 48;
      } else if (c === "L") lanterns = withBit(lanterns, i);
    }
  });
  const level: PipsLevel = { w: rows[0]!.length, h: rows.length, stones, clues };
  return { level, state: { ...level, lanterns } };
}

/** Can the yard still be finished from `st` by adding lanterns? (≤ 9 free cells: brute force with the rules' toggle) */
export function solvable(level: PipsLevel, st: PipsState): boolean {
  if (lanternsPips.isComplete(st)) return true;
  const free: number[] = [];
  for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) {
    const i = index(x, y);
    if (!bbHas(level.stones, i) && !bbHas(st.lanterns, i)) free.push(i);
  }
  for (let m = 1; m < 1 << free.length; m++) {
    let s: PipsState | null = st;
    for (let k = 0; k < free.length && s; k++) if (m & (1 << k)) s = lanternsPips.apply(s, { x: free[k]! & 7, y: free[k]! >> 3 });
    if (s && lanternsPips.isComplete(s)) return true;
  }
  return false;
}

