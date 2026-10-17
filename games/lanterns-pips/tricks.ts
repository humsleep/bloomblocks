// "Trick signature" of a Lanterns-P level (pure, integer-only): which kinds of
// T2 step ("a dark cell only one spot can still light") its deterministic
// T1+T2 solve path uses. Round 3 testers felt J-15 replay J-8's core trick (a
// cell boxed in between rocks, lit from one place); the gentle track keeps the
// signature of a level different from the previous TRICK_WINDOW − 1 levels.
//
// Path: exactly grade(level, 2) — T1 first (first in cell order), else the
// first dark cell (cell order) with a single available spot. Each T2 step on
// dark cell c, placing on q, gets a kind = shape × cause:
//   shape  'self'   q = c (the cell must hold its own lantern)
//          'boxed'  q ≠ c and c's row or column run is c alone (boxed in
//                   between rocks/edges on one axis, lit from the other one)
//          'line'   q ≠ c otherwise (lit from along an open line)
//   cause  why the other spots of c's runs are out: 'light' (all lit by
//          lanterns), 'mark' (all ruled out by numbers), 'mixed' (both)
// signature = the multiset of kinds, written "kind×count" sorted by kind code,
// joined by " " ("" = no T2 step). code(kind) = 1..9 (TRICK_KINDS order).
// bucket = (Σ codes over the multiset) mod TRICK_WINDOW: equal signatures have
// equal buckets, so giving level n the bucket n mod TRICK_WINDOW guarantees no
// signature repeats within TRICK_WINDOW consecutive levels — without making a
// level depend on the levels before it (random access stays O(1)).

import { low32, pop32 } from "../lanterns/solver.ts";
import { type Board, allLit, applyFirstT1, broken, emptyBoard, place } from "./deduce.ts";
import { type PipsLevel, hasBit, index } from "./rules.ts";
import { type PipsModel, buildModel } from "./solver.ts";

/** No trick signature repeats within this many consecutive gentle levels (the level and the previous 4). */
export const TRICK_WINDOW = 5;

/**
 * Kinds in code order (code = position + 1). The four common kinds come first
 * so that a level with a single T2 step can land in any bucket 1–4 (and "" or
 * boxed-mark in bucket 0): the early gentle levels (T2 0–1) still rotate.
 */
export const TRICK_KINDS = [
  "self-light", "boxed-mixed", "self-mixed", "line-mixed", "boxed-mark", "self-mark", "boxed-light", "line-light", "line-mark",
] as const;
export type TrickKind = (typeof TRICK_KINDS)[number];

export interface TrickSignature {
  /** T2 kinds in path order. */
  readonly kinds: readonly TrickKind[];
  /** The cell each T2 step places on, in path order (parallel to kinds). */
  readonly spots: readonly number[];
  /** Canonical multiset text, e.g. "self-light×1 boxed-mark×2" ("" = no T2 step). */
  readonly signature: string;
  /** (Σ kind codes) mod TRICK_WINDOW. */
  readonly bucket: number;
}

function runLen(level: PipsLevel, c: number, dx: number, dy: number): number {
  let n = 0;
  let x = (c & 7) + dx;
  let y = (c >> 3) + dy;
  while (x >= 0 && y >= 0 && x < level.w && y < level.h && !hasBit(level.stones, index(x, y))) {
    n++;
    x += dx;
    y += dy;
  }
  return n;
}

function cellsOf(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let t = lo >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t));
  for (let t = hi >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) out.push(low32(t) + 32);
  return out;
}

const inMask = (lo: number, hi: number, i: number): boolean => ((i < 32 ? lo >>> i : hi >>> (i - 32)) & 1) === 1;

/** Kind of the T2 step lighting dark cell c from q on board b (before placing). */
export function t2Kind(level: PipsLevel, m: PipsModel, b: Board, c: number, q: number): TrickKind {
  const rowLen = 1 + runLen(level, c, -1, 0) + runLen(level, c, 1, 0);
  const colLen = 1 + runLen(level, c, 0, -1) + runLen(level, c, 0, 1);
  const shape = q === c ? "self" : rowLen === 1 || colLen === 1 ? "boxed" : "line";
  let light = false;
  let marked = false;
  for (const o of cellsOf(m.r.lo[c]!, m.r.hi[c]!)) {
    if (o === q) continue;
    if (inMask(b.lLo, b.lHi, o)) light = true;
    else if (inMask(b.mLo, b.mHi, o)) marked = true;
  }
  const cause = light && marked ? "mixed" : marked ? "mark" : "light";
  return `${shape}-${cause}` as TrickKind;
}

/** The trick signature (see header); kinds = [] when the level is not T1+T2 solvable from the path's start. */
export function trickSignature(level: PipsLevel, model?: PipsModel): TrickSignature {
  const m = model ?? buildModel(level);
  const r = m.r;
  const b = emptyBoard();
  const kinds: TrickKind[] = [];
  const spots: number[] = [];
  for (let guard = 0; guard < 512; guard++) {
    if (broken(m, b) || allLit(m, b)) break;
    if (applyFirstT1(m, b) >= 0) continue;
    // findT2's first deduction: the first dark cell (cell order) with one available spot.
    const aLo = (r.floorLo & ~b.lLo & ~b.mLo) >>> 0;
    const aHi = (r.floorHi & ~b.lHi & ~b.mHi) >>> 0;
    let hit = -1;
    let spot = -1;
    for (const c of cellsOf((r.floorLo & ~b.lLo) >>> 0, (r.floorHi & ~b.lHi) >>> 0)) {
      const cLo = (r.lo[c]! & aLo) >>> 0;
      const cHi = (r.hi[c]! & aHi) >>> 0;
      if (pop32(cLo) + pop32(cHi) !== 1) continue;
      hit = c;
      spot = cLo !== 0 ? low32(cLo) : low32(cHi) + 32;
      break;
    }
    if (hit < 0) break;
    kinds.push(t2Kind(level, m, b, hit, spot));
    spots.push(spot);
    place(m, b, spot);
  }
  return signatureOf(kinds, spots);
}

export function signatureOf(kinds: readonly TrickKind[], spots: readonly number[] = []): TrickSignature {
  const counts = TRICK_KINDS.map((k) => kinds.filter((x) => x === k).length);
  let sum = 0;
  const parts: string[] = [];
  for (let k = 0; k < TRICK_KINDS.length; k++) {
    sum += counts[k]! * (k + 1);
    if (counts[k]! > 0) parts.push(`${TRICK_KINDS[k]}×${counts[k]}`);
  }
  return { kinds, spots, signature: parts.join(" "), bucket: sum % TRICK_WINDOW };
}

// ---------------------------------------------------------------- isolated singles

/**
 * "Isolated single cells" (round 5; J-20 testers: "five separate single dark
 * squares, each one forced tap"): the T2 steps of kind `self-light` on the
 * signature path — a dark cell whose every other spot is already lit, so it
 * must hold its own lantern, and that lantern lights nothing else. A tap on a
 * lone dark pocket, no reasoning. Returns those cells, ascending. Path-based
 * like the signature, so it is computed on the board as presented.
 */
export function isolatedSingles(level: PipsLevel, sig?: TrickSignature): number[] {
  const t = sig ?? trickSignature(level);
  const out: number[] = [];
  t.kinds.forEach((k, i) => {
    if (k === "self-light") out.push(t.spots[i]!);
  });
  return out.sort((a, b) => a - b);
}
