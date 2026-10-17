// Exact solution counter for Lanterns-P (Akari). Pure, integer-only.
//
// Search state: placed lanterns P, lit cells (lanterns included) and an
// exclusion set X (cells that may not hold a lantern in this subtree).
// A lantern may only go on an "available" cell = floor & ~lit & ~X (a lit
// cell would conflict with the lantern that lights it).
//
// Propagation to a fixpoint before branching (each rule is implied by the
// constraints, so it never loses a solution):
//   - numbered stone with p adjacent lanterns and a available neighbours:
//     p > n or p + a < n → dead; p = n → exclude the rest; p + a = n → place them;
//   - dark cell with 0 candidate positions (ray ∩ available) → dead; with 1 → place it.
// Branching: the dark cell with the fewest candidates (MRV); candidates in
// ascending cell order, each tried candidate excluded from later siblings, so
// every solution (a lantern set) is counted exactly once (as in
// games/lanterns/solver.ts).

import { type Rays, buildRays, low32, pop32 } from "../lanterns/solver.ts";
import { type BB, EMPTY, NO_CLUE, type PipsLevel, neighbours } from "./rules.ts";

export interface PipsModel {
  readonly r: Rays;
  /** Numbered stones: cell, number, adjacent-cell mask words. */
  readonly clueCell: readonly number[];
  readonly clueVal: readonly number[];
  readonly adjLo: readonly number[];
  readonly adjHi: readonly number[];
}

/** `rays` may be passed when already built for the same stones (the generator's removal loop). */
export function buildModel(level: PipsLevel, rays?: Rays): PipsModel {
  const r = rays ?? buildRays(level);
  const clueCell: number[] = [];
  const clueVal: number[] = [];
  const adjLo: number[] = [];
  const adjHi: number[] = [];
  for (let i = 0; i < 64; i++) {
    const v = level.clues[i]!;
    if (v === NO_CLUE) continue;
    let lo = 0;
    let hi = 0;
    for (const j of neighbours(level.w, level.h, i)) {
      if (((j < 32 ? r.floorLo >>> j : r.floorHi >>> (j - 32)) & 1) === 0) continue; // stones hold no lantern
      if (j < 32) lo |= 1 << j;
      else hi |= 1 << (j - 32);
    }
    clueCell.push(i);
    clueVal.push(v);
    adjLo.push(lo >>> 0);
    adjHi.push(hi >>> 0);
  }
  return { r, clueCell, clueVal, adjLo, adjHi };
}

export interface CountResult {
  /** Solutions found, capped at `cap`. */
  readonly count: number;
  /** The first solution found (EMPTY if none). */
  readonly solution: BB;
  readonly nodes: number;
  /** nodeCap hit: count is a lower bound, not exact. */
  readonly aborted: boolean;
}

/**
 * Count solutions up to `cap` (default 2 = uniqueness test). `fixed` (round 7): lanterns that every
 * counted solution must contain (the player's current lanterns); 0 solutions if they see each other
 * or stand on a stone.
 */
export function countSolutions(level: PipsLevel, cap = 2, nodeCap = 200000, model?: PipsModel, fixed?: BB): CountResult {
  const m = model ?? buildModel(level);
  const r = m.r;
  const fLo = r.floorLo;
  const fHi = r.floorHi;
  const nc = m.clueCell.length;
  let nodes = 0;
  let count = 0;
  let stop = false;
  let aborted = false;
  let solLo = 0;
  let solHi = 0;

  const rec = (pLo0: number, pHi0: number, lLo0: number, lHi0: number, xLo0: number, xHi0: number): void => {
    if (++nodes > nodeCap) {
      stop = true;
      aborted = true;
      return;
    }
    let pLo = pLo0;
    let pHi = pHi0;
    let lLo = lLo0;
    let lHi = lHi0;
    let xLo = xLo0;
    let xHi = xHi0;
    let best = -1;
    let bestN = 99;
    for (;;) {
      const aLo = (fLo & ~lLo & ~xLo) >>> 0;
      const aHi = (fHi & ~lHi & ~xHi) >>> 0;
      let changed = false;
      for (let k = 0; k < nc && !changed; k++) {
        const v = m.clueVal[k]!;
        const p = pop32((m.adjLo[k]! & pLo) >>> 0) + pop32((m.adjHi[k]! & pHi) >>> 0);
        const avLo = (m.adjLo[k]! & aLo) >>> 0;
        const avHi = (m.adjHi[k]! & aHi) >>> 0;
        const a = pop32(avLo) + pop32(avHi);
        if (p > v || p + a < v) return;
        if (a === 0) continue;
        if (p === v) {
          xLo = (xLo | avLo) >>> 0;
          xHi = (xHi | avHi) >>> 0;
          changed = true;
        } else if (p + a === v) {
          // Cells around one stone never see each other: place them all.
          for (let t = avLo; t !== 0; t = (t & (t - 1)) >>> 0) {
            const q = low32(t);
            lLo |= r.lo[q]!;
            lHi |= r.hi[q]!;
          }
          for (let t = avHi; t !== 0; t = (t & (t - 1)) >>> 0) {
            const q = low32(t) + 32;
            lLo |= r.lo[q]!;
            lHi |= r.hi[q]!;
          }
          lLo >>>= 0;
          lHi >>>= 0;
          pLo = (pLo | avLo) >>> 0;
          pHi = (pHi | avHi) >>> 0;
          changed = true;
        }
      }
      if (changed) continue;
      const dLo = (fLo & ~lLo) >>> 0;
      const dHi = (fHi & ~lHi) >>> 0;
      if ((dLo | dHi) === 0) break;
      best = -1;
      bestN = 99;
      for (let t = dLo; t !== 0 && bestN > 1; t = (t & (t - 1)) >>> 0) {
        const c = low32(t);
        const n = pop32((r.lo[c]! & aLo) >>> 0) + pop32((r.hi[c]! & aHi) >>> 0);
        if (n < bestN) {
          best = c;
          bestN = n;
        }
      }
      for (let t = dHi; t !== 0 && bestN > 1; t = (t & (t - 1)) >>> 0) {
        const c = low32(t) + 32;
        const n = pop32((r.lo[c]! & aLo) >>> 0) + pop32((r.hi[c]! & aHi) >>> 0);
        if (n < bestN) {
          best = c;
          bestN = n;
        }
      }
      if (bestN === 0) return;
      if (bestN === 1) {
        const cLo = (r.lo[best]! & aLo) >>> 0;
        const q = cLo !== 0 ? low32(cLo) : low32((r.hi[best]! & aHi) >>> 0) + 32;
        if (q < 32) pLo = (pLo | (1 << q)) >>> 0;
        else pHi = (pHi | (1 << (q - 32))) >>> 0;
        lLo = (lLo | r.lo[q]!) >>> 0;
        lHi = (lHi | r.hi[q]!) >>> 0;
        continue;
      }
      break;
    }
    if (((fLo & ~lLo) | (fHi & ~lHi)) === 0) {
      // Every floor cell lit and the last clue pass found every number exact.
      if (count === 0) {
        solLo = pLo;
        solHi = pHi;
      }
      count++;
      if (count >= cap) stop = true;
      return;
    }
    const aLo = (fLo & ~lLo & ~xLo) >>> 0;
    const aHi = (fHi & ~lHi & ~xHi) >>> 0;
    let exLo = xLo;
    let exHi = xHi;
    const cLo = (r.lo[best]! & aLo) >>> 0;
    const cHi = (r.hi[best]! & aHi) >>> 0;
    for (let t = cLo; t !== 0 && !stop; t = (t & (t - 1)) >>> 0) {
      const q = low32(t);
      rec((pLo | (1 << q)) >>> 0, pHi, (lLo | r.lo[q]!) >>> 0, (lHi | r.hi[q]!) >>> 0, exLo, exHi);
      exLo = (exLo | (1 << q)) >>> 0;
    }
    for (let t = cHi; t !== 0 && !stop; t = (t & (t - 1)) >>> 0) {
      const q = low32(t) + 32;
      rec(pLo, (pHi | (1 << (q - 32))) >>> 0, (lLo | r.lo[q]!) >>> 0, (lHi | r.hi[q]!) >>> 0, exLo, exHi);
      exHi = (exHi | (1 << (q - 32))) >>> 0;
    }
  };

  if (fixed === undefined || (fixed.lo | fixed.hi) === 0) rec(0, 0, 0, 0, 0, 0);
  else {
    let lLo = 0;
    let lHi = 0;
    let ok = (fixed.lo & ~fLo) === 0 && (fixed.hi & ~fHi) === 0;
    for (let w = 0; w < 2 && ok; w++) {
      for (let t = w === 0 ? fixed.lo >>> 0 : fixed.hi >>> 0; t !== 0; t = (t & (t - 1)) >>> 0) {
        const q = low32(t) + (w << 5);
        // Another fixed lantern on q's rays (q itself excluded) → they see each other.
        const oLo = (r.lo[q]! & fixed.lo & ~(q < 32 ? 1 << q : 0)) >>> 0;
        const oHi = (r.hi[q]! & fixed.hi & ~(q >= 32 ? 1 << (q - 32) : 0)) >>> 0;
        if ((oLo | oHi) !== 0) ok = false;
        lLo = (lLo | r.lo[q]!) >>> 0;
        lHi = (lHi | r.hi[q]!) >>> 0;
      }
    }
    if (ok) rec(fixed.lo >>> 0, fixed.hi >>> 0, lLo, lHi, 0, 0);
  }
  return { count, solution: count > 0 ? { lo: solLo, hi: solHi } : EMPTY, nodes, aborted };
}

/** true iff the level has exactly one solution (and the search did not abort). */
export function isUnique(level: PipsLevel, model?: PipsModel): boolean {
  const res = countSolutions(level, 2, 200000, model);
  return !res.aborted && res.count === 1;
}
