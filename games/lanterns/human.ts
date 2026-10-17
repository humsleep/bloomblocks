// Human-like Lanterns bot (pure, integer-only; shared by the generator's
// difficulty score and the sim timing report).
//
// One action per step:
//   1. Every floor cell lit → done.
//   2. Look at the dark cell with the FEWEST candidate positions (a candidate is
//      a dark, non-tabu cell on its row/column segment — a placement that would
//      not conflict). Place a lantern on the candidate that lights the most dark
//      cells; with an rng, ties are random and 1 time in 4 the runner-up is
//      taken instead (people are not perfectly greedy).
//   3. Stuck — that cell has no candidate, or the budget is used up, or (with
//      `lookahead`) the "these dark spots each need their own lantern" count
//      exceeds the lanterns left — → think (dead end), then UNDO one lantern:
//      for an unlightable cell, one of the lanterns blocking it; otherwise the
//      lantern doing the least unique work. The removed cell is tabu for a few
//      steps so the bot does not put it straight back.
// It never places a conflicting lantern, so "undo on conflict" becomes "undo
// when stuck". This is local repair, not exhaustive search: like a person it
// moves lanterns around, and it can wander (capped by maxActions).

import type { Rng } from "../../core/rng.ts";
import { type LanternsLevel, type LanternsMove } from "./rules.ts";
import { type Rays, buildRays, candCount, low32, lowerBound, pop32 } from "./solver.ts";

export interface HumanOptions {
  /** Tie-break + occasional second-best choice; null = deterministic (lowest cell). */
  readonly rng?: Rng | null;
  /** Prune with the packing lower bound. */
  readonly lookahead?: boolean;
  /** Give up after this many placements + removals. */
  readonly maxActions?: number;
  /** Steps a removed cell stays tabu. */
  readonly tabu?: number;
  /** Record the toggle sequence in `moves` (default true). */
  readonly record?: boolean;
}

export interface HumanTrace {
  readonly completed: boolean;
  readonly placements: number;
  /** Placements where the most constrained dark cell had a single candidate. */
  readonly forced: number;
  readonly removals: number;
  /** Times the bot got stuck (each followed by one undo). */
  readonly deadEnds: number;
  /** Toggle sequence as played, replayable through rules.toggle (empty if record = false). */
  readonly moves: readonly LanternsMove[];
}

export function humanSolve(level: LanternsLevel, opts: HumanOptions = {}, rays?: Rays): HumanTrace {
  const r = rays ?? buildRays(level);
  const rng = opts.rng ?? null;
  const lookahead = opts.lookahead ?? true;
  const maxActions = opts.maxActions ?? 400;
  const tabuLen = opts.tabu ?? 6;
  const record = opts.record ?? true;
  const moves: LanternsMove[] = [];
  const lanterns: number[] = [];
  /** Removed cells and the last step they stay tabu. */
  const tabuCell: number[] = [];
  const tabuEnd: number[] = [];
  let placements = 0;
  let forced = 0;
  let removals = 0;
  let deadEnds = 0;
  let step = 0;
  let litLo = 0;
  let litHi = 0;

  const relight = (): void => {
    litLo = 0;
    litHi = 0;
    for (const p of lanterns) {
      litLo |= r.lo[p]!;
      litHi |= r.hi[p]!;
    }
    litLo >>>= 0;
    litHi >>>= 0;
  };
  /** Cells only lantern p lights. */
  const uniqueWork = (p: number): number => {
    let lo = 0;
    let hi = 0;
    for (const q of lanterns) {
      if (q === p) continue;
      lo |= r.lo[q]!;
      hi |= r.hi[q]!;
    }
    return pop32((r.lo[p]! & ~lo) >>> 0) + pop32((r.hi[p]! & ~hi) >>> 0);
  };
  const cands: number[] = [];

  for (; placements + removals < maxActions && step < maxActions * 2; step++) {
    const dLo = (r.floorLo & ~litLo) >>> 0;
    const dHi = (r.floorHi & ~litHi) >>> 0;
    if ((dLo | dHi) === 0) return { completed: true, placements, forced, removals, deadEnds, moves };
    let tLo = 0;
    let tHi = 0;
    for (let k = tabuCell.length - 1; k >= 0; k--) {
      if (tabuEnd[k]! < step) {
        tabuCell.splice(k, 1);
        tabuEnd.splice(k, 1);
        continue;
      }
      const i = tabuCell[k]!;
      if (i < 32) tLo |= 1 << i;
      else tHi |= 1 << (i - 32);
    }
    const aLo = (dLo & ~tLo) >>> 0;
    const aHi = (dHi & ~tHi) >>> 0;
    // Most constrained dark cell (first in cell order on ties).
    let best = -1;
    let bestN = 99;
    for (let v = dLo; v !== 0; v = (v & (v - 1)) >>> 0) {
      const c = low32(v);
      const n = candCount(r, c, aLo, aHi);
      if (n < bestN) {
        best = c;
        bestN = n;
      }
    }
    for (let v = dHi; v !== 0; v = (v & (v - 1)) >>> 0) {
      const c = low32(v) + 32;
      const n = candCount(r, c, aLo, aHi);
      if (n < bestN) {
        best = c;
        bestN = n;
      }
    }
    const used = lanterns.length;
    const stuck = used >= level.budget || bestN === 0 || (lookahead && used + lowerBound(r, dLo, dHi, aLo, aHi) > level.budget);
    if (!stuck) {
      cands.length = 0;
      for (let v = (r.lo[best]! & aLo) >>> 0; v !== 0; v = (v & (v - 1)) >>> 0) cands.push(low32(v));
      for (let v = (r.hi[best]! & aHi) >>> 0; v !== 0; v = (v & (v - 1)) >>> 0) cands.push(low32(v) + 32);
      // Rank by gain (dark cells lit). Take the best; with an rng, 1 time in 4
      // the runner-up. Equal gains are a uniform random pick (one draw).
      const gain = (p: number): number => pop32((r.lo[p]! & dLo) >>> 0) + pop32((r.hi[p]! & dHi) >>> 0);
      let g1 = -1;
      let n1 = 0;
      let g2 = -1;
      let n2 = 0;
      for (const p of cands) {
        const g = gain(p);
        if (g > g1) {
          g2 = g1;
          n2 = n1;
          g1 = g;
          n1 = 1;
        } else if (g === g1) n1++;
        else if (g > g2) {
          g2 = g;
          n2 = 1;
        } else if (g === g2) n2++;
      }
      let want = g1;
      let nth = 0;
      if (rng && cands.length > 1 && rng.nextInt(4) === 0) {
        // Runner-up: another max-gain cell if there are ties, else the next gain level.
        if (n1 > 1) nth = 1 + rng.nextInt(n1 - 1);
        else {
          want = g2;
          nth = rng.nextInt(n2);
        }
      } else if (rng && n1 > 1) nth = rng.nextInt(n1);
      let pick = 0;
      for (let k = 0, seen = 0; k < cands.length; k++) {
        if (gain(cands[k]!) !== want) continue;
        if (seen++ === nth) {
          pick = k;
          break;
        }
      }
      const p = cands[pick]!;
      if (cands.length === 1) forced++;
      lanterns.push(p);
      litLo = (litLo | r.lo[p]!) >>> 0;
      litHi = (litHi | r.hi[p]!) >>> 0;
      if (record) moves.push({ x: p & 7, y: p >> 3 });
      placements++;
      continue;
    }
    deadEnds++;
    if (used === 0) {
      // Only tabu blocks the board: forget it and look again.
      tabuCell.length = 0;
      tabuEnd.length = 0;
      continue;
    }
    // Lanterns blocking the stuck cell (lighting any cell of its ray), else all.
    let pool = lanterns;
    if (bestN === 0) {
      const blockers = lanterns.filter((q) => ((r.lo[q]! & r.lo[best]!) | (r.hi[q]! & r.hi[best]!)) !== 0);
      if (blockers.length > 0) pool = blockers;
    }
    // The one doing the least unique work (uniform among equals with an rng).
    let vs = 99;
    let vn = 0;
    for (const q of pool) {
      const sc = uniqueWork(q);
      if (sc < vs) {
        vs = sc;
        vn = 1;
      } else if (sc === vs) vn++;
    }
    let vth = rng && vn > 1 ? rng.nextInt(vn) : 0;
    let victim = pool[0]!;
    for (const q of pool) {
      if (uniqueWork(q) !== vs) continue;
      if (vth-- === 0) {
        victim = q;
        break;
      }
    }
    lanterns.splice(lanterns.indexOf(victim), 1);
    relight();
    tabuCell.push(victim);
    tabuEnd.push(step + tabuLen);
    if (record) moves.push({ x: victim & 7, y: victim >> 3 });
    removals++;
  }
  return { completed: false, placements, forced, removals, deadEnds, moves };
}
