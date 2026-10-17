// Exact Lanterns solver (bitboard DFS + branch-and-bound). Pure, integer-only.
//
// Model: every floor cell sits on one row segment and one column segment
// (maximal stone-free runs). A lantern at p lights ray(p) = its own cell plus
// both segments. A lantern may only stand on a DARK cell: a lit cell is lit by
// some lantern on one of its segments, which it would see (conflict). So the
// search state is just two bitboards: `dark` (floor not yet lit) and `excl`
// (cells excluded by earlier sibling branches, for duplicate-free counting).
//
// Branching: take the dark cell with the fewest candidate lantern positions
// (ray(c) & dark & ~excl, MRV). One of them must hold a lantern in any
// solution. Branch over candidates in ascending cell order and exclude each
// tried candidate from the later siblings, so every solution (a set of
// lanterns) is enumerated exactly once.
//
// Bound: greedy packing — repeatedly take a dark cell c and remove every cell
// some candidate of c could also light; the picked cells pairwise share no
// candidate lantern, so each needs its own lantern.
//
// Minimum: iterative deepening k = bound(initial) .. ; the first k with a
// solution is the minimum, and that search also counts the minimum solutions.

import { type BB, EMPTY, type LanternsLevel, floorMask, hasBit, index } from "./rules.ts";

export interface Rays {
  readonly w: number;
  readonly h: number;
  readonly floorLo: number;
  readonly floorHi: number;
  /** ray(i) words; 0 for stones and off-board cells. */
  readonly lo: readonly number[];
  readonly hi: readonly number[];
}

export function pop32(v: number): number {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

/** Index of the lowest set bit of a nonzero u32. */
export function low32(v: number): number {
  return 31 - Math.clz32(v & -v);
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function buildRays(level: { w: number; h: number; stones: BB }): Rays {
  const lo: number[] = new Array<number>(64).fill(0);
  const hi: number[] = new Array<number>(64).fill(0);
  const f = floorMask(level);
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const i = index(x, y);
      if (hasBit(level.stones, i)) continue;
      let l = 0;
      let u = 0;
      const set = (j: number): void => {
        if (j < 32) l = (l | (1 << j)) >>> 0;
        else u = (u | (1 << (j - 32))) >>> 0;
      };
      set(i);
      for (const [dx, dy] of DIRS) {
        let cx = x + dx;
        let cy = y + dy;
        while (cx >= 0 && cy >= 0 && cx < level.w && cy < level.h && !hasBit(level.stones, index(cx, cy))) {
          set(index(cx, cy));
          cx += dx;
          cy += dy;
        }
      }
      lo[i] = l;
      hi[i] = u;
    }
  }
  return { w: level.w, h: level.h, floorLo: f.lo, floorHi: f.hi, lo, hi };
}

/** Cells lit by a lantern set (lanterns included). */
export function litBy(r: Rays, lanterns: BB): BB {
  let lo = 0;
  let hi = 0;
  for (let v = lanterns.lo; v !== 0; v = (v & (v - 1)) >>> 0) {
    const i = low32(v);
    lo |= r.lo[i]!;
    hi |= r.hi[i]!;
  }
  for (let v = lanterns.hi; v !== 0; v = (v & (v - 1)) >>> 0) {
    const i = low32(v) + 32;
    lo |= r.lo[i]!;
    hi |= r.hi[i]!;
  }
  return { lo: lo >>> 0, hi: hi >>> 0 };
}

/** Number of candidate lantern cells for dark cell c given available cells a. */
export function candCount(r: Rays, c: number, aLo: number, aHi: number): number {
  return pop32((r.lo[c]! & aLo) >>> 0) + pop32((r.hi[c]! & aHi) >>> 0);
}

/** Greedy packing lower bound on lanterns still needed to light `dark` using cells in `a`. */
export function lowerBound(r: Rays, dLo: number, dHi: number, aLo: number, aHi: number): number {
  let lb = 0;
  let rLo = dLo;
  let rHi = dHi;
  while ((rLo | rHi) !== 0) {
    const c = rLo !== 0 ? low32(rLo) : low32(rHi) + 32;
    lb++;
    let mLo = 0;
    let mHi = 0;
    for (let v = (r.lo[c]! & aLo) >>> 0; v !== 0; v = (v & (v - 1)) >>> 0) {
      const p = low32(v);
      mLo |= r.lo[p]!;
      mHi |= r.hi[p]!;
    }
    for (let v = (r.hi[c]! & aHi) >>> 0; v !== 0; v = (v & (v - 1)) >>> 0) {
      const p = low32(v) + 32;
      mLo |= r.lo[p]!;
      mHi |= r.hi[p]!;
    }
    if (c < 32) mLo |= 1 << c;
    else mHi |= 1 << (c - 32);
    rLo = (rLo & ~mLo) >>> 0;
    rHi = (rHi & ~mHi) >>> 0;
  }
  return lb;
}

export interface SolveOptions {
  /** Lanterns already placed (must not see each other). */
  readonly fixed?: BB;
  /** Stop counting at this many solutions (default 64). */
  readonly countCap?: number;
  /** Largest total lantern count to try (default 64). */
  readonly maxTotal?: number;
  /** Abort after this many search nodes (default 2,000,000). */
  readonly nodeCap?: number;
  /** true: stop at the first solution of the minimum size (no counting). */
  readonly firstOnly?: boolean;
}

export interface SolveResult {
  /** Minimum total lantern count (fixed included), or -1 if none ≤ maxTotal. */
  readonly min: number;
  /** Solutions of size `min` (each a distinct lantern set), capped at countCap. */
  readonly count: number;
  readonly capped: boolean;
  /** One minimum solution (fixed included); EMPTY if none. */
  readonly solution: BB;
  readonly nodes: number;
  /** true if nodeCap was hit: the result is unknown, not "unsolvable". */
  readonly aborted: boolean;
}

/** Exact minimum lantern count and number of minimum solutions. */
export function solve(level: Pick<LanternsLevel, "w" | "h" | "stones">, opts: SolveOptions = {}, rays?: Rays): SolveResult {
  const r = rays ?? buildRays(level);
  const fixed = opts.fixed ?? EMPTY;
  const cap = opts.firstOnly ? 1 : (opts.countCap ?? 64);
  const nodeCap = opts.nodeCap ?? 2000000;
  const maxTotal = opts.maxTotal ?? 64;
  const lit0 = litBy(r, fixed);
  const d0Lo = (r.floorLo & ~lit0.lo) >>> 0;
  const d0Hi = (r.floorHi & ~lit0.hi) >>> 0;
  const base = pop32(fixed.lo) + pop32(fixed.hi);
  const stack: number[] = new Array<number>(64).fill(0);

  let nodes = 0;
  let count = 0;
  let stop = false;
  let aborted = false;
  let solLo = 0;
  let solHi = 0;

  const rec = (dLo: number, dHi: number, xLo: number, xHi: number, depth: number, limit: number): void => {
    if ((dLo | dHi) === 0) {
      if (count === 0) {
        solLo = fixed.lo;
        solHi = fixed.hi;
        for (let k = 0; k < depth; k++) {
          const p = stack[k]!;
          if (p < 32) solLo = (solLo | (1 << p)) >>> 0;
          else solHi = (solHi | (1 << (p - 32))) >>> 0;
        }
      }
      count++;
      if (count >= cap) stop = true;
      return;
    }
    if (depth >= limit) return;
    if (++nodes > nodeCap) {
      stop = true;
      aborted = true;
      return;
    }
    const aLo = (dLo & ~xLo) >>> 0;
    const aHi = (dHi & ~xHi) >>> 0;
    let best = -1;
    let bestN = 99;
    for (let v = dLo; v !== 0; v = (v & (v - 1)) >>> 0) {
      const c = low32(v);
      const n = candCount(r, c, aLo, aHi);
      if (n < bestN) {
        best = c;
        bestN = n;
        if (n <= 1) break;
      }
    }
    if (bestN > 1) {
      for (let v = dHi; v !== 0; v = (v & (v - 1)) >>> 0) {
        const c = low32(v) + 32;
        const n = candCount(r, c, aLo, aHi);
        if (n < bestN) {
          best = c;
          bestN = n;
          if (n <= 1) break;
        }
      }
    }
    if (bestN === 0) return;
    if (depth + lowerBound(r, dLo, dHi, aLo, aHi) > limit) return;
    let exLo = xLo;
    let exHi = xHi;
    const cLo = (r.lo[best]! & aLo) >>> 0;
    const cHi = (r.hi[best]! & aHi) >>> 0;
    for (let v = cLo; v !== 0 && !stop; v = (v & (v - 1)) >>> 0) {
      const p = low32(v);
      stack[depth] = p;
      rec((dLo & ~r.lo[p]!) >>> 0, (dHi & ~r.hi[p]!) >>> 0, exLo, exHi, depth + 1, limit);
      exLo = (exLo | (1 << p)) >>> 0;
    }
    for (let v = cHi; v !== 0 && !stop; v = (v & (v - 1)) >>> 0) {
      const p = low32(v) + 32;
      stack[depth] = p;
      rec((dLo & ~r.lo[p]!) >>> 0, (dHi & ~r.hi[p]!) >>> 0, exLo, exHi, depth + 1, limit);
      exHi = (exHi | (1 << (p - 32))) >>> 0;
    }
  };

  for (let k = base + lowerBound(r, d0Lo, d0Hi, d0Lo, d0Hi); k <= maxTotal; k++) {
    rec(d0Lo, d0Hi, 0, 0, 0, k - base);
    if (aborted) break;
    if (count > 0) {
      return { min: k, count, capped: count >= cap && !opts.firstOnly, solution: { lo: solLo, hi: solHi }, nodes, aborted: false };
    }
  }
  return { min: -1, count: 0, capped: false, solution: EMPTY, nodes, aborted };
}
